package com.sep.trip;

import com.sep.settings.UserSettings;
import com.sep.settings.UserSettingsRepository;
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
    private static final String TRIP_UPDATE_NOTIFICATION_TYPE = "TRIP_UPDATE";
    private static final AtomicLong EVENT_SEQUENCE = new AtomicLong(Instant.now().toEpochMilli() * 1000);

    private final SimpMessagingTemplate messagingTemplate;
    private final UserSettingsRepository userSettingsRepository;
    private final TripUpdateNotificationRepository tripUpdateNotificationRepository;

    public TripRealtimeWebSocketPublisher(
            SimpMessagingTemplate messagingTemplate,
            UserSettingsRepository userSettingsRepository,
            TripUpdateNotificationRepository tripUpdateNotificationRepository
    ) {
        this.messagingTemplate = messagingTemplate;
        this.userSettingsRepository = userSettingsRepository;
        this.tripUpdateNotificationRepository = tripUpdateNotificationRepository;
    }

    public void publishTripDetailsUpdated(Trip trip, AppUser actor, Collection<AppUser> recipients, boolean bookingChanged) {
        publishTripUpdateToUsers(
                recipients,
                trip,
                bookingChanged ? "TRIP_BOOKING_UPDATED" : "TRIP_DETAILS_UPDATED",
                bookingChanged ? "Booking updated" : "Trip updated",
                bookingChanged
                        ? displayName(actor) + " updated booking details for " + trip.getName() + "."
                        : displayName(actor) + " updated " + trip.getName() + ".",
                tripDetails(trip, actor),
                actor == null ? null : actor.getEmail()
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
                        tripDetails(trip, actor),
                        actor == null ? null : actor.getEmail()
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
                        tripDetails(trip, actor),
                        actor == null ? null : actor.getEmail()
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
                        tripDetails(trip, actor),
                        actor == null ? null : actor.getEmail()
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
                        tripDetails(trip, actor),
                        actor == null ? null : actor.getEmail()
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

    private void publishTripUpdateToUsers(
            Collection<AppUser> recipients,
            Trip trip,
            String eventType,
            String title,
            String description,
            String details,
            String actorEmail
    ) {
        Map<Long, AppUser> recipientsById = uniqueRecipients(recipients);

        for (AppUser recipient : recipientsById.values()) {
            if (recipient.getEmail() == null || recipient.getEmail().isBlank() || !bookingUpdatesEnabled(recipient)) {
                continue;
            }

            TripUpdateNotification savedNotification = saveTripUpdateNotification(
                    trip,
                    recipient,
                    eventType,
                    title,
                    description,
                    details,
                    actorEmail
            );
            messagingTemplate.convertAndSendToUser(
                    recipient.getEmail(),
                    NOTIFICATION_DESTINATION,
                    toRealtimeMessage(savedNotification)
            );
        }
    }

    private void publishToTopic(Long tripId, RealtimeNotificationMessage message) {
        messagingTemplate.convertAndSend("/topic/trips/" + tripId + "/updates", message);
    }

    private Map<Long, AppUser> uniqueRecipients(Collection<AppUser> recipients) {
        Map<Long, AppUser> recipientsById = new LinkedHashMap<>();

        if (recipients != null) {
            for (AppUser recipient : recipients) {
                if (recipient == null || recipient.getId() == null) {
                    continue;
                }

                recipientsById.putIfAbsent(recipient.getId(), recipient);
            }
        }

        return recipientsById;
    }

    private boolean bookingUpdatesEnabled(AppUser recipient) {
        return userSettingsRepository.findByOwnerId(recipient.getId())
                .map(UserSettings::isBookingUpdates)
                .orElse(false);
    }

    private TripUpdateNotification saveTripUpdateNotification(
            Trip trip,
            AppUser recipient,
            String eventType,
            String title,
            String description,
            String details,
            String actorEmail
    ) {
        TripUpdateNotification notification = new TripUpdateNotification();
        notification.setTrip(trip);
        notification.setRecipient(recipient);
        notification.setEventType(eventType);
        notification.setNotificationType(TRIP_UPDATE_NOTIFICATION_TYPE);
        notification.setTitle(title);
        notification.setDescription(description);
        notification.setDetails(details);
        notification.setActorEmail(actorEmail);
        return tripUpdateNotificationRepository.save(notification);
    }

    private RealtimeNotificationMessage toRealtimeMessage(TripUpdateNotification notification) {
        return new RealtimeNotificationMessage(
                notification.getEventType(),
                notification.getNotificationType(),
                notification.getId(),
                notification.getTitle(),
                notification.getDescription(),
                notification.getDetails(),
                notification.getCreatedAt().toString(),
                notification.getTrip().getId(),
                notification.getActorEmail()
        );
    }

    private RealtimeNotificationMessage notification(
            String eventType,
            String notificationType,
            Long tripId,
            String title,
            String description,
            String details,
            String actorEmail
    ) {
        return new RealtimeNotificationMessage(
                eventType,
                notificationType,
                nextEventId(),
                title,
                description,
                details,
                Instant.now().toString(),
                tripId,
                actorEmail
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
