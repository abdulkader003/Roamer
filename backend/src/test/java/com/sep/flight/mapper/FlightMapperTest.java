package com.sep.flight.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.flight.dto.flight.FlightOfferDto;
import com.sep.flight.dto.flight.FlightResponse;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.entity.flight.FlightOfferEntity;
import com.sep.flight.entity.flight.FlightSearchEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class FlightMapperTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private FlightMapper flightMapper;

    @BeforeEach
    void setUp() {
        flightMapper = new FlightMapper(objectMapper);
    }

    @Test
    void fromAeroDataBoxMapsSuccessfulResponseAndAppliesBadges() throws Exception {
        FlightSearchRequest request = oneWayRequest();
        int firstPrice = (Integer) invoke("estimatedPrice", "DUS", "BCN", "LH");
        int secondPrice = (Integer) invoke("estimatedPrice", "DUS", "BCN", "EW");
        boolean firstIsCheaper = firstPrice < secondPrice;
        String firstArrival = firstIsCheaper ? "2026-08-14T10:30:00Z" : "2026-08-14T09:50:00Z";
        String secondArrival = firstIsCheaper ? "2026-08-14T10:35:00Z" : "2026-08-14T11:15:00Z";
        String responseJson = """
                {
                  "departures": [
                    {
                      "id": "fl-1",
                      "number": "LH123",
                      "status": {"text": "scheduled"},
                      "airline": {"iata": "LH", "name": "Lufthansa"},
                      "departure": {
                        "scheduledTime": "2026-08-14T08:00:00Z",
                        "airport": {"iata": "DUS"},
                        "terminal": "1"
                      },
                      "arrival": {
                        "revisedTime": "%s",
                        "airport": {"iata": "BCN"},
                        "terminal": "2"
                      }
                    },
                    {
                      "id": "fl-2",
                      "number": "EW456",
                      "status": "scheduled",
                      "airline": {"icao": "EW", "name": "Eurowings"},
                      "departure": {
                        "runwayTime": "2026-08-14T08:45:00Z",
                        "airport": {"iata": "DUS"}
                      },
                      "arrival": {
                        "scheduledTime": "%s",
                        "airport": {"iata": "BCN"}
                      }
                    },
                    {
                      "id": "skip-me",
                      "number": "SKIP",
                      "departure": {
                        "scheduledTime": "2026-08-14T08:00:00Z",
                        "airport": {"iata": "BER"}
                      },
                      "arrival": {
                        "scheduledTime": "2026-08-14T09:00:00Z",
                        "airport": {"iata": "ROM"}
                      }
                    }
                  ]
                }
                """.formatted(firstArrival, secondArrival);
        JsonNode response = objectMapper.readTree(responseJson);

        List<FlightOfferDto> offers = flightMapper.fromAeroDataBox(response, request);

        assertThat(offers).hasSize(2);
        assertThat(offers).extracting(FlightOfferDto::id).contains("LH123", "EW456");

        FlightOfferDto flightOne = offers.stream().filter(offer -> "LH123".equals(offer.id())).findFirst().orElseThrow();
        FlightOfferDto flightTwo = offers.stream().filter(offer -> "EW456".equals(offer.id())).findFirst().orElseThrow();

        assertOfferIgnoringBadge(
                flightOne,
                new FlightOfferDto(
                        "LH123",
                        "LH123",
                        "scheduled",
                        new FlightOfferDto.AirlineDto("LH", "Lufthansa", "lh"),
                        new FlightOfferDto.FlightEndpointDto("08:00", "DUS", "Duesseldorf", "1"),
                        new FlightOfferDto.FlightEndpointDto(firstArrival.substring(11, 16), "BCN", "Barcelona", "2"),
                        firstIsCheaper ? "2h 30m" : "1h 50m",
                        0,
                        null,
                        firstPrice,
                        "EUR",
                        true,
                        false,
                        8,
                        null,
                        null
                )
        );
        assertOfferIgnoringBadge(
                flightTwo,
                new FlightOfferDto(
                        "EW456",
                        "EW456",
                        "scheduled",
                        new FlightOfferDto.AirlineDto("EW", "Eurowings", "ew"),
                        new FlightOfferDto.FlightEndpointDto("08:45", "DUS", "Duesseldorf", null),
                        new FlightOfferDto.FlightEndpointDto(secondArrival.substring(11, 16), "BCN", "Barcelona", null),
                        firstIsCheaper ? "1h 50m" : "2h 30m",
                        0,
                        null,
                        secondPrice,
                        "EUR",
                        true,
                        false,
                        8,
                        null,
                        null
                )
        );
        assertThat(offers).extracting(offer -> offer.badge() == null ? null : offer.badge().type())
                .containsExactlyInAnyOrder("cheapest", "fastest");
    }

    @Test
    void fromAeroDataBoxFallsBackOrReturnsEmptyWhenSourceDataIsMissing() {
        FlightSearchRequest request = oneWayRequest();

        assertThat(flightMapper.fromAeroDataBox(null, request))
                .hasSize(20)
                .allSatisfy(offer -> assertThat(offer.price()).isPositive());
        assertThat(flightMapper.fromAeroDataBox(objectMapper.createObjectNode(), request, false)).isEmpty();
        assertThat(flightMapper.fromAeroDataBox(objectMapper.createObjectNode(), request)).hasSize(20);
    }

    @Test
    void fromAmadeusMapsOffersAndAppliesBadges() throws Exception {
        FlightSearchRequest request = oneWayRequest();
        JsonNode response = objectMapper.readTree("""
                {
                  "data": [
                    {
                      "id": "am-1",
                      "price": {"grandTotal": "220", "currency": "EUR"},
                      "itineraries": [
                        {
                          "duration": "PT1H50M",
                          "segments": [
                            {
                              "number": "LH123",
                              "carrierCode": "LH",
                              "departure": {"at": "2026-08-14T08:00:00", "iataCode": "DUS", "terminal": "1"},
                              "arrival": {"at": "2026-08-14T09:50:00", "iataCode": "BCN", "terminal": "2"}
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "am-2",
                      "price": {"grandTotal": "180", "currency": "EUR"},
                      "itineraries": [
                        {
                          "duration": "PT1H55M",
                          "segments": [
                            {
                              "number": "EW456",
                              "carrierCode": "EW",
                              "departure": {"at": "2026-08-14T09:00:00Z", "iataCode": "DUS"},
                              "arrival": {"at": "2026-08-14T10:55:00Z", "iataCode": "BCN"}
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "am-3",
                      "price": {"grandTotal": "200", "currency": "EUR"},
                      "itineraries": [
                        {
                          "duration": "PT2H05M",
                          "segments": [
                            {
                              "number": "KL789",
                              "carrierCode": "LH",
                              "departure": {"at": "2026-08-14T08:30:00Z", "iataCode": "DUS"},
                              "arrival": {"at": "2026-08-14T10:35:00Z", "iataCode": "BCN"}
                            }
                          ]
                        }
                      ]
                    }
                  ],
                  "dictionaries": {
                    "carriers": {
                      "LH": "Lufthansa",
                      "EW": "Eurowings"
                    }
                  }
                }
                """);

        List<FlightOfferDto> offers = flightMapper.fromAmadeus(response, request);

        assertThat(offers).hasSize(3);
        assertThat(offers).extracting(FlightOfferDto::id).containsExactly("am-2", "am-3", "am-1");

        assertOfferIgnoringBadge(
                offers.get(0),
                new FlightOfferDto(
                        "am-2",
                        "EW456",
                        "Offer",
                        new FlightOfferDto.AirlineDto("EW", "Eurowings", "ew"),
                        new FlightOfferDto.FlightEndpointDto("09:00", "DUS", "Duesseldorf", null),
                        new FlightOfferDto.FlightEndpointDto("10:55", "BCN", "Barcelona", null),
                        "1h 55m",
                        0,
                        null,
                        180,
                        "EUR",
                        true,
                        false,
                        8,
                        null,
                        null
                )
        );
        assertOfferIgnoringBadge(
                offers.get(1),
                new FlightOfferDto(
                        "am-3",
                        "KL789",
                        "Offer",
                        new FlightOfferDto.AirlineDto("LH", "Lufthansa", "lh"),
                        new FlightOfferDto.FlightEndpointDto("08:30", "DUS", "Duesseldorf", null),
                        new FlightOfferDto.FlightEndpointDto("10:35", "BCN", "Barcelona", null),
                        "2h 5m",
                        0,
                        null,
                        200,
                        "EUR",
                        true,
                        false,
                        8,
                        null,
                        null
                )
        );
        assertOfferIgnoringBadge(
                offers.get(2),
                new FlightOfferDto(
                        "am-1",
                        "LH123",
                        "Offer",
                        new FlightOfferDto.AirlineDto("LH", "Lufthansa", "lh"),
                        new FlightOfferDto.FlightEndpointDto("08:00", "DUS", "Duesseldorf", "1"),
                        new FlightOfferDto.FlightEndpointDto("09:50", "BCN", "Barcelona", "2"),
                        "1h 50m",
                        0,
                        null,
                        220,
                        "EUR",
                        true,
                        false,
                        8,
                        null,
                        null
                )
        );
        assertThat(offers.get(0).badge().type()).isEqualTo("cheapest");
        assertThat(offers.get(2).badge().type()).isEqualTo("fastest");
        assertThat(offers.get(1).badge()).isNull();
    }

    @Test
    void fromAmadeusReturnsEmptyForIncompleteResponses() throws Exception {
        FlightSearchRequest request = oneWayRequest();
        assertThat(flightMapper.fromAmadeus(null, request)).isEmpty();
        assertThat(flightMapper.fromAmadeus(objectMapper.readTree("{\"data\":{}}"), request)).isEmpty();
        assertThat(flightMapper.fromAmadeus(objectMapper.readTree("{\"data\":[]}"), request)).isEmpty();
    }

    @Test
    void toSearchEntityCopiesAllRequestFields() {
        FlightSearchRequest request = roundTripRequest();

        FlightSearchEntity entity = flightMapper.toSearchEntity(request, "[{\"fromText\":\"Paris\"}]");

        assertThat(entity.getTripType()).isEqualTo("round-trip");
        assertThat(entity.getFromCode()).isEqualTo("DUS");
        assertThat(entity.getFromCity()).isEqualTo("Duesseldorf");
        assertThat(entity.getFromFullName()).isEqualTo("Dusseldorf Airport");
        assertThat(entity.getToCode()).isEqualTo("BCN");
        assertThat(entity.getToCity()).isEqualTo("Barcelona");
        assertThat(entity.getToFullName()).isEqualTo("Barcelona El Prat");
        assertThat(entity.getDepartureDate()).isEqualTo(LocalDate.of(2026, 8, 14));
        assertThat(entity.getReturnDate()).isEqualTo(LocalDate.of(2026, 8, 21));
        assertThat(entity.getMultiCitySegmentsJson()).isEqualTo("[{\"fromText\":\"Paris\"}]");
        assertThat(entity.getTravelers()).isEqualTo(2);
        assertThat(entity.getAdults()).isEqualTo(2);
        assertThat(entity.getChildren()).isEqualTo(0);
        assertThat(entity.getCabinClass()).isEqualTo("economy");
    }

    @Test
    void toOfferEntityMapsNestedFieldsAndNullBadgeFallback() {
        FlightSearchEntity search = new FlightSearchEntity();
        FlightOfferDto dto = new FlightOfferDto(
                "offer-1",
                "LH123",
                "scheduled",
                new FlightOfferDto.AirlineDto("LH", "Lufthansa", "lh"),
                new FlightOfferDto.FlightEndpointDto("08:00", "DUS", "Duesseldorf", "1"),
                new FlightOfferDto.FlightEndpointDto("09:50", "BCN", "Barcelona", "2"),
                "1h 50m",
                1,
                "1 stop · FRA",
                220,
                "EUR",
                true,
                false,
                8,
                23,
                null
        );

        FlightOfferEntity entity = flightMapper.toOfferEntity(dto, search, "outbound");

        assertThat(entity.getSearch()).isSameAs(search);
        assertThat(entity.getExternalOfferId()).isEqualTo("offer-1");
        assertThat(entity.getFlightNumber()).isEqualTo("LH123");
        assertThat(entity.getStatus()).isEqualTo("scheduled");
        assertThat(entity.getLegType()).isEqualTo("outbound");
        assertThat(entity.getAirlineCode()).isEqualTo("LH");
        assertThat(entity.getAirlineName()).isEqualTo("Lufthansa");
        assertThat(entity.getAirlineColorClass()).isEqualTo("lh");
        assertThat(entity.getDepartureTime()).isEqualTo("08:00");
        assertThat(entity.getDepartureAirport()).isEqualTo("DUS");
        assertThat(entity.getDepartureCity()).isEqualTo("Duesseldorf");
        assertThat(entity.getDepartureTerminal()).isEqualTo("1");
        assertThat(entity.getArrivalTime()).isEqualTo("09:50");
        assertThat(entity.getArrivalAirport()).isEqualTo("BCN");
        assertThat(entity.getArrivalCity()).isEqualTo("Barcelona");
        assertThat(entity.getArrivalTerminal()).isEqualTo("2");
        assertThat(entity.getDuration()).isEqualTo("1h 50m");
        assertThat(entity.getStops()).isEqualTo(1);
        assertThat(entity.getStopDetails()).isEqualTo("1 stop · FRA");
        assertThat(entity.getPrice()).isEqualByComparingTo("220");
        assertThat(entity.getCurrency()).isEqualTo("EUR");
        assertThat(entity.getCarryOnIncluded()).isTrue();
        assertThat(entity.getCheckedBagIncluded()).isFalse();
        assertThat(entity.getCarryOnWeightKg()).isEqualTo(8);
        assertThat(entity.getCheckedBagWeightKg()).isEqualTo(23);
        assertThat(entity.getBadgeType()).isNull();
        assertThat(entity.getBadgeLabel()).isNull();
    }

    @Test
    void toDtosToDtoAndToResponseMapEntityFieldsAndDefaults() {
        FlightSearchEntity search = searchEntity();
        FlightOfferEntity outbound = offerEntity("outbound-1", "outbound", null, null);
        FlightOfferEntity returnFlight = offerEntity("return-1", "return", "Promo", "Best value");
        search.setOffers(List.of(outbound, returnFlight));

        List<FlightOfferDto> dtoList = flightMapper.toDtos(List.of(outbound, returnFlight));
        assertThat(dtoList).hasSize(2);
        assertThat(dtoList.get(0).flightNumber()).isEqualTo("outbound-1");
        assertThat(dtoList.get(0).status()).isEqualTo("Scheduled");
        assertThat(dtoList.get(0).badge()).isNull();
        assertThat(dtoList.get(1).badge().type()).isEqualTo("Promo");

        FlightResponse response = flightMapper.toResponse(search, List.of(simpleOffer("fallback-1", 155)));
        assertThat(response.searchId()).isEqualTo(77L);
        assertThat(response.tripType()).isEqualTo("round-trip");
        assertThat(response.from().code()).isEqualTo("DUS");
        assertThat(response.from().city()).isEqualTo("Duesseldorf");
        assertThat(response.from().fullName()).isEqualTo("Dusseldorf Airport");
        assertThat(response.to().code()).isEqualTo("BCN");
        assertThat(response.departureDate()).isEqualTo(LocalDate.of(2026, 8, 14));
        assertThat(response.returnDate()).isEqualTo(LocalDate.of(2026, 8, 21));
        assertThat(response.multiCitySegments()).isEmpty();
        assertThat(response.travelers()).isEqualTo(2);
        assertThat(response.outboundFlights()).extracting(FlightOfferDto::id).containsExactly("outbound-1");
        assertThat(response.returnFlights()).extracting(FlightOfferDto::id).containsExactly("return-1");
        assertThat(response.flights()).extracting(FlightOfferDto::id).containsExactly("fallback-1");

        FlightResponse explicitSegments = flightMapper.toResponse(
                search,
                List.of(),
                List.of(),
                List.of(new FlightResponse.SegmentFlightsDto(1, "Paris (CDG)", "Rome (FCO)", LocalDate.of(2026, 9, 1), List.of(simpleOffer("seg-1", 200)))),
                List.of()
        );
        assertThat(explicitSegments.segmentFlights()).hasSize(1);
        assertThat(explicitSegments.segmentFlights().get(0).segmentIndex()).isEqualTo(1);
        assertThat(explicitSegments.segmentFlights().get(0).flights()).extracting(FlightOfferDto::id).containsExactly("seg-1");
    }

    @Test
    void toResponseUsesProvidedFlightsWhenOutboundSearchOffersAreEmpty() {
        FlightSearchEntity search = searchEntity();
        search.setOffers(List.of());
        List<FlightOfferDto> provided = List.of(simpleOffer("fallback-1", 155));

        FlightResponse response = flightMapper.toResponse(search, provided);

        assertThat(response.outboundFlights()).containsExactlyElementsOf(provided);
        assertThat(response.returnFlights()).isEmpty();
        assertThat(response.flights()).containsExactlyElementsOf(provided);
    }

    @Test
    void airportFromTextAndPrivateParsersHandleFallbackBranches() throws Exception {
        assertThat(flightMapper.airportFromText("Paris (CDG)"))
                .extracting(FlightSearchRequest.AirportDto::code, FlightSearchRequest.AirportDto::city, FlightSearchRequest.AirportDto::fullName)
                .containsExactly("CDG", "Paris", "Paris");
        assertThat(flightMapper.airportFromText("CDG"))
                .extracting(FlightSearchRequest.AirportDto::code, FlightSearchRequest.AirportDto::city, FlightSearchRequest.AirportDto::fullName)
                .containsExactly("CDG", "CDG", "CDG");
        assertThat(flightMapper.airportFromText(" (CDG)"))
                .extracting(FlightSearchRequest.AirportDto::code, FlightSearchRequest.AirportDto::city, FlightSearchRequest.AirportDto::fullName)
                .containsExactly("CDG", "CDG", "CDG");
        assertThat(flightMapper.airportFromText("Berlin BER"))
                .extracting(FlightSearchRequest.AirportDto::code, FlightSearchRequest.AirportDto::city, FlightSearchRequest.AirportDto::fullName)
                .containsExactly("BER", "Berlin", "Berlin");
        assertThat(flightMapper.airportFromText("  "))
                .extracting(FlightSearchRequest.AirportDto::code, FlightSearchRequest.AirportDto::city, FlightSearchRequest.AirportDto::fullName)
                .containsExactly("", "", "");

        assertThat((Optional<LocalDateTime>) invoke("parseDateTime", "2026-08-14T08:00:00Z")).isPresent();
        assertThat((Optional<LocalDateTime>) invoke("parseDateTime", "2026-08-14 08:00:00Z")).isPresent();
        assertThat((Optional<LocalDateTime>) invoke("parseDateTime", "not-a-date")).isEmpty();
        assertThat((Optional<LocalDateTime>) invoke("parseDateTime", "")).isEmpty();
        assertThat((Optional<LocalDateTime>) invoke("parseDateTime", (Object) null)).isEmpty();

        assertThat((String) invoke("scheduledDuration", "2026-08-14T08:00:00Z", "2026-08-14T10:15:00Z")).isEqualTo("2h 15m");
        assertThat((String) invoke("scheduledDuration", "2026-08-14T10:15:00Z", "2026-08-14T08:00:00Z")).isEqualTo("0h 0m");
        assertThat((String) invoke("scheduledDuration", (Object) null, "2026-08-14T10:15:00Z")).isEqualTo("0h 0m");
        assertThat((String) invoke("timeOnly", "2026-08-14T08:45:00Z")).isEqualTo("08:45");
        assertThat((String) invoke("timeOnly", "bad-date")).isEmpty();

        assertThat((String) invoke("textOrFallback", objectMapper.readTree("{\"name\":\"Frankfurt\"}").path("name"), "fallback"))
                .isEqualTo("Frankfurt");
        assertThat((String) invoke("textOrFallback", objectMapper.readTree("{\"name\":\"\"}").path("name"), "fallback"))
                .isEqualTo("fallback");
        assertThat((String) invoke("textOrFallback", objectMapper.nullNode(), "fallback"))
                .isEqualTo("fallback");

        assertThat((List<?>) invoke("readMultiCitySegments", """
                [{"fromText":"Paris (CDG)","toText":"Rome (FCO)","date":"2026-09-01"}]
                """)).hasSize(1);
        assertThat((List<?>) invoke("readMultiCitySegments", "{")).isEmpty();
        assertThat((List<?>) invoke("readMultiCitySegments", "")).isEmpty();
        assertThat((List<?>) invoke("readMultiCitySegments", (Object) null)).isEmpty();

        assertThat((Integer) invoke("durationMinutes", simpleOffer("f-1", 150))).isEqualTo(135);
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

    private FlightSearchEntity searchEntity() {
        FlightSearchEntity entity = new FlightSearchEntity();
        ReflectionTestUtils.setField(entity, "id", 77L);
        entity.setTripType("round-trip");
        entity.setFromCode("DUS");
        entity.setFromCity("Duesseldorf");
        entity.setFromFullName("Dusseldorf Airport");
        entity.setToCode("BCN");
        entity.setToCity("Barcelona");
        entity.setToFullName("Barcelona El Prat");
        entity.setDepartureDate(LocalDate.of(2026, 8, 14));
        entity.setReturnDate(LocalDate.of(2026, 8, 21));
        entity.setTravelers(2);
        entity.setAdults(2);
        entity.setChildren(0);
        entity.setCabinClass("economy");
        return entity;
    }

    private FlightOfferEntity offerEntity(String externalOfferId, String legType, String badgeType, String badgeLabel) {
        FlightOfferEntity entity = new FlightOfferEntity();
        entity.setExternalOfferId(externalOfferId);
        entity.setFlightNumber(null);
        entity.setStatus(null);
        entity.setLegType(legType);
        entity.setAirlineCode("LH");
        entity.setAirlineName("Lufthansa");
        entity.setAirlineColorClass("lh");
        entity.setDepartureTime("08:00");
        entity.setDepartureAirport("DUS");
        entity.setDepartureCity("Duesseldorf");
        entity.setDepartureTerminal("1");
        entity.setArrivalTime("10:15");
        entity.setArrivalAirport("BCN");
        entity.setArrivalCity("Barcelona");
        entity.setArrivalTerminal("2");
        entity.setDuration("2h 15m");
        entity.setStops(0);
        entity.setStopDetails(null);
        entity.setPrice(new java.math.BigDecimal("220"));
        entity.setCurrency("EUR");
        entity.setCarryOnIncluded(true);
        entity.setCheckedBagIncluded(false);
        entity.setCarryOnWeightKg(8);
        entity.setCheckedBagWeightKg(23);
        entity.setBadgeType(badgeType);
        entity.setBadgeLabel(badgeLabel);
        return entity;
    }

    private FlightOfferDto simpleOffer(String id, int price) {
        return new FlightOfferDto(
                id,
                "FN-" + id,
                "Scheduled",
                new FlightOfferDto.AirlineDto("LH", "Lufthansa", "lh"),
                new FlightOfferDto.FlightEndpointDto("08:00", "DUS", "Duesseldorf", null),
                new FlightOfferDto.FlightEndpointDto("10:15", "BCN", "Barcelona", null),
                "2h 15m",
                0,
                null,
                price,
                "EUR",
                true,
                false,
                8,
                null,
                null
        );
    }

    @SuppressWarnings("unchecked")
    private <T> T invoke(String method, Object... args) {
        return (T) ReflectionTestUtils.invokeMethod(flightMapper, method, args);
    }

    private void assertOfferIgnoringBadge(FlightOfferDto actual, FlightOfferDto expected) {
        assertThat(actual).usingRecursiveComparison().ignoringFields("badge").isEqualTo(expected);
    }
}
