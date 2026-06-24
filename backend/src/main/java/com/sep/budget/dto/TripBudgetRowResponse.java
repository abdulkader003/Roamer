package com.sep.budget.dto;

import java.math.BigDecimal;

/**
 * One row in the Recent Trip Budgets table (User Story #6).
 */
public record TripBudgetRowResponse(
        Long tripId,
        String name,
        String destination,
        BigDecimal budget,
        BigDecimal spent,
        BigDecimal remaining,
        String status,
        BigDecimal flightTotal,
        BigDecimal hotelTotal,
        BigDecimal foodTotal,
        BigDecimal transportTotal,
        BigDecimal activitiesTotal,
        BigDecimal othersTotal
) {
}
