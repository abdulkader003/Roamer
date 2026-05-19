package com.sep.flight_backend.dto.flight;

public record FlightOfferDto(
        String id,
        String flightNumber,
        String status,
        AirlineDto airline,
        FlightEndpointDto departure,
        FlightEndpointDto arrival,
        String duration,
        Integer stops,
        String stopDetails,
        Integer price,
        String currency,
        Boolean carryOnIncluded,
        Boolean checkedBagIncluded,
        Integer carryOnWeightKg,
        Integer checkedBagWeightKg,
        BadgeDto badge
) {
    public record AirlineDto(
            String code,
            String name,
            String colorClass
    ) {
    }

    public record FlightEndpointDto(
        String time,
        String airport,
        String city,
        String terminal
    ) {
    }

    public record BadgeDto(
            String type,
            String label
    ) {
    }
}
