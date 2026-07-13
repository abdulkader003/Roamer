package com.sep.flight.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.flight.dto.flight.FlightResponse;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.entity.flight.FlightSearchEntity;
import com.sep.flight.exception.ExternalApiException;
import com.sep.flight.mapper.FlightMapper;
import com.sep.flight.repository.flight.FlightSearchRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FlightServiceTest {

    @Mock
    private AeroDataBoxFlightService aeroDataBoxFlightService;

    @Mock
    private FlightSearchRepository flightSearchRepository;

    private FlightService flightService;

    @BeforeEach
    void setUp() {
        FlightMapper flightMapper = new FlightMapper(new ObjectMapper());
        flightService = new FlightService(
                aeroDataBoxFlightService,
                flightMapper,
                flightSearchRepository,
                new ObjectMapper()
        );
    }

    @Test
    void searchFlightsReturnsEstimatedFallbackWhenAeroDataBoxQuotaIsExceeded() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                new FlightSearchRequest.AirportDto("DUS", "Düsseldorf", "Düsseldorf Intl."),
                new FlightSearchRequest.AirportDto("BCN", "Barcelona", "Barcelona-El Prat"),
                LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("one-way"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.empty());
        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassOrderByCreatedAtDesc(
                "one-way", "DUS", "BCN", LocalDate.of(2026, 8, 14), 2, 0, "economy"
        )).thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(request))
                .thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightSearchRepository.save(any(FlightSearchEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response.outboundFlights()).isNotEmpty();
        assertThat(response.outboundFlights().getFirst().status()).isEqualTo("Estimated");
        assertThat(response.outboundFlights().getFirst().departure().airport()).isEqualTo("DUS");
        assertThat(response.outboundFlights().getFirst().arrival().airport()).isEqualTo("BCN");
    }
}
