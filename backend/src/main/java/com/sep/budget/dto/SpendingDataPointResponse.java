package com.sep.budget.dto;

import java.math.BigDecimal;

/**
 * One data point on the spending overview chart (User Story #2).
 */
public record SpendingDataPointResponse(
        String label,
        BigDecimal amount
) {
}
