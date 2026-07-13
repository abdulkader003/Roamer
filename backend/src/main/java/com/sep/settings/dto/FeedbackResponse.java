package com.sep.settings.dto;

import java.time.Instant;

public record FeedbackResponse(
        Long id,
        int rating,
        String emoji,
        String message,
        Instant submittedAt
) {
}
