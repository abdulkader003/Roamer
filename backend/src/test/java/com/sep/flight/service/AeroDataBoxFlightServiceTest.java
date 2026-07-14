package com.sep.flight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sep.flight.client.AeroDataBoxClient;
import com.sep.flight.dto.flight.FlightSearchRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AeroDataBoxFlightServiceTest {

    @Test
    void searchFlightsDelegatesToClient() {
        AeroDataBoxClient client = mock(AeroDataBoxClient.class);
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                new FlightSearchRequest.AirportDto("DUS", "Düsseldorf", "Düsseldorf Intl."),
                new FlightSearchRequest.AirportDto("BCN", "Barcelona", "Barcelona-El Prat"),
                java.time.LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );
        JsonNode response = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
        when(client.searchFlights(request)).thenReturn(response);

        AeroDataBoxFlightService service = new AeroDataBoxFlightService(client);
        JsonNode result = service.searchFlights(request);

        assertThat(result).isSameAs(response);
        verify(client).searchFlights(request);
    }
}
