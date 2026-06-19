package com.sep.tripplanning.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record SelectTripHotelRequest(
        @NotNull(message = "Hotel id is required")
        @Positive(message = "Hotel id must be positive")
        Long hotelId
) {
}
