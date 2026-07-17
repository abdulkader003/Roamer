package com.sep.trip;

import com.sep.settings.UserSettingsRepository;
import com.sep.user.AppUser;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TripReminderService {

    private static final int REMINDER_DAYS_BEFORE_TRIP = 10;

    private final TripRepository tripRepository;
    private final TripInvitationRepository tripInvitationRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final TripReminderNotificationRepository reminderRepository;
    private final TripReminderNotificationWebSocketPublisher webSocketPublisher;
    private final Clock clock;

    public TripReminderService(
            TripRepository tripRepository,
            TripInvitationRepository tripInvitationRepository,
            UserSettingsRepository userSettingsRepository,
            TripReminderNotificationRepository reminderRepository,
            TripReminderNotificationWebSocketPublisher webSocketPublisher,
            Clock clock
    ) {
        this.tripRepository = tripRepository;
        this.tripInvitationRepository = tripInvitationRepository;
        this.userSettingsRepository = userSettingsRepository;
        this.reminderRepository = reminderRepository;
        this.webSocketPublisher = webSocketPublisher;
        this.clock = clock;
    }

    @Scheduled(cron = "0 15 8 * * *")
    @Transactional
    public void createDailyTripReminders() {
        LocalDate reminderDate = LocalDate.now(clock);
        LocalDate targetStartDate = reminderDate.plusDays(REMINDER_DAYS_BEFORE_TRIP);

        tripRepository.findAllByStatusAndStartDate(TripStatus.UPCOMING, targetStartDate)
                .forEach(trip -> evaluateTripForReminderDate(trip, reminderDate));
    }

    @Transactional
    public void evaluateTripForToday(Trip trip) {
        evaluateTripForReminderDate(trip, LocalDate.now(clock));
    }

    @Transactional
    public void refreshTripForToday(Trip trip) {
        if (trip == null || trip.getId() == null) {
            return;
        }

        LocalDate reminderDate = LocalDate.now(clock);

        if (!isEligibleTrip(trip, reminderDate)) {
            reminderRepository.deleteAllByTripId(trip.getId());
            return;
        }

        reminderRepository.deleteAllByTripIdAndReminderDateNot(trip.getId(), reminderDate);
        evaluateTripForReminderDate(trip, reminderDate);
    }

    @Transactional
    public void evaluateTripForRecipientToday(Trip trip, AppUser recipient) {
        evaluateTripForRecipient(trip, recipient, LocalDate.now(clock));
    }

    @Transactional
    public void evaluateForUser(AppUser user) {
        if (user == null || user.getId() == null) {
            return;
        }

        tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(user.getId())
                .forEach(trip -> evaluateTripForRecipientToday(trip, user));
    }

    private void evaluateTripForReminderDate(Trip trip, LocalDate reminderDate) {
        if (!isEligibleTrip(trip, reminderDate)) {
            return;
        }

        for (AppUser recipient : reminderRecipients(trip)) {
            evaluateTripForRecipient(trip, recipient, reminderDate);
        }
    }

    private void evaluateTripForRecipient(Trip trip, AppUser recipient, LocalDate reminderDate) {
        if (!isEligibleTrip(trip, reminderDate) || recipient == null || recipient.getId() == null || !tripRemindersEnabled(recipient)) {
            return;
        }

        createReminderNotification(trip, recipient, reminderDate);
    }

    private boolean isEligibleTrip(Trip trip, LocalDate reminderDate) {
        return trip != null
                && trip.getId() != null
                && trip.getStatus() == TripStatus.UPCOMING
                && trip.getStartDate() != null
                && trip.getStartDate().equals(reminderDate.plusDays(REMINDER_DAYS_BEFORE_TRIP));
    }

    private List<AppUser> reminderRecipients(Trip trip) {
        Map<Long, AppUser> recipients = new LinkedHashMap<>();

        if (trip.getOwner() != null && trip.getOwner().getId() != null) {
            recipients.put(trip.getOwner().getId(), trip.getOwner());
        }

        tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(
                        trip.getId(),
                        TripInvitationStatus.ACCEPTED
                )
                .stream()
                .map(TripInvitation::getInvitedUser)
                .filter(user -> user != null && user.getId() != null)
                .forEach(user -> recipients.putIfAbsent(user.getId(), user));

        return List.copyOf(recipients.values());
    }

    private boolean tripRemindersEnabled(AppUser recipient) {
        return userSettingsRepository.findByOwnerId(recipient.getId())
                .map(settings -> settings.isTripReminders())
                .orElse(true);
    }

    private void createReminderNotification(Trip trip, AppUser recipient, LocalDate reminderDate) {
        if (reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(trip.getId(), recipient.getId(), reminderDate)) {
            return;
        }

        TripReminderNotification reminder = new TripReminderNotification();
        reminder.setTrip(trip);
        reminder.setRecipient(recipient);
        reminder.setReminderDate(reminderDate);

        try {
            TripReminderNotification savedReminder = reminderRepository.saveAndFlush(reminder);
            webSocketPublisher.publishTripReminder(savedReminder);
        } catch (DataIntegrityViolationException ignored) {
            // The database unique constraint handles concurrent or repeated scheduler runs.
        }
    }
}
