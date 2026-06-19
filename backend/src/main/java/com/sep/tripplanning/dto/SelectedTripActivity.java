package com.sep.tripplanning.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SelectedTripActivity(
        @NotBlank(message = "Activity name is required")
        String name,

        @NotBlank(message = "Activity category is required")
        String category,

        @NotNull(message = "Activity price is required")
        @DecimalMin(value = "0.0", message = "Activity price must not be negative")
        BigDecimal price,

        @NotBlank(message = "Activity duration is required")
        String duration,

        @NotBlank(message = "Activity city is required")
        String city
) {
}
