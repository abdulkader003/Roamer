package com.sep.budget.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Payload for updating a saved category budget.
 */
public record UpdateCategoryBudgetRequest(
        @NotNull
        @DecimalMin(value = "0.00", message = "Budget must be zero or greater.")
        @Digits(integer = 10, fraction = 2, message = "Budget must have at most 10 integer digits and 2 decimal places.")
        BigDecimal budget
) {
}
