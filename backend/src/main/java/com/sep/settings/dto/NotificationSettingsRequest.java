package com.sep.settings.dto;

import jakarta.validation.constraints.NotNull;

public record NotificationSettingsRequest(
        @NotNull Boolean tripReminders,
        @NotNull Boolean budgetAlerts,
        @NotNull Boolean bookingUpdates
) {
}
