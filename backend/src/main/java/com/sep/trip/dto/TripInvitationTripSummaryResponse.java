package com.sep.trip.dto;

import com.sep.trip.TripStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TripInvitationTripSummaryResponse(
        Long id,
        String name,
        String destination,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal budget,
        TripStatus status
) {
}
