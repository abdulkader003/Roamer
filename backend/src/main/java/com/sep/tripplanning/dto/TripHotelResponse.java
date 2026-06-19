package com.sep.tripplanning.dto;

import java.math.BigDecimal;

public record TripHotelResponse(
        Long tripPlanningId,
        Long hotelId,
        String hotelName,
        String hotelCity,
        BigDecimal pricePerNight,
        Integer stars,
        Double ratingScore,
        String ratingLabel
) {
}
