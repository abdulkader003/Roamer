package com.sep.tripplanning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record SelectTripActivitiesRequest(
        @NotNull(message = "Activities list is required")
        List<@Valid SelectedTripActivity> activities
) {
}
