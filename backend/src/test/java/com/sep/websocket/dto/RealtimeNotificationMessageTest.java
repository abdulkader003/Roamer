package com.sep.websocket.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RealtimeNotificationMessageTest {

    @Test
    void exposesAllRecordComponents() {
        RealtimeNotificationMessage message = new RealtimeNotificationMessage(
                "TRIP_UPDATE",
                "trip",
                42L,
                "Trip updated",
                "Ali updated Summer Trip.",
                "Budget changed",
                "2026-07-14T15:00:00Z",
                7L,
                "ali@example.com"
        );

        assertThat(message.eventType()).isEqualTo("TRIP_UPDATE");
        assertThat(message.notificationType()).isEqualTo("trip");
        assertThat(message.notificationId()).isEqualTo(42L);
        assertThat(message.title()).isEqualTo("Trip updated");
        assertThat(message.description()).isEqualTo("Ali updated Summer Trip.");
        assertThat(message.details()).isEqualTo("Budget changed");
        assertThat(message.createdAt()).isEqualTo("2026-07-14T15:00:00Z");
        assertThat(message.relatedEntityId()).isEqualTo(7L);
        assertThat(message.actorEmail()).isEqualTo("ali@example.com");
    }
}
