package com.sep.trip;

import com.sep.websocket.dto.RealtimeNotificationMessage;
import java.time.Instant;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Pushes trip-invitation notification payloads to the authenticated user queue.
 */
@Service
public class TripNotificationWebSocketPublisher {

    private static final String NOTIFICATION_DESTINATION = "/queue/notifications";

    private final SimpMessagingTemplate messagingTemplate;

    public TripNotificationWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishTripInvitationCreated(TripInvitation invitation) {
        messagingTemplate.convertAndSendToUser(
                invitation.getInvitedUser().getEmail(),
                NOTIFICATION_DESTINATION,
                notification(
                        "TRIP_INVITATION_CREATED",
                        "TRIP_INVITATION",
                        invitation.getId(),
                        "Trip invitation",
                        displayName(invitation.getInvitedBy()) + " invited you to " + invitation.getTrip().getName() + ".",
                        formatTripDetails(invitation),
                        invitation.getTrip().getId()
                )
        );
    }

    public void publishTripInvitationAccepted(TripInvitation invitation) {
        publishTripInvitationResponse(invitation, "TRIP_INVITATION_ACCEPTED", "accepted");
    }

    public void publishTripInvitationDeclined(TripInvitation invitation) {
        publishTripInvitationResponse(invitation, "TRIP_INVITATION_DECLINED", "declined");
    }

    private void publishTripInvitationResponse(TripInvitation invitation, String eventType, String statusLabel) {
        messagingTemplate.convertAndSendToUser(
                invitation.getInvitedBy().getEmail(),
                NOTIFICATION_DESTINATION,
                notification(
                        eventType,
                        "TRIP_INVITATION_RESPONSE",
                        invitation.getId(),
                        "Trip invite " + statusLabel,
                        displayName(invitation.getInvitedUser()) + " " + statusLabel + " your invitation to " + invitation.getTrip().getName() + ".",
                        formatTripDetails(invitation),
                        invitation.getTrip().getId()
                )
        );
    }

    private RealtimeNotificationMessage notification(
            String eventType,
            String notificationType,
            Long notificationId,
            String title,
            String description,
            String details,
            Long relatedEntityId
    ) {
        return new RealtimeNotificationMessage(
                eventType,
                notificationType,
                notificationId,
                title,
                description,
                details,
                Instant.now().toString(),
                relatedEntityId
        );
    }

    private String displayName(com.sep.user.AppUser user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String combined = (firstName + " " + lastName).trim();
        return combined.isBlank() ? user.getUsername() : combined;
    }

    private String formatTripDetails(TripInvitation invitation) {
        return invitation.getTrip().getDestination()
                + " · "
                + invitation.getTrip().getStartDate()
                + " → "
                + invitation.getTrip().getEndDate()
                + " · €"
                + invitation.getTrip().getBudget()
                + " · "
                + invitation.getInvitedBy().getUsername();
    }
}
