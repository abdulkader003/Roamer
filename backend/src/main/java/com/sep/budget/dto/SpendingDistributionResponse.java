package com.sep.budget.dto;

import com.sep.budget.ExpenseCategory;

import java.math.BigDecimal;

/**
 * One segment of the spending distribution donut chart (User Story #3).
 */
public record SpendingDistributionResponse(
        ExpenseCategory category,
        BigDecimal amount,
        int percentage
) {
}
