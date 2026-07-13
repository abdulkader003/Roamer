package com.sep.settings.dto;

public record SettingsPreferencesResponse(
        NotificationSettingsResponse notifications,
        String defaultCalendarView,
        PrivacySettingsResponse privacy
) {
}
