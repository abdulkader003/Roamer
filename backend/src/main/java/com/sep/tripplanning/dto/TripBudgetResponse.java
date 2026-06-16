package com.sep.tripplanning.dto;

import java.math.BigDecimal;

public record TripBudgetResponse(
        Long id,
        String tripName,
        BigDecimal budget,
        String currency,
        Integer duration,
        String travelStyle
) {
}
