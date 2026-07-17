package com.sep.trip;

import com.sep.settings.UserSettings;
import com.sep.settings.UserSettingsRepository;
import com.sep.user.AppUser;
import com.sep.websocket.dto.RealtimeNotificationMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripRealtimeWebSocketPublisherTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private UserSettingsRepository userSettingsRepository;

    @Mock
    private TripUpdateNotificationRepository tripUpdateNotificationRepository;

    @Test
    void tripUpdatesArePersistedAndSentOnlyToRecipientsWithBookingUpdatesEnabled() {
        TripRealtimeWebSocketPublisher publisher = new TripRealtimeWebSocketPublisher(
                messagingTemplate,
                userSettingsRepository,
                tripUpdateNotificationRepository
        );
        Trip trip = trip();
        AppUser actor = user(1L, "actor@example.com");
        AppUser enabledRecipient = user(2L, "enabled@example.com");
        AppUser disabledRecipient = user(3L, "disabled@example.com");

        when(userSettingsRepository.findByOwnerId(2L)).thenReturn(Optional.of(settings(true)));
        when(userSettingsRepository.findByOwnerId(3L)).thenReturn(Optional.of(settings(false)));
        when(tripUpdateNotificationRepository.save(any(TripUpdateNotification.class))).thenAnswer(invocation -> {
            TripUpdateNotification notification = invocation.getArgument(0);
            notification.setCreatedAt(OffsetDateTime.parse("2026-07-16T08:15:00Z"));
            return notification;
        });

        publisher.publishTripDetailsUpdated(trip, actor, List.of(enabledRecipient, disabledRecipient), false);

        ArgumentCaptor<TripUpdateNotification> notificationCaptor = ArgumentCaptor.forClass(TripUpdateNotification.class);
        verify(tripUpdateNotificationRepository).save(notificationCaptor.capture());
        assertThat(notificationCaptor.getValue().getRecipient().getEmail()).isEqualTo("enabled@example.com");
        assertThat(notificationCaptor.getValue().getEventType()).isEqualTo("TRIP_DETAILS_UPDATED");
        assertThat(notificationCaptor.getValue().getNotificationType()).isEqualTo("TRIP_UPDATE");

        verify(messagingTemplate).convertAndSendToUser(
                eq("enabled@example.com"),
                eq("/queue/notifications"),
                any(RealtimeNotificationMessage.class)
        );
        verify(messagingTemplate, never()).convertAndSendToUser(
                eq("disabled@example.com"),
                eq("/queue/notifications"),
                any()
        );
    }

    @Test
    void bookingChangesUseBookingUpdatedEventType() {
        TripRealtimeWebSocketPublisher publisher = new TripRealtimeWebSocketPublisher(
                messagingTemplate,
                userSettingsRepository,
                tripUpdateNotificationRepository
        );
        AppUser recipient = user(2L, "enabled@example.com");

        when(userSettingsRepository.findByOwnerId(2L)).thenReturn(Optional.of(settings(true)));
        when(tripUpdateNotificationRepository.save(any(TripUpdateNotification.class))).thenAnswer(invocation -> {
            TripUpdateNotification notification = invocation.getArgument(0);
            notification.setCreatedAt(OffsetDateTime.parse("2026-07-16T08:15:00Z"));
            return notification;
        });

        publisher.publishTripDetailsUpdated(trip(), user(1L, "actor@example.com"), List.of(recipient), true);

        ArgumentCaptor<TripUpdateNotification> notificationCaptor = ArgumentCaptor.forClass(TripUpdateNotification.class);
        verify(tripUpdateNotificationRepository).save(notificationCaptor.capture());
        assertThat(notificationCaptor.getValue().getEventType()).isEqualTo("TRIP_BOOKING_UPDATED");
        assertThat(notificationCaptor.getValue().getTitle()).isEqualTo("Booking updated");
    }

    private Trip trip() {
        Trip trip = new Trip();
        trip.setId(10L);
        trip.setName("Shared Rome");
        trip.setDestination("Rome");
        trip.setStartDate(LocalDate.of(2026, 7, 15));
        trip.setEndDate(LocalDate.of(2026, 7, 22));
        trip.setBudget(new BigDecimal("2000.00"));
        return trip;
    }

    private AppUser user(Long id, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setUsername(email.substring(0, email.indexOf('@')));
        return user;
    }

    private UserSettings settings(boolean bookingUpdates) {
        UserSettings settings = new UserSettings();
        settings.setBookingUpdates(bookingUpdates);
        return settings;
    }
}
