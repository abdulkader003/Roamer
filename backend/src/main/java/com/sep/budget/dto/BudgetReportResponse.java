package com.sep.budget.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Complete budget report payload for export (User Story #7).
 */
public record BudgetReportResponse(
        BigDecimal totalBudget,
        BigDecimal totalSpent,
        BigDecimal remainingBalance,
        int usagePercentage,
        List<CategoryBudgetResponse> categories,
        List<TripBudgetRowResponse> trips
) {
}
