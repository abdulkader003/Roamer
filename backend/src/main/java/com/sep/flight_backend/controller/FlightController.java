package com.sep.flight_backend.controller;

import com.sep.flight_backend.dto.flight.FlightResponse;
import com.sep.flight_backend.dto.flight.FlightSearchRequest;
import com.sep.flight_backend.service.FlightService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/flights")
public class FlightController {
    private final FlightService flightService;

    public FlightController(FlightService flightService) {
        this.flightService = flightService;
    }

    @PostMapping
    public FlightResponse searchFlights(@Valid @RequestBody FlightSearchRequest request) {
        return flightService.searchFlights(request);
    }
}
