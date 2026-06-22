package com.sep.budget.dto;

import com.sep.budget.ExpenseCategory;

import java.math.BigDecimal;

/**
 * One category card on the Budget Tracker page (User Story #4).
 */
public record CategoryBudgetResponse(
        ExpenseCategory category,
        BigDecimal spent,
        BigDecimal budget,
        int percentage,
        boolean isNearLimit,
        boolean isOverLimit
) {
}
