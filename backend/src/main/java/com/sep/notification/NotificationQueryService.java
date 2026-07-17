package com.sep.notification;

import com.sep.budget.BudgetAlertNotification;
import com.sep.budget.BudgetAlertNotificationService;
import com.sep.settings.UserSettings;
import com.sep.settings.UserSettingsRepository;
import com.sep.trip.Trip;
import com.sep.trip.TripReminderNotification;
import com.sep.trip.TripReminderNotificationRepository;
import com.sep.trip.TripUpdateNotification;
import com.sep.trip.TripUpdateNotificationRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import com.sep.websocket.dto.RealtimeNotificationMessage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.Currency;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class NotificationQueryService {

    private final AppUserRepository appUserRepository;
    private final TripReminderNotificationRepository tripReminderRepository;
    private final TripUpdateNotificationRepository tripUpdateRepository;
    private final BudgetAlertNotificationService budgetAlertNotificationService;
    private final UserSettingsRepository userSettingsRepository;

    public NotificationQueryService(
            AppUserRepository appUserRepository,
            TripReminderNotificationRepository tripReminderRepository,
            TripUpdateNotificationRepository tripUpdateRepository,
            BudgetAlertNotificationService budgetAlertNotificationService,
            UserSettingsRepository userSettingsRepository
    ) {
        this.appUserRepository = appUserRepository;
        this.tripReminderRepository = tripReminderRepository;
        this.tripUpdateRepository = tripUpdateRepository;
        this.budgetAlertNotificationService = budgetAlertNotificationService;
        this.userSettingsRepository = userSettingsRepository;
    }

    @Transactional(readOnly = true)
    public List<RealtimeNotificationMessage> getNotifications(String userEmail) {
        AppUser user = appUserRepository.findByEmailIgnoreCase(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));

        List<RealtimeNotificationMessage> tripReminders = tripReminderRepository
                .findTop20ByRecipientIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::tripReminderMessage)
                .toList();
        List<RealtimeNotificationMessage> budgetAlerts = budgetAlertNotificationService
                .activeAlertsForUser(user.getId())
                .stream()
                .map(this::budgetAlertMessage)
                .toList();
        List<RealtimeNotificationMessage> tripUpdates = bookingUpdatesEnabled(user)
                ? tripUpdateRepository.findTop20ByRecipientIdOrderByCreatedAtDesc(user.getId())
                        .stream()
                        .map(this::tripUpdateMessage)
                        .toList()
                : List.of();

        return java.util.stream.Stream.concat(
                        java.util.stream.Stream.concat(tripReminders.stream(), budgetAlerts.stream()),
                        tripUpdates.stream()
                )
                .sorted(Comparator.comparing(RealtimeNotificationMessage::createdAt).reversed())
                .toList();
    }

    private RealtimeNotificationMessage tripReminderMessage(TripReminderNotification reminder) {
        Trip trip = reminder.getTrip();
        String details = "%s · %s → %s".formatted(
                trip.getDestination(),
                trip.getStartDate(),
                trip.getEndDate()
        );

        return new RealtimeNotificationMessage(
                "TRIP_REMINDER_DUE",
                "TRIP_REMINDER",
                reminder.getId(),
                "Trip reminder",
                "%s starts in 10 days.".formatted(trip.getName()),
                details,
                reminder.getCreatedAt().toString(),
                trip.getId(),
                null
        );
    }

    private RealtimeNotificationMessage budgetAlertMessage(BudgetAlertNotification alert) {
        java.text.NumberFormat money = java.text.NumberFormat.getCurrencyInstance(Locale.US);
        money.setCurrency(Currency.getInstance("EUR"));
        money.setMaximumFractionDigits(0);

        return new RealtimeNotificationMessage(
                "BUDGET_ALERT_OVER_LIMIT",
                "BUDGET_ALERT",
                alert.getId(),
                "Budget alert",
                "Your trip spending is over budget.",
                "%s spent of %s planned.".formatted(
                        money.format(alert.getTotalSpent()),
                        money.format(alert.getTotalBudget())
                ),
                DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(alert.getUpdatedAt()),
                null,
                null
        );
    }

    private RealtimeNotificationMessage tripUpdateMessage(TripUpdateNotification notification) {
        return new RealtimeNotificationMessage(
                notification.getEventType(),
                notification.getNotificationType(),
                notification.getId(),
                notification.getTitle(),
                notification.getDescription(),
                notification.getDetails(),
                DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(notification.getCreatedAt()),
                notification.getTrip().getId(),
                notification.getActorEmail()
        );
    }

    private boolean bookingUpdatesEnabled(AppUser user) {
        return userSettingsRepository.findByOwnerId(user.getId())
                .map(UserSettings::isBookingUpdates)
                .orElse(false);
    }
}
