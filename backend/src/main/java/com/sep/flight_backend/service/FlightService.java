package com.sep.flight_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.flight_backend.dto.flight.FlightOfferDto;
import com.sep.flight_backend.dto.flight.FlightResponse;
import com.sep.flight_backend.dto.flight.FlightSearchRequest;
import com.sep.flight_backend.entity.flight.FlightOfferEntity;
import com.sep.flight_backend.entity.flight.FlightSearchEntity;
import com.sep.flight_backend.mapper.FlightMapper;
import com.sep.flight_backend.repository.flight.FlightSearchRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class FlightService {
    private final AviationstackFlightService aviationstackFlightService;
    private final FlightMapper flightMapper;
    private final FlightSearchRepository flightSearchRepository;
    private final ObjectMapper objectMapper;

    public FlightService(
            AviationstackFlightService aviationstackFlightService,
            FlightMapper flightMapper,
            FlightSearchRepository flightSearchRepository,
            ObjectMapper objectMapper
    ) {
        this.aviationstackFlightService = aviationstackFlightService;
        this.flightMapper = flightMapper;
        this.flightSearchRepository = flightSearchRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public FlightResponse searchFlights(FlightSearchRequest request) {
        validateSearchRequest(request);

        return findCachedSearch(request)
                .filter(search -> !search.getOffers().isEmpty())
                .map(search -> flightMapper.toResponse(search, flightMapper.toDtos(search.getOffers())))
                .orElseGet(() -> fetchPersistAndMap(request));
    }

    private Optional<FlightSearchEntity> findCachedSearch(FlightSearchRequest request) {
        if ("multi-city".equals(request.tripType())) {
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

    private FlightResponse fetchPersistAndMap(FlightSearchRequest request) {
        JsonNode aviationstackResponse = aviationstackFlightService.searchFlights(request);
        if ("multi-city".equals(request.tripType())) {
            return fetchPersistAndMapMultiCity(request, aviationstackResponse);
        }

        List<FlightOfferDto> outboundOffers = flightMapper.fromAviationstack(aviationstackResponse, request);
        List<FlightOfferDto> returnOffers = isRoundTrip(request)
                ? flightMapper.fromAviationstack(aviationstackResponse, returnLegRequest(request))
                : List.of();
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

    private FlightResponse fetchPersistAndMapMultiCity(FlightSearchRequest request, JsonNode aviationstackResponse) {
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
            List<FlightOfferDto> segmentOffers = flightMapper.fromAviationstack(aviationstackResponse, segmentRequest);
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

    private FlightSearchRequest returnLegRequest(FlightSearchRequest request) {
        return new FlightSearchRequest(
                request.tripType(),
                request.to(),
                request.from(),
                request.returnDate(),
                null,
                null,
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
