package flight_backend.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import flight_backend.dto.flight.FlightOfferDto;
import flight_backend.dto.flight.FlightResponse;
import flight_backend.dto.flight.FlightSearchRequest;
import flight_backend.entity.flight.FlightOfferEntity;
import flight_backend.entity.flight.FlightSearchEntity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.StreamSupport;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class FlightMapper {
    private final ObjectMapper objectMapper;

    public FlightMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<FlightOfferDto> fromAviationstack(JsonNode response, FlightSearchRequest request) {
        JsonNode data = response == null ? null : response.path("data");
        if (data == null || !data.isArray()) {
            return fallbackFlights(request);
        }

        List<FlightOfferDto> flights = StreamSupport.stream(data.spliterator(), false)
                .filter(flight -> routeMatches(flight, request))
                .map(flight -> toAviationstackDto(flight, request))
                .sorted(Comparator.comparing(FlightOfferDto::price))
                .toList();

        if (flights.isEmpty()) {
            return fallbackFlights(request);
        }

        int cheapest = flights.stream().mapToInt(FlightOfferDto::price).min().orElse(0);
        int fastestMinutes = flights.stream().mapToInt(this::durationMinutes).min().orElse(Integer.MAX_VALUE);

        return flights.stream()
                .map(flight -> withBadge(flight, cheapest, fastestMinutes))
                .toList();
    }

    public List<FlightOfferDto> fromAmadeus(JsonNode response, FlightSearchRequest request) {
        JsonNode data = response == null ? null : response.path("data");
        if (data == null || !data.isArray()) {
            return List.of();
        }

        List<FlightOfferDto> offers = StreamSupport.stream(data.spliterator(), false)
                .map(offer -> toDto(offer, response.path("dictionaries"), request))
                .sorted(Comparator.comparing(FlightOfferDto::price))
                .toList();

        if (offers.isEmpty()) {
            return offers;
        }

        int cheapest = offers.stream().mapToInt(FlightOfferDto::price).min().orElse(0);
        int fastestMinutes = offers.stream().mapToInt(this::durationMinutes).min().orElse(Integer.MAX_VALUE);

        return offers.stream()
                .map(offer -> withBadge(offer, cheapest, fastestMinutes))
                .toList();
    }

    public FlightSearchEntity toSearchEntity(FlightSearchRequest request, String multiCitySegmentsJson) {
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
        entity.setMultiCitySegmentsJson(multiCitySegmentsJson);
        entity.setTravelers(request.travelers());
        entity.setAdults(request.adults());
        entity.setChildren(request.children());
        entity.setCabinClass(request.cabinClass());
        return entity;
    }

    public FlightOfferEntity toOfferEntity(FlightOfferDto dto, FlightSearchEntity search, String legType) {
        FlightOfferEntity entity = new FlightOfferEntity();
        entity.setSearch(search);
        entity.setExternalOfferId(dto.id());
        entity.setLegType(legType);
        entity.setAirlineCode(dto.airline().code());
        entity.setAirlineName(dto.airline().name());
        entity.setAirlineColorClass(dto.airline().colorClass());
        entity.setDepartureTime(dto.departure().time());
        entity.setDepartureAirport(dto.departure().airport());
        entity.setDepartureCity(dto.departure().city());
        entity.setArrivalTime(dto.arrival().time());
        entity.setArrivalAirport(dto.arrival().airport());
        entity.setArrivalCity(dto.arrival().city());
        entity.setDuration(dto.duration());
        entity.setStops(dto.stops());
        entity.setStopDetails(dto.stopDetails());
        entity.setPrice(BigDecimal.valueOf(dto.price()));
        entity.setCurrency(dto.currency());
        entity.setCarryOnIncluded(dto.carryOnIncluded());
        entity.setCheckedBagIncluded(dto.checkedBagIncluded());
        entity.setCarryOnWeightKg(dto.carryOnWeightKg());
        entity.setCheckedBagWeightKg(dto.checkedBagWeightKg());
        entity.setBadgeType(dto.badge() == null ? null : dto.badge().type());
        entity.setBadgeLabel(dto.badge() == null ? null : dto.badge().label());
        return entity;
    }

    public List<FlightOfferDto> toDtos(List<FlightOfferEntity> entities) {
        return entities.stream().map(this::toDto).toList();
    }

    public FlightResponse toResponse(FlightSearchEntity search, List<FlightOfferDto> flights) {
        List<FlightOfferDto> outboundFlights = search.getOffers().stream()
                .filter(offer -> offer.getLegType() == null || "outbound".equals(offer.getLegType()))
                .map(this::toDto)
                .toList();
        List<FlightOfferDto> returnFlights = search.getOffers().stream()
                .filter(offer -> "return".equals(offer.getLegType()))
                .map(this::toDto)
                .toList();

        if (outboundFlights.isEmpty() && !flights.isEmpty()) {
            outboundFlights = flights;
        }

        return new FlightResponse(
                search.getId(),
                search.getTripType(),
                new FlightSearchRequest.AirportDto(search.getFromCode(), search.getFromCity(), search.getFromFullName()),
                new FlightSearchRequest.AirportDto(search.getToCode(), search.getToCity(), search.getToFullName()),
                search.getDepartureDate(),
                search.getReturnDate(),
                readMultiCitySegments(search.getMultiCitySegmentsJson()),
                search.getTravelers(),
                search.getAdults(),
                search.getChildren(),
                search.getCabinClass(),
                outboundFlights,
                returnFlights,
                List.of(),
                flights
        );
    }

    public FlightResponse toResponse(
            FlightSearchEntity search,
            List<FlightOfferDto> outboundFlights,
            List<FlightOfferDto> returnFlights,
            List<FlightResponse.SegmentFlightsDto> segmentFlights,
            List<FlightOfferDto> flights
    ) {
        return new FlightResponse(
                search.getId(),
                search.getTripType(),
                new FlightSearchRequest.AirportDto(search.getFromCode(), search.getFromCity(), search.getFromFullName()),
                new FlightSearchRequest.AirportDto(search.getToCode(), search.getToCity(), search.getToFullName()),
                search.getDepartureDate(),
                search.getReturnDate(),
                readMultiCitySegments(search.getMultiCitySegmentsJson()),
                search.getTravelers(),
                search.getAdults(),
                search.getChildren(),
                search.getCabinClass(),
                outboundFlights,
                returnFlights,
                segmentFlights,
                flights
        );
    }

    public FlightSearchRequest.AirportDto airportFromText(String text) {
        String value = text == null ? "" : text.trim();
        Matcher matcher = Pattern.compile("\\(([A-Za-z]{3})\\)\\s*$").matcher(value);
        String code = "";
        String city = value;

        if (matcher.find()) {
            code = matcher.group(1).toUpperCase(Locale.ROOT);
            city = value.substring(0, matcher.start()).trim();
        }

        if (code.isBlank() && value.matches("(?i)^[a-z]{3}$")) {
            code = value.toUpperCase(Locale.ROOT);
            city = value.toUpperCase(Locale.ROOT);
        }

        return new FlightSearchRequest.AirportDto(code, city, city);
    }

    private FlightOfferDto toDto(JsonNode offer, JsonNode dictionaries, FlightSearchRequest request) {
        JsonNode firstItinerary = offer.path("itineraries").path(0);
        JsonNode segments = firstItinerary.path("segments");
        JsonNode firstSegment = segments.path(0);
        JsonNode lastSegment = segments.path(Math.max(segments.size() - 1, 0));

        String airlineCode = firstSegment.path("carrierCode").asText("");
        String airlineName = dictionaries.path("carriers").path(airlineCode).asText(airlineCode);
        int stops = Math.max(segments.size() - 1, 0);

        return new FlightOfferDto(
                offer.path("id").asText(UUID.randomUUID().toString()),
                new FlightOfferDto.AirlineDto(airlineCode, airlineName, airlineCode.toLowerCase(Locale.ROOT)),
                new FlightOfferDto.FlightEndpointDto(
                        timeOnly(firstSegment.path("departure").path("at").asText()),
                        firstSegment.path("departure").path("iataCode").asText(request.from().code()),
                        request.from().city()
                ),
                new FlightOfferDto.FlightEndpointDto(
                        timeOnly(lastSegment.path("arrival").path("at").asText()),
                        lastSegment.path("arrival").path("iataCode").asText(request.to().code()),
                        request.to().city()
                ),
                formatIsoDuration(firstItinerary.path("duration").asText("PT0M")),
                stops,
                stops == 0 ? null : buildStopDetails(segments),
                new BigDecimal(offer.path("price").path("grandTotal").asText("0")).intValue(),
                offer.path("price").path("currency").asText("EUR"),
                true,
                false,
                8,
                null,
                null
        );
    }

    private FlightOfferDto toAviationstackDto(JsonNode flight, FlightSearchRequest request) {
        JsonNode airline = flight.path("airline");
        JsonNode departure = flight.path("departure");
        JsonNode arrival = flight.path("arrival");
        JsonNode flightDetails = flight.path("flight");

        String airlineCode = textOrFallback(airline.path("iata"), airline.path("icao").asText(""));
        String airlineName = textOrFallback(airline.path("name"), airlineCode);
        String departureAirport = textOrFallback(departure.path("iata"), request.from().code());
        String arrivalAirport = textOrFallback(arrival.path("iata"), request.to().code());
        String departureTime = timeOnly(departure.path("scheduled").asText());
        String arrivalTime = timeOnly(arrival.path("scheduled").asText());
        String duration = scheduledDuration(departure.path("scheduled").asText(), arrival.path("scheduled").asText());
        String flightNumber = textOrFallback(flightDetails.path("iata"), flightDetails.path("number").asText(UUID.randomUUID().toString()));

        int price = estimatedPrice(departureAirport, arrivalAirport, airlineCode);

        return new FlightOfferDto(
                flightNumber,
                new FlightOfferDto.AirlineDto(airlineCode, airlineName, airlineCode.toLowerCase(Locale.ROOT)),
                new FlightOfferDto.FlightEndpointDto(departureTime, departureAirport, request.from().city()),
                new FlightOfferDto.FlightEndpointDto(arrivalTime, arrivalAirport, request.to().city()),
                duration,
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

    private boolean routeMatches(JsonNode flight, FlightSearchRequest request) {
        String departureAirport = flight.path("departure").path("iata").asText("");
        String arrivalAirport = flight.path("arrival").path("iata").asText("");

        return request.from().code().equalsIgnoreCase(departureAirport)
                && request.to().code().equalsIgnoreCase(arrivalAirport);
    }

    private List<FlightOfferDto> fallbackFlights(FlightSearchRequest request) {
        // TODO: Aviationstack free plans may not expose route/date search. Replace fallback when a plan/provider supports offers.
        String[][] airlines = {
                {"EW", "Eurowings"},
                {"LH", "Lufthansa"},
                {"AF", "Air France"},
                {"KL", "KLM"},
                {"SN", "Brussels Airlines"},
                {"IB", "Iberia"},
                {"BA", "British Airways"},
                {"VY", "Vueling"}
        };
        int seed = Math.abs((request.from().code() + request.to().code() + request.departureDate()).hashCode());
        int baseDurationMinutes = 85 + (seed % 155);
        int basePrice = 70 + (seed % 180);

        List<FlightOfferDto> flights = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            String[] airline = airlines[(seed + i) % airlines.length];
            int departureMinutes = 390 + (i * 165) + (seed % 25);
            int durationMinutes = baseDurationMinutes + (i % 3) * 35;
            int price = basePrice + (i * 28) - (i == 0 ? 18 : 0);
            int stops = i == 1 || i == 4 ? 1 : 0;
            String badgeType = i == 0 ? "cheapest" : i == 2 ? "fastest" : i == 3 ? "recommended" : null;
            String badgeLabel = i == 0 ? "Cheapest" : i == 2 ? "Fastest" : i == 3 ? "Best value" : null;

            flights.add(fallbackFlight(
                    "fs-" + request.from().code() + "-" + request.to().code() + "-" + (i + 1),
                    airline[0],
                    airline[1],
                    timeFromMinutes(departureMinutes),
                    timeFromMinutes(departureMinutes + durationMinutes + stops * 55),
                    durationText(durationMinutes + stops * 55),
                    price,
                    stops,
                    badgeType,
                    badgeLabel,
                    request
            ));
        }

        return flights.stream()
                .sorted(Comparator.comparing(FlightOfferDto::price))
                .toList();
    }

    private FlightOfferDto fallbackFlight(
            String id,
            String airlineCode,
            String airlineName,
            String departureTime,
            String arrivalTime,
            String duration,
            int price,
            int stops,
            String badgeType,
            String badgeLabel,
            FlightSearchRequest request
    ) {
        FlightOfferDto.BadgeDto badge = badgeType == null ? null : new FlightOfferDto.BadgeDto(badgeType, badgeLabel);

        return new FlightOfferDto(
                id,
                new FlightOfferDto.AirlineDto(airlineCode, airlineName, airlineCode.toLowerCase(Locale.ROOT)),
                new FlightOfferDto.FlightEndpointDto(departureTime, request.from().code(), request.from().city()),
                new FlightOfferDto.FlightEndpointDto(arrivalTime, request.to().code(), request.to().city()),
                duration,
                stops,
                stops == 0 ? null : "1 stop",
                price,
                "EUR",
                true,
                stops == 0,
                8,
                stops == 0 ? 23 : null,
                badge
        );
    }

    private FlightOfferDto toDto(FlightOfferEntity entity) {
        FlightOfferDto.BadgeDto badge = entity.getBadgeType() == null
                ? null
                : new FlightOfferDto.BadgeDto(entity.getBadgeType(), entity.getBadgeLabel());

        return new FlightOfferDto(
                entity.getExternalOfferId(),
                new FlightOfferDto.AirlineDto(entity.getAirlineCode(), entity.getAirlineName(), entity.getAirlineColorClass()),
                new FlightOfferDto.FlightEndpointDto(entity.getDepartureTime(), entity.getDepartureAirport(), entity.getDepartureCity()),
                new FlightOfferDto.FlightEndpointDto(entity.getArrivalTime(), entity.getArrivalAirport(), entity.getArrivalCity()),
                entity.getDuration(),
                entity.getStops(),
                entity.getStopDetails(),
                entity.getPrice().intValue(),
                entity.getCurrency(),
                entity.getCarryOnIncluded(),
                entity.getCheckedBagIncluded(),
                entity.getCarryOnWeightKg(),
                entity.getCheckedBagWeightKg(),
                badge
        );
    }

    private FlightOfferDto withBadge(FlightOfferDto offer, int cheapest, int fastestMinutes) {
        if (offer.price() == cheapest) {
            return copyWithBadge(offer, new FlightOfferDto.BadgeDto("cheapest", "Cheapest"));
        }

        if (durationMinutes(offer) == fastestMinutes) {
            return copyWithBadge(offer, new FlightOfferDto.BadgeDto("fastest", "Fastest"));
        }

        return offer;
    }

    private FlightOfferDto copyWithBadge(FlightOfferDto offer, FlightOfferDto.BadgeDto badge) {
        return new FlightOfferDto(
                offer.id(),
                offer.airline(),
                offer.departure(),
                offer.arrival(),
                offer.duration(),
                offer.stops(),
                offer.stopDetails(),
                offer.price(),
                offer.currency(),
                offer.carryOnIncluded(),
                offer.checkedBagIncluded(),
                offer.carryOnWeightKg(),
                offer.checkedBagWeightKg(),
                badge
        );
    }

    private String buildStopDetails(JsonNode segments) {
        List<String> stopAirports = new ArrayList<>();
        for (int i = 0; i < segments.size() - 1; i++) {
            stopAirports.add(segments.path(i).path("arrival").path("iataCode").asText());
        }
        return stopAirports.size() + " stop" + (stopAirports.size() == 1 ? "" : "s") + " · " + String.join(", ", stopAirports);
    }

    private String timeOnly(String dateTime) {
        return dateTime == null || dateTime.length() < 16 ? "" : dateTime.substring(11, 16);
    }

    private String scheduledDuration(String departureAt, String arrivalAt) {
        try {
            LocalDateTime departure = LocalDateTime.parse(departureAt.replace("Z", ""));
            LocalDateTime arrival = LocalDateTime.parse(arrivalAt.replace("Z", ""));
            Duration duration = Duration.between(departure, arrival);
            if (duration.isNegative() || duration.isZero()) {
                return "0h 0m";
            }
            return duration.toHours() + "h " + duration.toMinutesPart() + "m";
        } catch (Exception ex) {
            // TODO: Aviationstack free data may omit schedules; replace with route duration data when available.
            return "0h 0m";
        }
    }

    private int estimatedPrice(String departureAirport, String arrivalAirport, String airlineCode) {
        // TODO: Aviationstack is not a pricing API. Replace this estimate when a pricing/offers provider is added.
        int seed = Math.abs((departureAirport + arrivalAirport + airlineCode).hashCode());
        return 80 + (seed % 220);
    }

    private String timeFromMinutes(int minutesAfterMidnight) {
        LocalTime time = LocalTime.MIDNIGHT.plusMinutes(minutesAfterMidnight);
        return "%02d:%02d".formatted(time.getHour(), time.getMinute());
    }

    private String durationText(int minutes) {
        return (minutes / 60) + "h " + (minutes % 60) + "m";
    }

    private String textOrFallback(JsonNode node, String fallback) {
        return node == null || node.isMissingNode() || node.isNull() || node.asText().isBlank()
                ? fallback
                : node.asText();
    }

    private String formatIsoDuration(String isoDuration) {
        Duration duration = Duration.parse(isoDuration);
        return duration.toHours() + "h " + duration.toMinutesPart() + "m";
    }

    private int durationMinutes(FlightOfferDto offer) {
        String[] parts = offer.duration().replace("h", "").replace("m", "").trim().split("\\s+");
        int hours = parts.length > 0 && !parts[0].isBlank() ? Integer.parseInt(parts[0]) : 0;
        int minutes = parts.length > 1 && !parts[1].isBlank() ? Integer.parseInt(parts[1]) : 0;
        return hours * 60 + minutes;
    }

    private List<FlightSearchRequest.MultiCitySegmentDto> readMultiCitySegments(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readerForListOf(FlightSearchRequest.MultiCitySegmentDto.class).readValue(json);
        } catch (Exception ex) {
            return List.of();
        }
    }
}
