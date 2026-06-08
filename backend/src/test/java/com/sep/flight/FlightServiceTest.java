package com.sep.flight;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sep.flight.dto.flight.FlightOfferDto;
import com.sep.flight.dto.flight.FlightResponse;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.entity.flight.FlightOfferEntity;
import com.sep.flight.entity.flight.FlightSearchEntity;
import com.sep.flight.exception.ExternalApiException;
import com.sep.flight.mapper.FlightMapper;
import com.sep.flight.repository.flight.FlightSearchRepository;
import com.sep.flight.service.AeroDataBoxFlightService;
import com.sep.flight.service.FlightService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FlightServiceTest {

    @Mock
    private AeroDataBoxFlightService aeroDataBoxFlightService;

    @Mock
    private FlightMapper flightMapper;

    @Mock
    private FlightSearchRepository flightSearchRepository;

    private ObjectMapper objectMapper;
    private FlightService flightService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        flightService = new FlightService(
                aeroDataBoxFlightService,
                flightMapper,
                flightSearchRepository,
                objectMapper
        );
    }

    @Test
    void oneWaySearchWithoutDepartureDateIsRejected() {
        FlightSearchRequest request = request(
                airport("DUS", "Düsseldorf"),
                airport("VIE", "Vienna"),
                null
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Departure date is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void oneWaySearchWithoutOriginAirportCodeIsRejected() {
        FlightSearchRequest request = request(
                airport("", "Düsseldorf"),
                airport("VIE", "Vienna"),
                LocalDate.of(2026, 7, 10)
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Origin airport code is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void oneWaySearchWithoutDestinationAirportCodeIsRejected() {
        FlightSearchRequest request = request(
                airport("DUS", "Düsseldorf"),
                airport("", "Vienna"),
                LocalDate.of(2026, 7, 10)
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Destination airport code is required.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void multiCitySearchRequiresAtLeastTwoSegments() {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("", ""),
                airport("", ""),
                null,
                null,
                List.of(new FlightSearchRequest.MultiCitySegmentDto(
                        "Düsseldorf (DUS)",
                        "Vienna (VIE)",
                        LocalDate.of(2026, 7, 10)
                )),
                false,
                1,
                1,
                0,
                "economy"
        );

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Multi-city flight search requires at least two segments.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void multiCitySegmentWithoutDateIsRejected() {
        FlightSearchRequest request = new FlightSearchRequest(
                "multi-city",
                airport("", ""),
                airport("", ""),
                null,
                null,
                List.of(
                        new FlightSearchRequest.MultiCitySegmentDto("Düsseldorf (DUS)", "Vienna (VIE)", null),
                        new FlightSearchRequest.MultiCitySegmentDto(
                                "Vienna (VIE)",
                                "Beirut (BEY)",
                                LocalDate.of(2026, 7, 15)
                        )
                ),
                false,
                1,
                1,
                0,
                "economy"
        );

        when(flightMapper.airportFromText(any(String.class)))
                .thenReturn(airport("DUS", "Düsseldorf"));

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Segment 1 requires a date.");

        verifyNoInteractions(aeroDataBoxFlightService, flightSearchRepository);
    }

    @Test
    void freshCachedSearchIsReturnedWithoutCallingAeroDataBox() {
        FlightSearchRequest request = validRequest();
        FlightSearchEntity cachedSearch = searchEntity(request);
        cachedSearch.setOffers(List.of(new FlightOfferEntity()));
        List<FlightOfferDto> cachedOffers = List.of(offer("LH100"));
        FlightResponse expectedResponse = response(request, cachedOffers);

        when(flightSearchRepository
                .findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                        eq("one-way"),
                        eq("DUS"),
                        eq("VIE"),
                        eq(request.departureDate()),
                        eq(1),
                        eq(0),
                        eq("economy"),
                        any(OffsetDateTime.class)
                ))
                .thenReturn(Optional.of(cachedSearch));
        when(flightMapper.toDtos(cachedSearch.getOffers())).thenReturn(cachedOffers);
        when(flightMapper.toResponse(cachedSearch, cachedOffers)).thenReturn(expectedResponse);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isSameAs(expectedResponse);
        assertThat(response.flights()).containsExactlyElementsOf(cachedOffers);
        verifyNoInteractions(aeroDataBoxFlightService);
        verify(flightSearchRepository, never()).save(any());
    }

    @Test
    void emptyCacheFetchesAndPersistsAeroDataBoxFlights() {
        FlightSearchRequest request = validRequest();
        ObjectNode apiResponse = objectMapper.createObjectNode();
        List<FlightOfferDto> offers = List.of(offer("LH100"));
        FlightSearchEntity searchEntity = searchEntity(request);
        FlightOfferEntity offerEntity = new FlightOfferEntity();
        FlightResponse expectedResponse = response(request, offers);

        when(flightSearchRepository
                .findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                        eq("one-way"),
                        eq("DUS"),
                        eq("VIE"),
                        eq(request.departureDate()),
                        eq(1),
                        eq(0),
                        eq("economy"),
                        any(OffsetDateTime.class)
                ))
                .thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(request)).thenReturn(apiResponse);
        when(flightMapper.fromAeroDataBox(apiResponse, request)).thenReturn(offers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(searchEntity);
        when(flightMapper.toOfferEntity(offers.getFirst(), searchEntity, "outbound"))
                .thenReturn(offerEntity);
        when(flightSearchRepository.save(searchEntity)).thenReturn(searchEntity);
        when(flightMapper.toResponse(searchEntity, offers)).thenReturn(expectedResponse);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isSameAs(expectedResponse);
        assertThat(searchEntity.getOffers()).containsExactly(offerEntity);
        verify(aeroDataBoxFlightService).searchFlights(request);
        verify(flightSearchRepository).save(searchEntity);
    }

    @Test
    void cachedSearchWithoutOffersFetchesFreshFlights() {
        FlightSearchRequest request = validRequest();
        FlightSearchEntity emptyCachedSearch = searchEntity(request);
        ObjectNode apiResponse = objectMapper.createObjectNode();
        List<FlightOfferDto> offers = List.of(offer("LH100"));
        FlightSearchEntity newSearchEntity = searchEntity(request);
        FlightResponse expectedResponse = response(request, offers);

        when(flightSearchRepository
                .findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                        eq("one-way"),
                        eq("DUS"),
                        eq("VIE"),
                        eq(request.departureDate()),
                        eq(1),
                        eq(0),
                        eq("economy"),
                        any(OffsetDateTime.class)
                ))
                .thenReturn(Optional.of(emptyCachedSearch));
        when(aeroDataBoxFlightService.searchFlights(request)).thenReturn(apiResponse);
        when(flightMapper.fromAeroDataBox(apiResponse, request)).thenReturn(offers);
        when(flightMapper.toSearchEntity(request, null)).thenReturn(newSearchEntity);
        when(flightMapper.toOfferEntity(offers.getFirst(), newSearchEntity, "outbound"))
                .thenReturn(new FlightOfferEntity());
        when(flightSearchRepository.save(newSearchEntity)).thenReturn(newSearchEntity);
        when(flightMapper.toResponse(newSearchEntity, offers)).thenReturn(expectedResponse);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isSameAs(expectedResponse);
        verify(aeroDataBoxFlightService).searchFlights(request);
        verify(flightSearchRepository).save(newSearchEntity);
    }

    @Test
    void roundTripSearchFetchesOutboundAndReversedReturnLegs() {
        FlightSearchRequest request = new FlightSearchRequest(
                "round-trip",
                airport("DUS", "Düsseldorf"),
                airport("VIE", "Vienna"),
                LocalDate.of(2026, 7, 10),
                LocalDate.of(2026, 7, 15),
                null,
                false,
                1,
                1,
                0,
                "economy"
        );
        ObjectNode apiResponse = objectMapper.createObjectNode();
        FlightOfferDto outbound = offer("LH100");
        FlightOfferDto returning = offer("LH101");
        FlightSearchEntity searchEntity = searchEntity(request);
        FlightResponse expectedResponse = response(request, List.of(outbound, returning));

        when(flightSearchRepository
                .findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                        eq("round-trip"),
                        eq("DUS"),
                        eq("VIE"),
                        eq(request.departureDate()),
                        eq(request.returnDate()),
                        eq(1),
                        eq(0),
                        eq("economy"),
                        any(OffsetDateTime.class)
                ))
                .thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(any(FlightSearchRequest.class))).thenReturn(apiResponse);
        when(flightMapper.fromAeroDataBox(eq(apiResponse), any(FlightSearchRequest.class)))
                .thenReturn(List.of(outbound))
                .thenReturn(List.of(returning));
        when(flightMapper.toSearchEntity(request, null)).thenReturn(searchEntity);
        when(flightMapper.toOfferEntity(any(FlightOfferDto.class), eq(searchEntity), any(String.class)))
                .thenReturn(new FlightOfferEntity());
        when(flightSearchRepository.save(searchEntity)).thenReturn(searchEntity);
        when(flightMapper.toResponse(searchEntity, List.of(outbound, returning))).thenReturn(expectedResponse);

        FlightResponse response = flightService.searchFlights(request);

        assertThat(response).isSameAs(expectedResponse);

        ArgumentCaptor<FlightSearchRequest> requestCaptor = ArgumentCaptor.forClass(FlightSearchRequest.class);
        verify(aeroDataBoxFlightService, times(2)).searchFlights(requestCaptor.capture());

        FlightSearchRequest returnLeg = requestCaptor.getAllValues().get(1);
        assertThat(returnLeg.from().code()).isEqualTo("VIE");
        assertThat(returnLeg.to().code()).isEqualTo("DUS");
        assertThat(returnLeg.departureDate()).isEqualTo(LocalDate.of(2026, 7, 15));
        assertThat(returnLeg.returnDate()).isNull();
    }

    @Test
    void externalApiFailureDoesNotPersistIncompleteSearch() {
        FlightSearchRequest request = validRequest();

        when(flightSearchRepository
                .findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                        eq("one-way"),
                        eq("DUS"),
                        eq("VIE"),
                        eq(request.departureDate()),
                        eq(1),
                        eq(0),
                        eq("economy"),
                        any(OffsetDateTime.class)
                ))
                .thenReturn(Optional.empty());
        when(aeroDataBoxFlightService.searchFlights(request))
                .thenThrow(new ExternalApiException("AeroDataBox unavailable"));

        assertThatThrownBy(() -> flightService.searchFlights(request))
                .isInstanceOf(ExternalApiException.class)
                .hasMessage("AeroDataBox unavailable");

        verify(flightSearchRepository, never()).save(any());
    }

    private FlightSearchRequest validRequest() {
        return request(
                airport("DUS", "Düsseldorf"),
                airport("VIE", "Vienna"),
                LocalDate.of(2026, 7, 10)
        );
    }

    private FlightSearchRequest request(
            FlightSearchRequest.AirportDto from,
            FlightSearchRequest.AirportDto to,
            LocalDate departureDate
    ) {
        return new FlightSearchRequest(
                "one-way",
                from,
                to,
                departureDate,
                null,
                null,
                false,
                1,
                1,
                0,
                "economy"
        );
    }

    private FlightSearchRequest.AirportDto airport(String code, String city) {
        return new FlightSearchRequest.AirportDto(code, city, city + " Airport");
    }

    private FlightSearchEntity searchEntity(FlightSearchRequest request) {
        FlightSearchEntity entity = new FlightSearchEntity();
        entity.setTripType(request.tripType());
        entity.setFromCode(request.from().code());
        entity.setFromCity(request.from().city());
        entity.setFromFullName(request.from().fullName());
        entity.setToCode(request.to().code());
        entity.setToCity(request.to().city());
        entity.setToFullName(request.to().fullName());
        entity.setDepartureDate(request.departureDate());
        entity.setReturnDate(request.returnDate());
        entity.setTravelers(request.travelers());
        entity.setAdults(request.adults());
        entity.setChildren(request.children());
        entity.setCabinClass(request.cabinClass());
        return entity;
    }

    private FlightOfferDto offer(String flightNumber) {
        return new FlightOfferDto(
                flightNumber,
                flightNumber,
                "Scheduled",
                new FlightOfferDto.AirlineDto("LH", "Lufthansa", "lh"),
                new FlightOfferDto.FlightEndpointDto("08:00", "DUS", "Düsseldorf", "A"),
                new FlightOfferDto.FlightEndpointDto("10:00", "VIE", "Vienna", "1"),
                "2h 00m",
                0,
                null,
                180,
                "EUR",
                true,
                false,
                8,
                null,
                null
        );
    }

    private FlightResponse response(FlightSearchRequest request, List<FlightOfferDto> offers) {
        return new FlightResponse(
                1L,
                request.tripType(),
                request.from(),
                request.to(),
                request.departureDate(),
                request.returnDate(),
                List.of(),
                request.travelers(),
                request.adults(),
                request.children(),
                request.cabinClass(),
                offers,
                List.of(),
                List.of(),
                offers
        );
    }
}
