package com.sep.trip;

import com.sep.user.AppUser;
import com.sep.websocket.dto.RealtimeNotificationMessage;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class TripReminderNotificationWebSocketPublisher {

    private static final String NOTIFICATION_DESTINATION = "/queue/notifications";

    private final SimpMessagingTemplate messagingTemplate;

    public TripReminderNotificationWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishTripReminder(TripReminderNotification reminder) {
        AppUser recipient = reminder.getRecipient();

        if (recipient == null || recipient.getEmail() == null || recipient.getEmail().isBlank()) {
            return;
        }

        Trip trip = reminder.getTrip();
        messagingTemplate.convertAndSendToUser(
                recipient.getEmail(),
                NOTIFICATION_DESTINATION,
                new RealtimeNotificationMessage(
                        "TRIP_REMINDER_DUE",
                        "TRIP_REMINDER",
                        reminder.getId(),
                        "Trip reminder",
                        trip.getName() + " starts in 10 days.",
                        trip.getDestination() + " · " + trip.getStartDate() + " → " + trip.getEndDate(),
                        Instant.now().toString(),
                        trip.getId(),
                        null
                )
        );
    }
}
