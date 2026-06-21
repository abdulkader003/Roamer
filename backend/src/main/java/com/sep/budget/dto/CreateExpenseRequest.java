package com.sep.budget.dto;

import com.sep.budget.ExpenseCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Payload for logging a new manual expense (User Story #5).
 */
public record CreateExpenseRequest(
        @NotNull
        Long tripId,

        @NotNull
        ExpenseCategory category,

        @NotNull
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero.")
        @Digits(integer = 10, fraction = 2, message = "Amount must have at most 10 integer digits and 2 decimal places.")
        BigDecimal amount,

        @Size(max = 255, message = "Description must be 255 characters or fewer.")
        String description,

        @NotNull
        LocalDate date
) {
}
