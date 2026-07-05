package com.sep.tripplanning.dto;

import java.math.BigDecimal;
import java.util.List;

public record TripOverviewResponse(
        Long id,
        String tripName,
        BigDecimal budget,
        String currency,
        Integer duration,
        String travelStyle,
        TripHotelResponse selectedHotel,
        String selectedHotelStaysJson,
        List<SelectedTripActivity> selectedActivities,
        BigDecimal totalActivitiesCost
) {
}
