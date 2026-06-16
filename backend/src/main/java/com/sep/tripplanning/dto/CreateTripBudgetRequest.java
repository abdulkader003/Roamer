package com.sep.tripplanning.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public record CreateTripBudgetRequest(
        @NotBlank(message = "Trip name is required")
        String tripName,

        @NotNull(message = "Budget is required")
        @DecimalMin(value = "0.0", inclusive = false, message = "Budget must be greater than 0")
        BigDecimal budget,

        @NotBlank(message = "Currency is required")
        @Pattern(regexp = "EUR|USD", message = "Currency must be EUR or USD")
        String currency,

        @NotNull(message = "Duration is required")
        @Min(value = 1, message = "Duration must be at least 1")
        Integer duration,

        @NotBlank(message = "Travel style is required")
        @Pattern(regexp = "Budget|Mid-range|Luxury", message = "Travel style must be Budget, Mid-range or Luxury")
        String travelStyle
) {
}
