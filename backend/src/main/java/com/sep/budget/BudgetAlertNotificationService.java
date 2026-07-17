package com.sep.budget;

import com.sep.settings.UserSettings;
import com.sep.settings.UserSettingsRepository;
import com.sep.trip.Trip;
import com.sep.trip.TripInvitation;
import com.sep.trip.TripInvitationRepository;
import com.sep.trip.TripInvitationStatus;
import com.sep.trip.TripRepository;
import com.sep.user.AppUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class BudgetAlertNotificationService {

    public static final String GLOBAL_OVER_BUDGET_KEY = "GLOBAL_OVER_BUDGET";

    private final BudgetAlertNotificationRepository alertRepository;
    private final TripRepository tripRepository;
    private final TripInvitationRepository tripInvitationRepository;
    private final ExpenseRepository expenseRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final BudgetRealtimeWebSocketPublisher budgetRealtimeWebSocketPublisher;

    public BudgetAlertNotificationService(
            BudgetAlertNotificationRepository alertRepository,
            TripRepository tripRepository,
            TripInvitationRepository tripInvitationRepository,
            ExpenseRepository expenseRepository,
            UserSettingsRepository userSettingsRepository,
            BudgetRealtimeWebSocketPublisher budgetRealtimeWebSocketPublisher
    ) {
        this.alertRepository = alertRepository;
        this.tripRepository = tripRepository;
        this.tripInvitationRepository = tripInvitationRepository;
        this.expenseRepository = expenseRepository;
        this.userSettingsRepository = userSettingsRepository;
        this.budgetRealtimeWebSocketPublisher = budgetRealtimeWebSocketPublisher;
    }

    @Transactional
    public void evaluateForUser(AppUser user) {
        if (user == null || user.getId() == null) {
            return;
        }

        List<Trip> trips = tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(user.getId());
        List<Expense> expenses = expensesForTrips(trips);
        BigDecimal totalBudget = trips.stream()
                .map(Trip::getBudget)
                .map(this::positiveAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSpent = totalSpent(trips, expenses);
        boolean enabled = userSettingsRepository.findByOwnerId(user.getId())
                .map(UserSettings::isBudgetAlerts)
                .orElse(true);

        BudgetAlertNotification alert = alertRepository
                .findByRecipientIdAndAlertKey(user.getId(), GLOBAL_OVER_BUDGET_KEY)
                .orElse(null);

        if (!enabled || !isOverBudget(totalBudget, totalSpent)) {
            resolve(alert);
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        if (alert == null) {
            alert = new BudgetAlertNotification();
            alert.setRecipient(user);
            alert.setAlertKey(GLOBAL_OVER_BUDGET_KEY);
        }

        alert.setActive(true);
        alert.setTotalBudget(totalBudget);
        alert.setTotalSpent(totalSpent);
        alert.setResolvedAt(null);
        alert.setUpdatedAt(now);
        BudgetAlertNotification savedAlert = alertRepository.save(alert);
        budgetRealtimeWebSocketPublisher.publishBudgetAlert(savedAlert == null ? alert : savedAlert);
    }

    @Transactional
    public void evaluateForTripAudience(Trip trip) {
        if (trip == null || trip.getId() == null) {
            return;
        }

        Map<Long, AppUser> recipients = new LinkedHashMap<>();
        if (trip.getOwner() != null && trip.getOwner().getId() != null) {
            recipients.put(trip.getOwner().getId(), trip.getOwner());
        }

        for (TripInvitation invitation : tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(
                trip.getId(),
                TripInvitationStatus.ACCEPTED
        )) {
            AppUser invitedUser = invitation.getInvitedUser();
            if (invitedUser != null && invitedUser.getId() != null) {
                recipients.putIfAbsent(invitedUser.getId(), invitedUser);
            }
        }

        recipients.values().forEach(this::evaluateForUser);
    }

    @Transactional(readOnly = true)
    public List<BudgetAlertNotification> activeAlertsForUser(Long userId) {
        return alertRepository.findAllByRecipientIdAndActiveTrueOrderByUpdatedAtDesc(userId);
    }

    private void resolve(BudgetAlertNotification alert) {
        if (alert == null || !alert.isActive()) {
            return;
        }

        alert.setActive(false);
        alert.setResolvedAt(OffsetDateTime.now());
        alert.setUpdatedAt(alert.getResolvedAt());
        alertRepository.save(alert);
    }

    private List<Expense> expensesForTrips(List<Trip> trips) {
        if (trips.isEmpty()) {
            return List.of();
        }

        return expenseRepository.findAllByTripIdInOrderByDateDesc(
                trips.stream()
                        .map(Trip::getId)
                        .toList()
        );
    }

    private BigDecimal totalSpent(List<Trip> trips, List<Expense> expenses) {
        BigDecimal bookingSpend = trips.stream()
                .map(trip -> positiveAmount(trip.getFlightTotal())
                        .add(positiveAmount(trip.getHotelTotal()))
                        .add(positiveAmount(trip.getActivitiesTotal())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal manualSpend = expenses.stream()
                .map(Expense::getAmount)
                .map(this::positiveAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return bookingSpend.add(manualSpend);
    }

    private BigDecimal positiveAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            return BigDecimal.ZERO;
        }

        return amount;
    }

    private boolean isOverBudget(BigDecimal totalBudget, BigDecimal totalSpent) {
        if (totalBudget.signum() == 0) {
            return totalSpent.signum() > 0;
        }

        return totalSpent.compareTo(totalBudget) > 0;
    }
}
