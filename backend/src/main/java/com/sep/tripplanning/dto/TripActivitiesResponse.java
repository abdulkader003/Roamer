package com.sep.tripplanning.dto;

import java.math.BigDecimal;
import java.util.List;

public record TripActivitiesResponse(
        Long tripPlanningId,
        List<SelectedTripActivity> selectedActivities,
        BigDecimal totalActivitiesCost,
        int selectedActivitiesCount
) {
}
