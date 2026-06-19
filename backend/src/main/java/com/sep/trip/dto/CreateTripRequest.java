package com.sep.trip.dto;

import com.sep.trip.TripStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Client-editable fields accepted when a trip is created.
 *
 * <p>Ownership is intentionally absent; it is derived from the authenticated JWT.</p>
 */
public record CreateTripRequest(
        @NotBlank(message = "Trip name is required")
        @Size(max = 120, message = "Trip name must be 120 characters or fewer")
        String name,

        @NotBlank(message = "Destination is required")
        @Size(max = 120, message = "Destination must be 120 characters or fewer")
        String destination,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate,

        @NotNull(message = "Budget is required")
        @DecimalMin(value = "0.0", inclusive = true, message = "Budget cannot be negative")
        BigDecimal budget,

        @NotNull(message = "Trip status is required")
        TripStatus status
) {
}
