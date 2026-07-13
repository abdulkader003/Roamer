package com.sep.settings.dto;

public record NotificationSettingsResponse(
        boolean tripReminders,
        boolean budgetAlerts,
        boolean bookingUpdates
) {
}
