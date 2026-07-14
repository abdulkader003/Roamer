package com.sep.settings.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateSettingsRequest(
        @Valid @NotNull NotificationSettingsRequest notifications,
        @NotBlank String defaultCalendarView,
        @Valid @NotNull PrivacySettingsRequest privacy
) {
}
