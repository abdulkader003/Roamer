package com.sep.trip.dto;

import com.sep.trip.TripStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Stable API representation of a trip without exposing the owner entity.
 */
public record TripResponse(
        Long id,
        String name,
        String destination,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal budget,
        TripStatus status,
        OffsetDateTime createdAt,
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
        public TripResponse(
                Long id,
                String name,
                String destination,
                LocalDate startDate,
                LocalDate endDate,
                BigDecimal budget,
                TripStatus status,
                OffsetDateTime createdAt
        ) {
                this(
                        id,
                        name,
                        destination,
                        startDate,
                        endDate,
                        budget,
                        status,
                        createdAt,
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
