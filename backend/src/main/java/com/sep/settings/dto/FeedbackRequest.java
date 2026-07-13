package com.sep.settings.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record FeedbackRequest(
        @Min(1) @Max(5) int rating,
        @Size(max = 32) String emoji,
        @Size(max = 2000) String message,
        Instant submittedAt
) {
}
