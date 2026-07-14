package com.sep.flight.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.flight.dto.flight.FlightOfferDto;
import com.sep.flight.dto.flight.FlightResponse;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.exception.ExternalApiException;
import com.sep.flight.exception.GlobalExceptionHandler;
import com.sep.flight.service.FlightService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FlightControllerTest {

    @Mock
    private FlightService flightService;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private FlightController flightController;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        flightController = new FlightController(flightService);
        mockMvc = MockMvcBuilders.standaloneSetup(flightController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void searchFlightsReturnsServiceResponseForValidBody() throws Exception {
        FlightSearchRequest request = roundTripRequest();
        FlightResponse response = flightResponse();
        when(flightService.searchFlights(request)).thenReturn(response);

        mockMvc.perform(post("/api/flights")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.searchId").value(11))
                .andExpect(jsonPath("$.tripType").value("round-trip"))
                .andExpect(jsonPath("$.from.code").value("DUS"))
                .andExpect(jsonPath("$.to.code").value("BCN"))
                .andExpect(jsonPath("$.departureDate").value(anyOf(is("2026-08-14"), is(List.of(2026, 8, 14)))))
                .andExpect(jsonPath("$.returnDate").value(anyOf(is("2026-08-21"), is(List.of(2026, 8, 21)))))
                .andExpect(jsonPath("$.travelers").value(2))
                .andExpect(jsonPath("$.outboundFlights[0].id").value("outbound-1"));

        verify(flightService).searchFlights(request);
    }

    @Test
    void searchFlightsRejectsInvalidBodyBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/flights")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "from": {"code":"DUS","city":"Duesseldorf","fullName":"Dusseldorf Airport"},
                                  "to": {"code":"BCN","city":"Barcelona","fullName":"Barcelona El Prat"},
                                  "departureDate":"2026-08-14",
                                  "cabinClass":"economy"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(flightService);
    }

    @Test
    void searchFlightsRejectsMalformedRequestBodyBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/flights")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(flightService);
    }

    @Test
    void searchFlightsMapsServiceExceptionToBadGateway() throws Exception {
        FlightSearchRequest request = oneWayRequest();
        when(flightService.searchFlights(request)).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));

        mockMvc.perform(post("/api/flights")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.detail").value("AeroDataBox flights error 429: quota exceeded"));

        verify(flightService).searchFlights(request);
    }

    @Test
    void getCachedSearchReturnsServiceResponse() throws Exception {
        FlightResponse response = flightResponse();
        when(flightService.getCachedSearch(11L)).thenReturn(response);

        mockMvc.perform(get("/api/flights/searches/11"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.searchId").value(11))
                .andExpect(jsonPath("$.tripType").value("round-trip"));

        verify(flightService).getCachedSearch(11L);
    }

    @Test
    void getCachedSearchMapsNotFoundToBadRequest() throws Exception {
        when(flightService.getCachedSearch(11L)).thenThrow(new IllegalArgumentException("Flight search was not found."));

        mockMvc.perform(get("/api/flights/searches/11"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Flight search was not found."));

        verify(flightService).getCachedSearch(11L);
    }

    @Test
    void getCachedSearchRejectsInvalidPathVariableBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/flights/searches/not-a-number"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(flightService);
    }

    private FlightSearchRequest oneWayRequest() {
        return new FlightSearchRequest(
                "one-way",
                new FlightSearchRequest.AirportDto("DUS", "Duesseldorf", "Dusseldorf Airport"),
                new FlightSearchRequest.AirportDto("BCN", "Barcelona", "Barcelona El Prat"),
                LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );
    }

    private FlightSearchRequest roundTripRequest() {
        return new FlightSearchRequest(
                "round-trip",
                new FlightSearchRequest.AirportDto("DUS", "Duesseldorf", "Dusseldorf Airport"),
                new FlightSearchRequest.AirportDto("BCN", "Barcelona", "Barcelona El Prat"),
                LocalDate.of(2026, 8, 14),
                LocalDate.of(2026, 8, 21),
                null,
                false,
                2,
                2,
                0,
                "economy"
        );
    }

    private FlightResponse flightResponse() {
        FlightOfferDto outbound = new FlightOfferDto(
                "outbound-1",
                "A1 123",
                "scheduled",
                new FlightOfferDto.AirlineDto("A1", "Air One", "air-one"),
                new FlightOfferDto.FlightEndpointDto("08:00", "Dusseldorf Airport", "Duesseldorf", "1"),
                new FlightOfferDto.FlightEndpointDto("10:00", "Barcelona El Prat", "Barcelona", "2"),
                "2h",
                0,
                null,
                120,
                "EUR",
                true,
                true,
                8,
                23,
                new FlightOfferDto.BadgeDto("best", "Best choice")
        );
        return new FlightResponse(
                11L,
                "round-trip",
                new FlightSearchRequest.AirportDto("DUS", "Duesseldorf", "Dusseldorf Airport"),
                new FlightSearchRequest.AirportDto("BCN", "Barcelona", "Barcelona El Prat"),
                LocalDate.of(2026, 8, 14),
                LocalDate.of(2026, 8, 21),
                List.of(),
                2,
                2,
                0,
                "economy",
                List.of(outbound),
                List.of(),
                List.of(),
                List.of(outbound)
        );
    }
}
