package com.sep.flight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sep.flight.client.AeroDataBoxClient;
import com.sep.flight.dto.flight.FlightSearchRequest;
import org.springframework.stereotype.Service;

@Service
public class AeroDataBoxFlightService {
    private final AeroDataBoxClient aeroDataBoxClient;

    public AeroDataBoxFlightService(AeroDataBoxClient aeroDataBoxClient) {
        this.aeroDataBoxClient = aeroDataBoxClient;
    }

    public JsonNode searchFlights(FlightSearchRequest request) {
        return aeroDataBoxClient.searchFlights(request);
    }
}
