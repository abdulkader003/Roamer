package com.sep.flight.dto.flight;

import java.time.LocalDate;
import java.util.List;

public record FlightResponse(
        Long searchId,
        String tripType,
        FlightSearchRequest.AirportDto from,
        FlightSearchRequest.AirportDto to,
        LocalDate departureDate,
        LocalDate returnDate,
        List<FlightSearchRequest.MultiCitySegmentDto> multiCitySegments,
        Integer travelers,
        Integer adults,
        Integer children,
        String cabinClass,
        List<FlightOfferDto> outboundFlights,
        List<FlightOfferDto> returnFlights,
        List<SegmentFlightsDto> segmentFlights,
        List<FlightOfferDto> flights
) {
    public record SegmentFlightsDto(
            Integer segmentIndex,
            String fromText,
            String toText,
            LocalDate date,
            List<FlightOfferDto> flights
    ) {
    }
}
