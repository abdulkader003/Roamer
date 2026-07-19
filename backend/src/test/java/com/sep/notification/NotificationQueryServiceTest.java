package com.sep.notification;

import com.sep.budget.BudgetAlertNotificationService;
import com.sep.settings.UserSettings;
import com.sep.settings.UserSettingsRepository;
import com.sep.trip.Trip;
import com.sep.trip.TripReminderNotificationRepository;
import com.sep.trip.TripUpdateNotification;
import com.sep.trip.TripUpdateNotificationRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import com.sep.websocket.dto.RealtimeNotificationMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationQueryServiceTest {

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private TripReminderNotificationRepository tripReminderRepository;

    @Mock
    private TripUpdateNotificationRepository tripUpdateRepository;

    @Mock
    private BudgetAlertNotificationService budgetAlertNotificationService;

    @Mock
    private UserSettingsRepository userSettingsRepository;

    @Test
    void returnsTripUpdateNotificationsWhenBookingUpdatesEnabled() {
        AppUser user = user();
        NotificationQueryService service = service();

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(tripReminderRepository.findTop20ByRecipientIdOrderByCreatedAtDesc(7L)).thenReturn(List.of());
        when(budgetAlertNotificationService.activeAlertsForUser(7L)).thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.of(settings(true)));
        when(tripUpdateRepository.findTop20ByRecipientIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(tripUpdate(user)));

        List<RealtimeNotificationMessage> notifications = service.getNotifications("traveler@example.com");

        assertThat(notifications).hasSize(1);
        assertThat(notifications.getFirst().eventType()).isEqualTo("TRIP_BOOKING_UPDATED");
        assertThat(notifications.getFirst().notificationType()).isEqualTo("TRIP_UPDATE");
        assertThat(notifications.getFirst().title()).isEqualTo("Booking updated");
    }

    @Test
    void hidesTripUpdateNotificationsWhenBookingUpdatesDisabled() {
        AppUser user = user();
        NotificationQueryService service = service();

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(tripReminderRepository.findTop20ByRecipientIdOrderByCreatedAtDesc(7L)).thenReturn(List.of());
        when(budgetAlertNotificationService.activeAlertsForUser(7L)).thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.of(settings(false)));

        List<RealtimeNotificationMessage> notifications = service.getNotifications("traveler@example.com");

        assertThat(notifications).isEmpty();
        verify(tripUpdateRepository, never()).findTop20ByRecipientIdOrderByCreatedAtDesc(7L);
    }

    private NotificationQueryService service() {
        return new NotificationQueryService(
                appUserRepository,
                tripReminderRepository,
                tripUpdateRepository,
                budgetAlertNotificationService,
                userSettingsRepository
        );
    }

    private AppUser user() {
        AppUser user = new AppUser();
        user.setId(7L);
        user.setEmail("traveler@example.com");
        user.setUsername("traveler");
        return user;
    }

    private UserSettings settings(boolean bookingUpdates) {
        UserSettings settings = new UserSettings();
        settings.setBookingUpdates(bookingUpdates);
        return settings;
    }

    private TripUpdateNotification tripUpdate(AppUser recipient) {
        Trip trip = new Trip();
        trip.setId(20L);
        trip.setName("Shared Rome");
        trip.setDestination("Rome");
        trip.setStartDate(LocalDate.of(2026, 7, 15));
        trip.setEndDate(LocalDate.of(2026, 7, 22));

        TripUpdateNotification notification = new TripUpdateNotification();
        notification.setTrip(trip);
        notification.setRecipient(recipient);
        notification.setEventType("TRIP_BOOKING_UPDATED");
        notification.setNotificationType("TRIP_UPDATE");
        notification.setTitle("Booking updated");
        notification.setDescription("Ada updated booking details for Shared Rome.");
        notification.setDetails("Rome · 2026-07-15 → 2026-07-22 · €2000 · Ada");
        notification.setActorEmail("ada@example.com");
        notification.setCreatedAt(OffsetDateTime.parse("2026-07-16T08:15:00Z"));
        return notification;
    }
}
