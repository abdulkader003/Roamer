package com.sep.budget.dto;

import com.sep.budget.ExpenseCategory;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Stable API representation of a logged expense.
 */
public record ExpenseResponse(
        Long id,
        Long tripId,
        ExpenseCategory category,
        BigDecimal amount,
        String description,
        LocalDate date
) {
}
