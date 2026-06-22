package com.sep.budget.dto;

import java.math.BigDecimal;

/**
 * Aggregated budget summary across all of the user's trips (User Story #1).
 */
public record BudgetSummaryResponse(
        BigDecimal totalBudget,
        BigDecimal totalSpent,
        BigDecimal remainingBalance,
        int usagePercentage
) {
}
