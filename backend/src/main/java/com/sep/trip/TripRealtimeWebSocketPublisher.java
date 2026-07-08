package com.sep.trip;

import com.sep.user.AppUser;
import com.sep.websocket.dto.RealtimeNotificationMessage;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Publishes shared-trip change notifications to the authenticated user queue.
 */
@Service
public class TripRealtimeWebSocketPublisher {

    private static final String NOTIFICATION_DESTINATION = "/queue/notifications";
    private static final AtomicLong EVENT_SEQUENCE = new AtomicLong(Instant.now().toEpochMilli() * 1000);

    private final SimpMessagingTemplate messagingTemplate;

    public TripRealtimeWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishTripDetailsUpdated(Trip trip, AppUser actor, Collection<AppUser> recipients) {
        publishToUsers(
                recipients,
                notification(
                        "TRIP_DETAILS_UPDATED",
                        "TRIP_UPDATE",
                        trip.getId(),
                        "Trip updated",
                        displayName(actor) + " updated " + trip.getName() + ".",
                        tripDetails(trip, actor)
                )
        );
    }

    public void publishTripDetailsUpdatedTopic(Trip trip, AppUser actor) {
        publishToTopic(
                trip.getId(),
                notification(
                        "TRIP_DETAILS_UPDATED",
                        "TRIP_UPDATE",
                        trip.getId(),
                        "Trip updated",
                        displayName(actor) + " updated " + trip.getName() + ".",
                        tripDetails(trip, actor)
                )
        );
    }

    public void publishTripParticipantJoined(Trip trip, AppUser actor, Collection<AppUser> recipients) {
        publishToUsers(
                recipients,
                notification(
                        "TRIP_PARTICIPANT_JOINED",
                        "TRIP_PARTICIPANT_JOINED",
                        trip.getId(),
                        "Trip participants updated",
                        displayName(actor) + " joined " + trip.getName() + ".",
                        tripDetails(trip, actor)
                )
        );
    }

    public void publishTripParticipantJoinedTopic(Trip trip, AppUser actor) {
        publishToTopic(
                trip.getId(),
                notification(
                        "TRIP_PARTICIPANT_JOINED",
                        "TRIP_PARTICIPANT_JOINED",
                        trip.getId(),
                        "Trip participants updated",
                        displayName(actor) + " joined " + trip.getName() + ".",
                        tripDetails(trip, actor)
                )
        );
    }

    public void publishTripParticipantLeft(Trip trip, AppUser actor, Collection<AppUser> recipients) {
        publishToUsers(
                recipients,
                notification(
                        "TRIP_PARTICIPANT_LEFT",
                        "TRIP_PARTICIPANT_LEFT",
                        trip.getId(),
                        "Trip participants updated",
                        displayName(actor) + " left " + trip.getName() + ".",
                        tripDetails(trip, actor)
                )
        );
    }

    public void publishTripParticipantLeftTopic(Trip trip, AppUser actor) {
        publishToTopic(
                trip.getId(),
                notification(
                        "TRIP_PARTICIPANT_LEFT",
                        "TRIP_PARTICIPANT_LEFT",
                        trip.getId(),
                        "Trip participants updated",
                        displayName(actor) + " left " + trip.getName() + ".",
                        tripDetails(trip, actor)
                )
        );
    }

    private void publishToUsers(Collection<AppUser> recipients, RealtimeNotificationMessage message) {
        Map<Long, AppUser> recipientsById = new LinkedHashMap<>();

        if (recipients != null) {
            for (AppUser recipient : recipients) {
                if (recipient == null || recipient.getId() == null) {
                    continue;
                }

                recipientsById.putIfAbsent(recipient.getId(), recipient);
            }
        }

        for (AppUser recipient : recipientsById.values()) {
            if (recipient.getEmail() == null || recipient.getEmail().isBlank()) {
                continue;
            }

            messagingTemplate.convertAndSendToUser(recipient.getEmail(), NOTIFICATION_DESTINATION, message);
        }
    }

    private void publishToTopic(Long tripId, RealtimeNotificationMessage message) {
        messagingTemplate.convertAndSend("/topic/trips/" + tripId + "/updates", message);
    }

    private RealtimeNotificationMessage notification(
            String eventType,
            String notificationType,
            Long tripId,
            String title,
            String description,
            String details
    ) {
        return new RealtimeNotificationMessage(
                eventType,
                notificationType,
                nextEventId(),
                title,
                description,
                details,
                Instant.now().toString(),
                tripId
        );
    }

    private long nextEventId() {
        return EVENT_SEQUENCE.getAndIncrement();
    }

    private String tripDetails(Trip trip, AppUser actor) {
        return trip.getDestination()
                + " · "
                + trip.getStartDate()
                + " → "
                + trip.getEndDate()
                + " · €"
                + bigDecimalValue(trip.getBudget())
                + " · "
                + displayName(actor);
    }

    private String displayName(AppUser user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String combined = (firstName + " " + lastName).trim();
        return combined.isBlank() ? user.getUsername() : combined;
    }

    private String bigDecimalValue(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }
}
