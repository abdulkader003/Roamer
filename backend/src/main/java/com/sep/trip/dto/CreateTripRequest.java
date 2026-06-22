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
        TripStatus status,

        Long tripPlanningId,
        String origin,
        String destinationCities,
        String currency,
        Integer durationNights,
        String travelStyle,
        Integer travelers,
        String flightId,
        String flightTitle,
        String flightAirline,
        String flightNumber,
        String flightDepartureTime,
        String flightArrivalTime,
        String flightDuration,
        String flightStops,
        String flightDetails,
        BigDecimal flightTotal,
        String hotelName,
        String hotelCity,
        Integer hotelStars,
        String hotelDetails,
        BigDecimal hotelTotal,
        String activitiesTitle,
        String activitiesDetails,
        String activitiesJson,
        BigDecimal activitiesTotal
) {
        public CreateTripRequest(
                String name,
                String destination,
                LocalDate startDate,
                LocalDate endDate,
                BigDecimal budget,
                TripStatus status
        ) {
                this(
                        name,
                        destination,
                        startDate,
                        endDate,
                        budget,
                        status,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                );
        }
}
