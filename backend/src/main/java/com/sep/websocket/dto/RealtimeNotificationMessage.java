package com.sep.websocket.dto;

/**
 * Generic websocket notification payload shared by future real-time features.
 */
public record RealtimeNotificationMessage(
        String eventType,
        String notificationType,
        Long notificationId,
        String title,
        String description,
        String details,
        String createdAt
) {
}
