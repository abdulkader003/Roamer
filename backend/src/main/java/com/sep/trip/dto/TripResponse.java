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
        OffsetDateTime createdAt
) {
}
