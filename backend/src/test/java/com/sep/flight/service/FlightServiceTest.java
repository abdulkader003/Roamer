package com.sep.flight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.flight.dto.flight.FlightOfferDto;
import com.sep.flight.dto.flight.FlightResponse;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.entity.flight.FlightOfferEntity;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FlightServiceTest {

    @Mock
    private AeroDataBoxFlightService aeroDataBoxFlightService;

    @Mock
    private FlightSearchRepository flightSearchRepository;

    @Mock
    private FlightMapper flightMapper;

    @Mock
    private ObjectMapper objectMapper;

    private FlightService flightService;

    @BeforeEach
    void setUp() {
        flightService = new FlightService(
                aeroDataBoxFlightService,
                flightMapper,
                flightSearchRepository,
                objectMapper
        );
    }

    @Test
    void searchFlightsReturnsRecentCachedSearchWhenAvailable() {
        FlightSearchRequest request = oneWayRequest();
        FlightSearchEntity cachedSearch = searchEntity(11L, request);
        cachedSearch.setOffers(List.of(offerEntity("cached")));
        List<FlightOfferDto> cachedDtos = List.of(offerDto("cached", 210));
        FlightResponse expected = response(cachedSearch, List.of(), List.of(), List.of(), cachedDtos);

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("one-way"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.of(cachedSearch));
        when(flightMapper.toDtos(cachedSearch.getOffers())).thenReturn(cachedDtos);
        when(flightMapper.toResponse(cachedSearch, cachedDtos)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository, never()).save(any());
        verifyNoInteractions(aeroDataBoxFlightService);
    }

    @Test
    void searchFlightsFallsBackWhenCachedSearchHasNoOffers() {
        FlightSearchRequest request = oneWayRequest();
        FlightSearchEntity emptyCachedSearch = searchEntity(11L, request);
        emptyCachedSearch.setOffers(List.of());
        FlightSearchEntity savedSearch = searchEntity(22L, request);
        List<FlightOfferDto> outboundOffers = List.of(offerDto("outbound-1", 175));
        List<FlightOfferDto> allOffers = outboundOffers;
        FlightResponse expected = response(savedSearch, outboundOffers, List.of(), List.of(), allOffers);
        JsonNode providerResponse = new ObjectMapper().createObjectNode();

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("one-way"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.of(emptyCachedSearch));
        when(aeroDataBoxFlightService.searchFlights(request)).thenReturn(providerResponse);
        when(flightMapper.fromAeroDataBox(providerResponse, request)).thenReturn(outboundOffers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(any(FlightSearchEntity.class), anyList())).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
    }

    @Test
    void searchFlightsReturnsExactFallbackWhenCityAirportExpansionFindsNoOffers() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                new FlightSearchRequest.AirportDto("CDG", "Paris", "Charles de Gaulle"),
                new FlightSearchRequest.AirportDto("FCO", "Rome", "Fiumicino"),
                LocalDate.of(2026, 9, 12),
                null,
                null,
                true,
                2,
                2,
                0,
                "economy"
        );
        FlightSearchEntity savedSearch = searchEntity(33L, request);
        List<FlightOfferDto> fallbackOffers = List.of(offerDto("fallback-1", 240));
        FlightResponse expected = response(savedSearch, fallbackOffers, List.of(), List.of(), fallbackOffers);
        JsonNode providerResponse = new ObjectMapper().createObjectNode();

        when(aeroDataBoxFlightService.searchFlights(any())).thenReturn(providerResponse);
        when(flightMapper.fromAeroDataBox(eq(providerResponse), any(FlightSearchRequest.class), eq(false))).thenReturn(List.of());
        when(flightMapper.fromAeroDataBox(providerResponse, request)).thenReturn(fallbackOffers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(any(FlightSearchEntity.class), anyList())).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
    }

    @Test
    void searchFlightsReturnsRoundTripResponseWhenProviderSucceeds() {
        FlightSearchRequest request = roundTripRequest();
        FlightSearchRequest returnRequest = new FlightSearchRequest(
                "round-trip",
                request.to(),
                request.from(),
                request.returnDate(),
                null,
                null,
                false,
                request.travelers(),
                request.adults(),
                request.children(),
                request.cabinClass()
        );

        FlightSearchEntity savedSearch = searchEntity(44L, request);
        List<FlightOfferDto> outboundOffers = List.of(offerDto("outbound-1", 190));
        List<FlightOfferDto> returnOffers = List.of(offerDto("return-1", 205));
        List<FlightOfferDto> allOffers = new ArrayList<>();
        allOffers.addAll(outboundOffers);
        allOffers.addAll(returnOffers);
        FlightResponse expected = response(savedSearch, outboundOffers, returnOffers, List.of(), allOffers);
        JsonNode outboundResponse = new ObjectMapper().createObjectNode();
        JsonNode returnResponse = new ObjectMapper().createObjectNode();

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("round-trip"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(LocalDate.of(2026, 8, 21)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(any())).thenReturn(outboundResponse, returnResponse);
        when(flightMapper.fromAeroDataBox(outboundResponse, request)).thenReturn(outboundOffers);
        when(flightMapper.fromAeroDataBox(returnResponse, returnRequest)).thenReturn(returnOffers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(any(FlightSearchEntity.class), anyList())).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(aeroDataBoxFlightService).searchFlights(request);
        verify(aeroDataBoxFlightService).searchFlights(returnRequest);
        verify(flightSearchRepository).save(savedSearch);
    }

    @Test
    void searchFlightsReturnsStaleCacheWhenProviderFails() {
        FlightSearchRequest request = oneWayRequest();
        FlightSearchEntity staleSearch = searchEntity(55L, request);
        staleSearch.setOffers(List.of(offerEntity("stale")));
        List<FlightOfferDto> staleDtos = List.of(offerDto("stale", 150));
        FlightResponse expected = response(staleSearch, staleDtos, List.of(), List.of(), staleDtos);

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("one-way"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.empty());
        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassOrderByCreatedAtDesc(
                "one-way", "DUS", "BCN", LocalDate.of(2026, 8, 14), 2, 0, "economy"
        )).thenReturn(Optional.of(staleSearch));
        when(aeroDataBoxFlightService.searchFlights(request)).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightMapper.toDtos(staleSearch.getOffers())).thenReturn(staleDtos);
        when(flightMapper.toResponse(staleSearch, staleDtos)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository, never()).save(any());
        verifyNoInteractions(objectMapper);
    }

    @Test
    void searchFlightsFallsBackWhenStaleCacheHasNoOffers() {
        FlightSearchRequest request = oneWayRequest();
        FlightSearchEntity staleSearch = searchEntity(56L, request);
        staleSearch.setOffers(List.of());
        FlightSearchEntity savedSearch = searchEntity(57L, request);
        List<FlightOfferDto> estimatedOffers = List.of(offerDto("estimated-empty-cache", 255));
        FlightResponse expected = response(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers);

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("one-way"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.empty());
        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassOrderByCreatedAtDesc(
                "one-way", "DUS", "BCN", LocalDate.of(2026, 8, 14), 2, 0, "economy"
        )).thenReturn(Optional.of(staleSearch));
        when(aeroDataBoxFlightService.searchFlights(request)).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightMapper.fromAeroDataBox(null, request)).thenReturn(estimatedOffers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
        verify(flightMapper).fromAeroDataBox(null, request);
    }

    @Test
    void searchFlightsReturnsEstimatedFallbackForOneWayWhenProviderFails() {
        FlightSearchRequest request = oneWayRequest();
        FlightSearchEntity savedSearch = searchEntity(66L, request);
        List<FlightOfferDto> estimatedOffers = List.of(offerDto("estimated-1", 245));
        FlightResponse expected = response(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers);

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("one-way"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.empty());
        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassOrderByCreatedAtDesc(
                "one-way", "DUS", "BCN", LocalDate.of(2026, 8, 14), 2, 0, "economy"
        )).thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(request)).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightMapper.fromAeroDataBox(null, request)).thenReturn(estimatedOffers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
        verify(flightMapper).fromAeroDataBox(null, request);
    }

    @Test
    void searchFlightsReturnsEstimatedFallbackForRoundTripWhenProviderFails() {
        FlightSearchRequest request = roundTripRequest();
        FlightSearchRequest returnRequest = new FlightSearchRequest(
                "round-trip",
                request.to(),
                request.from(),
                request.returnDate(),
                null,
                null,
                false,
                request.travelers(),
                request.adults(),
                request.children(),
                request.cabinClass()
        );
        FlightSearchEntity savedSearch = searchEntity(77L, request);
        List<FlightOfferDto> outboundEstimated = List.of(offerDto("estimated-outbound", 260));
        List<FlightOfferDto> returnEstimated = List.of(offerDto("estimated-return", 275));
        List<FlightOfferDto> allOffers = new ArrayList<>();
        allOffers.addAll(outboundEstimated);
        allOffers.addAll(returnEstimated);
        FlightResponse expected = response(savedSearch, outboundEstimated, returnEstimated, List.of(), allOffers);

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("round-trip"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(LocalDate.of(2026, 8, 21)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.empty());
        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateAndAdultsAndChildrenAndCabinClassOrderByCreatedAtDesc(
                "round-trip", "DUS", "BCN", LocalDate.of(2026, 8, 14), LocalDate.of(2026, 8, 21), 2, 0, "economy"
        )).thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(request)).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightMapper.fromAeroDataBox(null, request)).thenReturn(outboundEstimated);
        when(flightMapper.fromAeroDataBox(null, returnRequest)).thenReturn(returnEstimated);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(savedSearch, outboundEstimated, returnEstimated, List.of(), allOffers)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
        verify(flightMapper).fromAeroDataBox(null, request);
        verify(flightMapper).fromAeroDataBox(null, returnRequest);
    }

    @Test
    void searchFlightsReturnsEstimatedFallbackWhenCityAirportsProviderFails() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                airport("DUS", "Düsseldorf"),
                airport("AMS", "Amsterdam"),
                LocalDate.of(2026, 10, 12),
                null,
                null,
                true,
                2,
                2,
                0,
                "economy"
        );
        FlightSearchEntity savedSearch = searchEntity(78L, request);
        List<FlightOfferDto> estimatedOffers = List.of(offerDto("city-airport-fallback", 265));
        FlightResponse expected = response(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers);

        when(aeroDataBoxFlightService.searchFlights(any())).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightMapper.fromAeroDataBox(null, request)).thenReturn(estimatedOffers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
        verify(flightMapper).fromAeroDataBox(null, request);
    }

    @Test
    void searchFlightsReturnsEstimatedFallbackWhenCityNamesAreMissing() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                new FlightSearchRequest.AirportDto("DUS", "", ""),
                new FlightSearchRequest.AirportDto("AMS", null, null),
                LocalDate.of(2026, 10, 12),
                null,
                null,
                true,
                2,
                2,
                0,
                "economy"
        );
        FlightSearchEntity savedSearch = searchEntity(79L, request);
        List<FlightOfferDto> estimatedOffers = List.of(offerDto("city-name-missing", 270));
        FlightResponse expected = response(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers);

        when(aeroDataBoxFlightService.searchFlights(any())).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightMapper.fromAeroDataBox(null, request)).thenReturn(estimatedOffers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(savedSearch, estimatedOffers, List.of(), List.of(), estimatedOffers)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
        verify(flightMapper).fromAeroDataBox(null, request);
    }

    @Test
    void searchFlightsRejectsMissingDepartureDateForDirectTrips() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Departure date is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository, flightMapper, objectMapper);
    }

    @Test
    void searchFlightsRejectsMissingOriginCodeForDirectTrips() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                airport("", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Origin airport code is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository, flightMapper, objectMapper);
    }

    @Test
    void searchFlightsRejectsMissingDestinationCodeForDirectTrips() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                airport("DUS", "Düsseldorf"),
                airport("", "Barcelona"),
                LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Destination airport code is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository, flightMapper, objectMapper);
    }

    @Test
    void searchFlightsRejectsNullOriginCodeForDirectTrips() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                airport(null, "Düsseldorf"),
                airport("BCN", "Barcelona"),
                LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Origin airport code is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository, flightMapper, objectMapper);
    }

    @Test
    void searchFlightsRejectsNullDestinationCodeForDirectTrips() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                airport("DUS", "Düsseldorf"),
                airport(null, "Barcelona"),
                LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Destination airport code is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository, flightMapper, objectMapper);
    }

    @Test
    void searchFlightsRejectsTooFewMultiCitySegments() {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                List.of(segment("Düsseldorf (DUS)", "Barcelona (BCN)", LocalDate.of(2026, 8, 14))),
                false,
                2,
                2,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Multi-city flight search requires at least two segments.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository, flightMapper, objectMapper);
    }

    @Test
    void searchFlightsRejectsNullMultiCitySegments() {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Multi-city flight search requires at least two segments.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository, flightMapper, objectMapper);
    }

    @Test
    void searchFlightsRejectsBlankMultiCityAirportCode() {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                List.of(
                        segment("Düsseldorf", "Barcelona (BCN)", LocalDate.of(2026, 8, 14)),
                        segment("Barcelona (BCN)", "Rome (FCO)", LocalDate.of(2026, 8, 20))
                ),
                false,
                2,
                2,
                0,
                "economy"
        );
        when(flightMapper.airportFromText("Düsseldorf")).thenReturn(airport("", "Düsseldorf"));

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Segment 1 requires airport codes, for example Paris (CDG).");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void searchFlightsRejectsBlankMultiCityDestinationAirportCode() {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                List.of(
                        segment("Düsseldorf (DUS)", "Barcelona (BCN)", LocalDate.of(2026, 8, 14)),
                        segment("Barcelona (BCN)", "Rome", LocalDate.of(2026, 8, 20))
                ),
                false,
                2,
                2,
                0,
                "economy"
        );
        when(flightMapper.airportFromText("Düsseldorf (DUS)")).thenReturn(airport("DUS", "Düsseldorf"));
        when(flightMapper.airportFromText("Barcelona (BCN)")).thenReturn(airport("BCN", "Barcelona"));
        when(flightMapper.airportFromText("Rome")).thenReturn(airport("", "Rome"));

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Segment 2 requires airport codes, for example Paris (CDG).");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void searchFlightsRejectsMissingMultiCitySegmentDate() {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                List.of(
                        segment("Düsseldorf (DUS)", "Barcelona (BCN)", null),
                        segment("Barcelona (BCN)", "Rome (FCO)", LocalDate.of(2026, 8, 20))
                ),
                false,
                2,
                2,
                0,
                "economy"
        );
        when(flightMapper.airportFromText("Düsseldorf (DUS)")).thenReturn(airport("DUS", "Düsseldorf"));
        when(flightMapper.airportFromText("Barcelona (BCN)")).thenReturn(airport("BCN", "Barcelona"));

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Segment 1 requires a date.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void searchFlightsReturnsMultiCityResponseWhenProviderSucceeds() throws Exception {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                List.of(
                        segment("Düsseldorf (DUS)", "Barcelona (BCN)", LocalDate.of(2026, 8, 14)),
                        segment("Barcelona (BCN)", "Rome (FCO)", LocalDate.of(2026, 8, 20))
                ),
                false,
                2,
                2,
                0,
                "economy"
        );
        FlightSearchEntity savedSearch = searchEntity(88L, request);
        List<FlightOfferDto> segment1Offers = List.of(offerDto("segment-1", 180));
        List<FlightOfferDto> segment2Offers = List.of(offerDto("segment-2", 205));
        List<FlightOfferDto> allOffers = new ArrayList<>();
        allOffers.addAll(segment1Offers);
        allOffers.addAll(segment2Offers);
        List<FlightResponse.SegmentFlightsDto> segmentFlights = List.of(
                new FlightResponse.SegmentFlightsDto(1, "Düsseldorf (DUS)", "Barcelona (BCN)", LocalDate.of(2026, 8, 14), segment1Offers),
                new FlightResponse.SegmentFlightsDto(2, "Barcelona (BCN)", "Rome (FCO)", LocalDate.of(2026, 8, 20), segment2Offers)
        );
        FlightResponse expected = response(savedSearch, List.of(), List.of(), segmentFlights, allOffers);
        JsonNode firstSegmentResponse = new ObjectMapper().createObjectNode();
        JsonNode secondSegmentResponse = new ObjectMapper().createObjectNode();

        when(objectMapper.writeValueAsString(any())).thenReturn("[]");
        when(flightMapper.airportFromText("Düsseldorf (DUS)")).thenReturn(airport("DUS", "Düsseldorf"));
        when(flightMapper.airportFromText("Barcelona (BCN)")).thenReturn(airport("BCN", "Barcelona"));
        when(flightMapper.airportFromText("Rome (FCO)")).thenReturn(airport("FCO", "Rome"));
        when(aeroDataBoxFlightService.searchFlights(any())).thenReturn(firstSegmentResponse, secondSegmentResponse);
        when(flightMapper.fromAeroDataBox(any(JsonNode.class), any(FlightSearchRequest.class))).thenAnswer(invocation -> {
            FlightSearchRequest segmentRequest = invocation.getArgument(1);
            if (segmentRequest.departureDate().equals(LocalDate.of(2026, 8, 14))) {
                return segment1Offers;
            }
            return segment2Offers;
        });
        when(flightMapper.toSearchEntity(request, "[]")).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(any(FlightSearchEntity.class), anyList(), anyList(), anyList(), anyList())).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
        verify(objectMapper).writeValueAsString(request.multiCitySegments());
    }

    @Test
    void searchFlightsReturnsMultiCityFallbackWhenProviderFails() throws Exception {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                null,
                null,
                List.of(
                        segment("Düsseldorf (DUS)", "Barcelona (BCN)", LocalDate.of(2026, 8, 14)),
                        segment("Barcelona (BCN)", "Rome (FCO)", LocalDate.of(2026, 8, 20))
                ),
                false,
                2,
                2,
                0,
                "economy"
        );
        FlightSearchEntity savedSearch = searchEntity(99L, request);
        List<FlightOfferDto> segment1Fallback = List.of(offerDto("segment-1-fallback", 230));
        List<FlightOfferDto> segment2Fallback = List.of(offerDto("segment-2-fallback", 260));
        List<FlightOfferDto> allOffers = new ArrayList<>();
        allOffers.addAll(segment1Fallback);
        allOffers.addAll(segment2Fallback);
        List<FlightResponse.SegmentFlightsDto> segmentFlights = List.of(
                new FlightResponse.SegmentFlightsDto(1, "Düsseldorf (DUS)", "Barcelona (BCN)", LocalDate.of(2026, 8, 14), segment1Fallback),
                new FlightResponse.SegmentFlightsDto(2, "Barcelona (BCN)", "Rome (FCO)", LocalDate.of(2026, 8, 20), segment2Fallback)
        );
        FlightResponse expected = response(savedSearch, List.of(), List.of(), segmentFlights, allOffers);

        when(objectMapper.writeValueAsString(any())).thenReturn("[]");
        when(flightMapper.airportFromText("Düsseldorf (DUS)")).thenReturn(airport("DUS", "Düsseldorf"));
        when(flightMapper.airportFromText("Barcelona (BCN)")).thenReturn(airport("BCN", "Barcelona"));
        when(flightMapper.airportFromText("Rome (FCO)")).thenReturn(airport("FCO", "Rome"));
        when(aeroDataBoxFlightService.searchFlights(any())).thenThrow(new ExternalApiException("AeroDataBox flights error 429: quota exceeded"));
        when(flightMapper.fromAeroDataBox(isNull(), any(FlightSearchRequest.class))).thenReturn(segment1Fallback, segment2Fallback);
        when(flightMapper.toSearchEntity(request, "[]")).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(any(FlightSearchEntity.class), anyList(), anyList(), anyList(), anyList())).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
    }

    @Test
    void searchFlightsTreatsRoundTripWithoutReturnDateAsOneWay() {
        FlightSearchRequest request = new FlightSearchRequest(
                "round-trip",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
                LocalDate.of(2026, 8, 14),
                null,
                null,
                false,
                2,
                2,
                0,
                "economy"
        );
        FlightSearchEntity savedSearch = searchEntity(112L, request);
        List<FlightOfferDto> offers = List.of(offerDto("round-trip-no-return", 175));
        FlightResponse expected = response(savedSearch, offers, List.of(), List.of(), offers);
        JsonNode providerResponse = new ObjectMapper().createObjectNode();

        when(flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                eq("round-trip"), eq("DUS"), eq("BCN"), eq(LocalDate.of(2026, 8, 14)), eq(2), eq(0), eq("economy"), any()
        )).thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(request)).thenReturn(providerResponse);
        when(flightMapper.fromAeroDataBox(providerResponse, request)).thenReturn(offers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(savedSearch, offers)).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).save(savedSearch);
        verifyNoMoreInteractions(aeroDataBoxFlightService);
    }

    @Test
    void getCachedSearchReturnsMappedResponseWhenSearchExists() {
        FlightSearchEntity search = searchEntity(123L, oneWayRequest());
        search.setOffers(List.of(offerEntity("cached")));
        List<FlightOfferDto> cachedDtos = List.of(offerDto("cached", 210));
        FlightResponse expected = response(search, List.of(), List.of(), List.of(), cachedDtos);

        when(flightSearchRepository.findWithOffersById(123L)).thenReturn(Optional.of(search));
        when(flightMapper.toDtos(search.getOffers())).thenReturn(cachedDtos);
        when(flightMapper.toResponse(search, cachedDtos)).thenReturn(expected);

        FlightResponse response = flightService.getCachedSearch(123L);

        assertThat(response).isEqualTo(expected);
        verify(flightSearchRepository).findWithOffersById(123L);
    }

    @Test
    void getCachedSearchThrowsWhenSearchIsMissing() {
        when(flightSearchRepository.findWithOffersById(123L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> flightService.getCachedSearch(123L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Flight search was not found.");
    }

    @Test
    void searchFlightsUsesCityAirportsOnlyForKnownCities() {
        FlightSearchRequest request = new FlightSearchRequest(
                "one-way",
                airport("DUS", "Düsseldorf"),
                airport("AMS", "Amsterdam"),
                LocalDate.of(2026, 10, 12),
                null,
                null,
                true,
                2,
                2,
                0,
                "economy"
        );
        FlightSearchEntity savedSearch = searchEntity(111L, request);
        List<FlightOfferDto> offers = List.of(offerDto("route-1", 155));
        FlightResponse expected = response(savedSearch, offers, List.of(), List.of(), offers);
        JsonNode providerResponse = new ObjectMapper().createObjectNode();

        when(aeroDataBoxFlightService.searchFlights(any())).thenReturn(providerResponse);
        when(flightMapper.fromAeroDataBox(eq(providerResponse), any(FlightSearchRequest.class), eq(false))).thenReturn(List.of());
        when(flightMapper.fromAeroDataBox(eq(providerResponse), eq(request))).thenReturn(offers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(savedSearch);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), same(savedSearch), anyString())).thenAnswer(invocation -> {
            FlightOfferEntity offer = new FlightOfferEntity();
            offer.setLegType(invocation.getArgument(2));
            return offer;
        });
        when(flightSearchRepository.save(savedSearch)).thenReturn(savedSearch);
        when(flightMapper.toResponse(any(FlightSearchEntity.class), anyList())).thenReturn(expected);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isEqualTo(expected);
    }

    private FlightSearchRequest oneWayRequest() {
        return new FlightSearchRequest(
                "one-way",
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
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
                airport("DUS", "Düsseldorf"),
                airport("BCN", "Barcelona"),
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

    private FlightSearchRequest.MultiCitySegmentDto segment(String fromText, String toText, LocalDate date) {
        return new FlightSearchRequest.MultiCitySegmentDto(fromText, toText, date);
    }

    private FlightSearchRequest.AirportDto airport(String code, String city) {
        return new FlightSearchRequest.AirportDto(code, city, city);
    }

    private FlightSearchEntity searchEntity(Long id, FlightSearchRequest request) {
        FlightSearchEntity search = new FlightSearchEntity();
        try {
            java.lang.reflect.Field idField = FlightSearchEntity.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(search, id);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
        search.setTripType(request.tripType());
        search.setFromCode(request.from().code());
        search.setFromCity(request.from().city());
        search.setFromFullName(request.from().fullName());
        search.setToCode(request.to().code());
        search.setToCity(request.to().city());
        search.setToFullName(request.to().fullName());
        search.setDepartureDate(request.departureDate());
        search.setReturnDate(request.returnDate());
        search.setTravelers(request.travelers());
        search.setAdults(request.adults());
        search.setChildren(request.children());
        search.setCabinClass(request.cabinClass());
        search.setOffers(new ArrayList<>());
        return search;
    }

    private FlightOfferEntity offerEntity(String id) {
        FlightOfferEntity offer = new FlightOfferEntity();
        offer.setExternalOfferId(id);
        offer.setLegType("outbound");
        return offer;
    }

    private FlightOfferDto offerDto(String id, int price) {
        return new FlightOfferDto(
                id,
                "FN-" + id,
                "Offer",
                new FlightOfferDto.AirlineDto("AB", "Airline " + id, "ab"),
                new FlightOfferDto.FlightEndpointDto("08:00", "DUS", "Düsseldorf", "T1"),
                new FlightOfferDto.FlightEndpointDto("10:00", "BCN", "Barcelona", "T2"),
                "PT2H",
                0,
                null,
                price,
                "EUR",
                true,
                false,
                8,
                null,
                new FlightOfferDto.BadgeDto("fastest", "Fastest")
        );
    }

    private FlightResponse response(
            FlightSearchEntity search,
            List<FlightOfferDto> outbound,
            List<FlightOfferDto> returns,
            List<FlightResponse.SegmentFlightsDto> segmentFlights,
            List<FlightOfferDto> flights
    ) {
        return new FlightResponse(
                search.getId(),
                search.getTripType(),
                searchRequestAirport(search.getFromCode(), search.getFromCity(), search.getFromFullName()),
                searchRequestAirport(search.getToCode(), search.getToCity(), search.getToFullName()),
                search.getDepartureDate(),
                search.getReturnDate(),
                List.of(),
                search.getTravelers(),
                search.getAdults(),
                search.getChildren(),
                search.getCabinClass(),
                outbound,
                returns,
                segmentFlights,
                flights
        );
    }

    private FlightSearchRequest.AirportDto searchRequestAirport(String code, String city, String fullName) {
        return new FlightSearchRequest.AirportDto(code, city, fullName);
    }

    private FlightSearchRequest flightServiceRequest(
            String fromText,
            String toText,
            LocalDate date,
            FlightSearchRequest template
    ) {
        return new FlightSearchRequest(
                template.tripType(),
                airportFromText(fromText),
                airportFromText(toText),
                date,
                null,
                null,
                false,
                template.travelers(),
                template.adults(),
                template.children(),
                template.cabinClass()
        );
    }

    private FlightSearchRequest.AirportDto airportFromText(String text) {
        String code = text.substring(text.indexOf('(') + 1, text.indexOf(')'));
        String city = text.substring(0, text.indexOf('(')).trim();
        return new FlightSearchRequest.AirportDto(code, city, city);
    }
}
