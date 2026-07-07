package com.sep.friend;

import com.sep.websocket.dto.RealtimeNotificationMessage;
import com.sep.user.AppUser;
import java.time.Instant;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Pushes friend-community notification payloads to the authenticated user queue.
 */
@Service
public class FriendNotificationWebSocketPublisher {

    private static final String NOTIFICATION_DESTINATION = "/queue/notifications";

    private final SimpMessagingTemplate messagingTemplate;

    public FriendNotificationWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishFriendRequestCreated(FriendRequest friendRequest) {
        messagingTemplate.convertAndSendToUser(
                friendRequest.getReceiver().getEmail(),
                NOTIFICATION_DESTINATION,
                notification(
                        "FRIEND_REQUEST_CREATED",
                        friendRequest.getId(),
                        "New friend request",
                        displayName(friendRequest.getSender()) + " sent you a friend request.",
                        null
                )
        );
    }

    public void publishFriendRequestAccepted(FriendRequest friendRequest) {
        publishStatusChange(friendRequest, "FRIEND_REQUEST_ACCEPTED", "accepted");
    }

    public void publishFriendRequestDeclined(FriendRequest friendRequest) {
        publishStatusChange(friendRequest, "FRIEND_REQUEST_DECLINED", "declined");
    }

    private void publishStatusChange(FriendRequest friendRequest, String eventType, String statusLabel) {
        messagingTemplate.convertAndSendToUser(
                friendRequest.getSender().getEmail(),
                NOTIFICATION_DESTINATION,
                notification(
                        eventType,
                        friendRequest.getId(),
                        "Friend request " + statusLabel,
                        displayName(friendRequest.getReceiver()) + " " + statusLabel + " your friend request.",
                        null
                )
        );
    }

    private RealtimeNotificationMessage notification(
            String eventType,
            Long notificationId,
            String title,
            String description,
            String details
    ) {
        return new RealtimeNotificationMessage(
                eventType,
                "FRIEND_REQUEST",
                notificationId,
                title,
                description,
                details,
                Instant.now().toString(),
                null
        );
    }

    private String displayName(AppUser user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String combined = (firstName + " " + lastName).trim();

        if (!combined.isBlank()) {
            return combined;
        }

        return user.getUsername();
    }
}
