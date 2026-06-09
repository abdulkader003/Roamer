package com.sep.flight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.flight.dto.flight.FlightOfferDto;
import com.sep.flight.dto.flight.FlightResponse;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.entity.flight.FlightOfferEntity;
import com.sep.flight.entity.flight.FlightSearchEntity;
import com.sep.flight.mapper.FlightMapper;
import com.sep.flight.repository.flight.FlightSearchRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Coordinates flight search, short-lived result caching, city-airport expansion, and persistence.
 */
@Service
public class FlightService {
    private static final Map<String, List<FlightSearchRequest.AirportDto>> CITY_AIRPORTS = Map.ofEntries(
            Map.entry("Milan", List.of(
                    new FlightSearchRequest.AirportDto("MXP", "Milan", "Malpensa"),
                    new FlightSearchRequest.AirportDto("LIN", "Milan", "Linate"),
                    new FlightSearchRequest.AirportDto("BGY", "Milan", "Bergamo Orio al Serio")
            )),
            Map.entry("Paris", List.of(
                    new FlightSearchRequest.AirportDto("CDG", "Paris", "Charles de Gaulle"),
                    new FlightSearchRequest.AirportDto("ORY", "Paris", "Orly"),
                    new FlightSearchRequest.AirportDto("BVA", "Paris", "Beauvais-Tille")
            )),
            Map.entry("London", List.of(
                    new FlightSearchRequest.AirportDto("LHR", "London", "Heathrow"),
                    new FlightSearchRequest.AirportDto("LGW", "London", "Gatwick"),
                    new FlightSearchRequest.AirportDto("STN", "London", "Stansted"),
                    new FlightSearchRequest.AirportDto("LTN", "London", "Luton"),
                    new FlightSearchRequest.AirportDto("LCY", "London", "London City")
            )),
            Map.entry("New York", List.of(
                    new FlightSearchRequest.AirportDto("JFK", "New York", "John F. Kennedy"),
                    new FlightSearchRequest.AirportDto("LGA", "New York", "LaGuardia"),
                    new FlightSearchRequest.AirportDto("EWR", "New York", "Newark Liberty")
            )),
            Map.entry("Rome", List.of(
                    new FlightSearchRequest.AirportDto("FCO", "Rome", "Fiumicino"),
                    new FlightSearchRequest.AirportDto("CIA", "Rome", "Ciampino")
            ))
    );

    private final AeroDataBoxFlightService aeroDataBoxFlightService;
    private final FlightMapper flightMapper;
    private final FlightSearchRepository flightSearchRepository;
    private final ObjectMapper objectMapper;

    public FlightService(
            AeroDataBoxFlightService aeroDataBoxFlightService,
            FlightMapper flightMapper,
            FlightSearchRepository flightSearchRepository,
            ObjectMapper objectMapper
    ) {
        this.aeroDataBoxFlightService = aeroDataBoxFlightService;
        this.flightMapper = flightMapper;
        this.flightSearchRepository = flightSearchRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Searches for flights using cached results when eligible, otherwise imports
     * fresh offers from AeroDataBox and stores the search for later reuse.
     *
     * @param request requested route, dates, travelers, and cabin options
     * @return normalized flight response for one-way, round-trip, or multi-city searches
     */
    @Transactional
    public FlightResponse searchFlights(FlightSearchRequest request) {
        validateSearchRequest(request);

        return findCachedSearch(request)
                .filter(search -> !search.getOffers().isEmpty())
                .map(search -> flightMapper.toResponse(search, flightMapper.toDtos(search.getOffers())))
                .orElseGet(() -> fetchPersistAndMap(request));
    }

    /**
     * Finds a reusable direct-route search created within the cache window.
     *
     * <p>Multi-city and city-airport expansion searches are intentionally excluded
     * because they depend on broader dynamic route combinations.</p>
     */
    private Optional<FlightSearchEntity> findCachedSearch(FlightSearchRequest request) {
        if ("multi-city".equals(request.tripType()) || request.includeCityAirports()) {
            return Optional.empty();
        }

        OffsetDateTime cacheCutoff = OffsetDateTime.now().minusMinutes(30);

        if (request.returnDate() == null) {
            return flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                    request.tripType(),
                    request.from().code(),
                    request.to().code(),
                    request.departureDate(),
                    request.adults(),
                    request.children(),
                    request.cabinClass(),
                    cacheCutoff
            );
        }

        return flightSearchRepository.findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
                request.tripType(),
                request.from().code(),
                request.to().code(),
                request.departureDate(),
                request.returnDate(),
                request.adults(),
                request.children(),
                request.cabinClass(),
                cacheCutoff
        );
    }

    /**
     * Fetches outbound and optional return offers, persists them, and maps the saved search.
     */
    private FlightResponse fetchPersistAndMap(FlightSearchRequest request) {
        if ("multi-city".equals(request.tripType())) {
            return fetchPersistAndMapMultiCity(request);
        }

        List<FlightOfferDto> outboundOffers = searchLeg(request, request.includeCityAirports());
        List<FlightOfferDto> returnOffers = List.of();
        if (isRoundTrip(request)) {
            FlightSearchRequest returnRequest = returnLegRequest(request);
            returnOffers = searchLeg(returnRequest, request.includeCityAirports());
        }
        List<FlightOfferDto> offers = new java.util.ArrayList<>();
        offers.addAll(outboundOffers);
        offers.addAll(returnOffers);

        FlightSearchEntity searchEntity = flightMapper.toSearchEntity(request, writeMultiCitySegments(request));
        List<FlightOfferEntity> offerEntities = new java.util.ArrayList<>();
        outboundOffers.forEach(offer -> offerEntities.add(flightMapper.toOfferEntity(offer, searchEntity, "outbound")));
        returnOffers.forEach(offer -> offerEntities.add(flightMapper.toOfferEntity(offer, searchEntity, "return")));

        searchEntity.setOffers(offerEntities);
        FlightSearchEntity savedSearch = flightSearchRepository.save(searchEntity);

        return flightMapper.toResponse(savedSearch, offers);
    }

    /**
     * Fetches each multi-city segment independently and returns segment-grouped results.
     */
    private FlightResponse fetchPersistAndMapMultiCity(FlightSearchRequest request) {
        if (request.multiCitySegments() == null || request.multiCitySegments().size() < 2) {
            throw new IllegalArgumentException("Multi-city flight search requires at least two segments.");
        }

        FlightSearchEntity searchEntity = flightMapper.toSearchEntity(request, writeMultiCitySegments(request));
        List<FlightOfferEntity> offerEntities = new ArrayList<>();
        List<FlightOfferDto> allOffers = new ArrayList<>();
        List<FlightResponse.SegmentFlightsDto> segmentFlights = new ArrayList<>();

        for (int i = 0; i < request.multiCitySegments().size(); i++) {
            FlightSearchRequest.MultiCitySegmentDto segment = request.multiCitySegments().get(i);
            FlightSearchRequest segmentRequest = segmentRequest(request, segment);
            List<FlightOfferDto> segmentOffers = searchLeg(segmentRequest, false);
            String legType = "segment-" + (i + 1);

            segmentOffers.forEach(offer -> offerEntities.add(flightMapper.toOfferEntity(offer, searchEntity, legType)));
            allOffers.addAll(segmentOffers);
            segmentFlights.add(new FlightResponse.SegmentFlightsDto(
                    i + 1,
                    segment.fromText(),
                    segment.toText(),
                    segment.date(),
                    segmentOffers
            ));
        }

        searchEntity.setOffers(offerEntities);
        FlightSearchEntity savedSearch = flightSearchRepository.save(searchEntity);

        return flightMapper.toResponse(savedSearch, List.of(), List.of(), segmentFlights, allOffers);
    }

    private boolean isRoundTrip(FlightSearchRequest request) {
        return "round-trip".equals(request.tripType()) && request.returnDate() != null;
    }

    /**
     * Searches either the exact airport pair or a bounded set of airport pairs for supported cities.
     */
    private List<FlightOfferDto> searchLeg(FlightSearchRequest request, boolean includeCityAirports) {
        if (!includeCityAirports) {
            JsonNode response = aeroDataBoxFlightService.searchFlights(request);
            return flightMapper.fromAeroDataBox(response, request);
        }

        List<FlightSearchRequest.AirportDto> originAirports = cityAirportsFor(request.from());
        List<FlightSearchRequest.AirportDto> destinationAirports = cityAirportsFor(request.to());
        List<FlightOfferDto> offers = new ArrayList<>();
        int maxRoutePairs = 9;
        int routePairs = 0;

        for (FlightSearchRequest.AirportDto origin : originAirports) {
            for (FlightSearchRequest.AirportDto destination : destinationAirports) {
                if (routePairs >= maxRoutePairs) {
                    break;
                }
                routePairs++;
                FlightSearchRequest airportRequest = legRequest(request, origin, destination);
                JsonNode response = aeroDataBoxFlightService.searchFlights(airportRequest);
                offers.addAll(flightMapper.fromAeroDataBox(response, airportRequest, false));
            }
        }

        if (offers.isEmpty()) {
            JsonNode response = aeroDataBoxFlightService.searchFlights(request);
            return flightMapper.fromAeroDataBox(response, request);
        }

        return offers.stream()
                .sorted(Comparator.comparing(FlightOfferDto::price))
                .toList();
    }

    private List<FlightSearchRequest.AirportDto> cityAirportsFor(FlightSearchRequest.AirportDto airport) {
        if (airport == null || airport.city() == null || airport.city().isBlank()) {
            return List.of(airport);
        }

        return CITY_AIRPORTS.getOrDefault(airport.city(), List.of(airport));
    }

    private FlightSearchRequest legRequest(
            FlightSearchRequest request,
            FlightSearchRequest.AirportDto from,
            FlightSearchRequest.AirportDto to
    ) {
        return new FlightSearchRequest(
                request.tripType(),
                from,
                to,
                request.departureDate(),
                request.returnDate(),
                null,
                request.includeCityAirports(),
                request.travelers(),
                request.adults(),
                request.children(),
                request.cabinClass()
        );
    }

    private FlightSearchRequest returnLegRequest(FlightSearchRequest request) {
        return new FlightSearchRequest(
                request.tripType(),
                request.to(),
                request.from(),
                request.returnDate(),
                null,
                null,
                request.includeCityAirports(),
                request.travelers(),
                request.adults(),
                request.children(),
                request.cabinClass()
        );
    }

    private FlightSearchRequest segmentRequest(FlightSearchRequest request, FlightSearchRequest.MultiCitySegmentDto segment) {
        return new FlightSearchRequest(
                request.tripType(),
                flightMapper.airportFromText(segment.fromText()),
                flightMapper.airportFromText(segment.toText()),
                segment.date(),
                null,
                null,
                false,
                request.travelers(),
                request.adults(),
                request.children(),
                request.cabinClass()
        );
    }

    private String writeMultiCitySegments(FlightSearchRequest request) {
        try {
            return request.multiCitySegments() == null ? null : objectMapper.writeValueAsString(request.multiCitySegments());
        } catch (Exception ex) {
            throw new IllegalArgumentException("Unable to serialize multiCitySegments", ex);
        }
    }

    /**
     * Validates the route shape required by the selected trip type before external calls are made.
     */
    private void validateSearchRequest(FlightSearchRequest request) {
        if (!"multi-city".equals(request.tripType())) {
            if (request.departureDate() == null) {
                throw new IllegalArgumentException("Departure date is required.");
            }
            if (request.from().code() == null || request.from().code().isBlank()) {
                throw new IllegalArgumentException("Origin airport code is required.");
            }
            if (request.to().code() == null || request.to().code().isBlank()) {
                throw new IllegalArgumentException("Destination airport code is required.");
            }
            return;
        }

        if (request.multiCitySegments() == null || request.multiCitySegments().size() < 2) {
            throw new IllegalArgumentException("Multi-city flight search requires at least two segments.");
        }

        for (int i = 0; i < request.multiCitySegments().size(); i++) {
            FlightSearchRequest.MultiCitySegmentDto segment = request.multiCitySegments().get(i);
            if (flightMapper.airportFromText(segment.fromText()).code().isBlank()
                    || flightMapper.airportFromText(segment.toText()).code().isBlank()) {
                throw new IllegalArgumentException("Segment " + (i + 1) + " requires airport codes, for example Paris (CDG).");
            }
            if (segment.date() == null) {
                throw new IllegalArgumentException("Segment " + (i + 1) + " requires a date.");
            }
        }
    }
}
