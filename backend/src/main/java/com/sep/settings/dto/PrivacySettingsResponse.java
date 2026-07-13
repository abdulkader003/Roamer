package com.sep.settings.dto;

public record PrivacySettingsResponse(
        boolean shareTripData,
        boolean allowAnalytics
) {
}
