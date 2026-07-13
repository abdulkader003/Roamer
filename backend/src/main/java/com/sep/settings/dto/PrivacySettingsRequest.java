package com.sep.settings.dto;

import jakarta.validation.constraints.NotNull;

public record PrivacySettingsRequest(
        @NotNull Boolean shareTripData,
        @NotNull Boolean allowAnalytics
) {
}
