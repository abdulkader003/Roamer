package com.sep.hotels.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.*;

@Component
public class AgodaRapidApiClient {

    public static final String SOURCE = "AGODA_RAPIDAPI";

    private static final Logger log = LoggerFactory.getLogger(AgodaRapidApiClient.class);
    private static final int MAX_HOTELS_PER_CITY = 15;
    private static final String AUTO_COMPLETE_PATH = "/hotels-homes/auto-complete";
    private static final String OVERNIGHT_SEARCH_PATH = "/hotels-homes/overnight-stays/search";

    private final String apiKey;
    private final String apiHost;
    private final String baseUrl;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public AgodaRapidApiClient(
            @Value("${agoda.rapidapi.key:}") String apiKey,
            @Value("${agoda.rapidapi.host:agoda-com.p.rapidapi.com}") String apiHost,
            @Value("${agoda.rapidapi.base-url:https://agoda-com.p.rapidapi.com}") String baseUrl,
            ObjectMapper objectMapper
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(15));
        this.apiKey = apiKey;
        this.apiHost = apiHost;
        this.baseUrl = baseUrl;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader("X-RapidAPI-Host", apiHost)
                .build();
    }

    public List<AgodaHotel> searchHotels(String city, String checkIn, String checkOut, int adults, int children) {
        log.info("USING AGODA RAPIDAPI for city '{}'", city);
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RAPIDAPI_KEY missing");
            return List.of();
        }

        try {
            JsonNode autocomplete = fetchAutocomplete(city);
            String location = locationFromAutocomplete(city, autocomplete);
            JsonNode searchResults = fetchOvernightSearch(location, checkIn, checkOut, adults, children);
            List<JsonNode> propertyNodes = collectPropertyNodes(searchResults);
            log.info("Agoda RapidAPI search property candidates for '{}': {}", city, propertyNodes.size());
            logFirstHotelLocationDebug(city, propertyNodes);

            List<AgodaHotel> hotels = new ArrayList<>();
            Set<String> seenExternalIds = new LinkedHashSet<>();
            for (JsonNode propertyNode : propertyNodes) {
                if (hotels.size() >= MAX_HOTELS_PER_CITY) {
                    break;
                }

                String propertyId = propertyId(propertyNode).orElse(null);
                if (propertyId == null || !seenExternalIds.add(propertyId)) {
                    continue;
                }

                AgodaHotel hotel = toHotel(city, propertyId, propertyNode, propertyNode, propertyNode);
                if (hotel != null) {
                    hotels.add(hotel);
                }
            }

            log.info("Agoda RapidAPI hotel count for '{}': {}", city, hotels.size());
            return hotels;
        } catch (Exception ex) {
            log.warn("Agoda RapidAPI hotel search failed for city '{}': {}", city, ex.getMessage());
            return List.of();
        }
    }

    private JsonNode fetchAutocomplete(String city) throws Exception {
        log.info("Agoda RapidAPI endpoint called: GET {}{}?q={}", baseUrl, AUTO_COMPLETE_PATH, city);
        ResponseEntity<String> response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(AUTO_COMPLETE_PATH)
                        .queryParam("q", city)
                        .queryParam("language_id", 1)
                        .build())
                .header("X-RapidAPI-Key", apiKey)
                .retrieve()
                .toEntity(String.class);
        log.info("Agoda RapidAPI response status for auto-complete: {}", response.getStatusCode());
        return objectMapper.readTree(response.getBody());
    }

    private String locationFromAutocomplete(String city, JsonNode autocomplete) {
        JsonNode data = autocomplete.path("data");
        if (!data.isArray() || data.isEmpty()) {
            return city;
        }

        JsonNode first = data.get(0);
        for (JsonNode candidate : data) {
            String candidateName = firstText(candidate.path("DisplayNames"), "Name")
                    .or(() -> firstText(candidate, "CityName", "name"))
                    .orElse("");
            String category = firstText(candidate.path("DisplayNames"), "CategoryName")
                    .or(() -> firstText(candidate, "typeName"))
                    .orElse("");
            if (candidateName.equalsIgnoreCase(city) && category.equalsIgnoreCase("City")) {
                first = candidate;
                break;
            }
        }

        JsonNode selected = first;
        String name = firstText(selected.path("DisplayNames"), "Name")
                .or(() -> firstText(selected, "CityName", "name"))
                .orElse(city);
        String hierarchy = firstText(selected.path("DisplayNames"), "GeoHierarchyName")
                .or(() -> firstText(selected, "CountryName"))
                .orElse("");
        if (hierarchy.isBlank() || name.toLowerCase().contains(hierarchy.toLowerCase())) {
            return name;
        }
        return name + ", " + hierarchy;
    }

    private JsonNode fetchOvernightSearch(String location, String checkIn, String checkOut, int adults, int children) throws Exception {
        log.info(
                "Agoda RapidAPI endpoint called: GET {}{}?location={}&checkin_date={}&checkout_date={}&adults={}&rooms=1",
                baseUrl,
                OVERNIGHT_SEARCH_PATH,
                location,
                checkIn,
                checkOut,
                adults
        );
        ResponseEntity<String> response = restClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder
                            .path(OVERNIGHT_SEARCH_PATH)
                            .queryParam("location", location)
                            .queryParam("checkin_date", checkIn)
                            .queryParam("checkout_date", checkOut)
                            .queryParam("adults", adults)
                            .queryParam("rooms", 1)
                            .queryParam("language_id", 1);
                    if (children > 0) {
                        builder.queryParam("child_ages", childrenAges(children));
                    }
                    return builder.build();
                })
                .header("X-RapidAPI-Key", apiKey)
                .retrieve()
                .toEntity(String.class);
        log.info("Agoda RapidAPI response status for overnight search: {}", response.getStatusCode());
        return objectMapper.readTree(response.getBody());
    }

    private AgodaHotel toHotel(String city, String propertyId, JsonNode propertyNode, JsonNode detailsNode, JsonNode ratesNode) {
        String name = firstText(detailsNode, "displayName", "defaultName", "name", "hotelName", "propertyName", "title")
                .or(() -> firstText(propertyNode, "displayName", "defaultName", "name", "hotelName", "propertyName", "title"))
                .orElse(null);
        if (name == null || name.isBlank()) {
            return null;
        }

        List<String> images = extractImages(detailsNode);
        if (images.isEmpty()) {
            images = extractImages(propertyNode);
        }

        BigDecimal price = firstDecimal(ratesNode, "price", "finalPrice", "displayPrice", "dailyRate", "roomPrice", "amount")
                .or(() -> firstDecimal(detailsNode, "price", "finalPrice", "displayPrice", "dailyRate", "roomPrice", "amount"))
                .orElse(null);

        Double ratingScore = firstDecimal(detailsNode, "reviewScore", "review_score", "score", "reviewRating")
                .or(() -> firstDecimal(propertyNode, "reviewScore", "review_score", "score", "reviewRating"))
                .map(BigDecimal::doubleValue)
                .orElse(null);

        return new AgodaHotel(
                "agoda:" + propertyId,
                name,
                city,
                latitude(detailsNode).or(() -> latitude(propertyNode)).orElse(null),
                longitude(detailsNode).or(() -> longitude(propertyNode)).orElse(null),
                locationText(detailsNode).or(() -> locationText(propertyNode)).orElse(null),
                firstInteger(detailsNode, "stars", "starRating", "hotelStarRating", "accommodationTypeStarRating", "rating").or(() -> firstInteger(propertyNode, "stars", "starRating", "rating")).orElse(null),
                price,
                ratingScore,
                firstText(detailsNode, "ratingText", "reviewScoreText", "reviewSummary", "ratingLabel").orElse(null),
                firstInteger(detailsNode, "reviewCount", "numberOfReviews", "reviewsCount").or(() -> firstInteger(propertyNode, "reviewCount", "numberOfReviews")).orElse(null),
                distance(detailsNode).or(() -> distance(propertyNode)).orElse(null),
                firstText(detailsNode, "description", "shortDescription", "overview").orElse(null),
                extractAmenities(detailsNode),
                images
        );
    }

    private void logFirstHotelLocationDebug(String city, List<JsonNode> propertyNodes) {
        if (propertyNodes.isEmpty()) {
            log.info("Agoda location debug for '{}': no property nodes available", city);
            return;
        }

        JsonNode first = propertyNodes.get(0);
        log.info(
                "Agoda location debug for '{}': address='{}', location='{}', area='{}', district='{}', neighborhood='{}', latitude='{}', longitude='{}', distance='{}', distanceFromCenter='{}', city='{}'",
                city,
                locationText(first).orElse(null),
                firstText(first, "location", "locationName").orElse(null),
                nestedText(first, "/content/informationSummary/address/area/name").or(() -> nestedText(first, "/informationSummary/address/area/name")).or(() -> firstText(first, "area", "areaName")).orElse(null),
                firstText(first, "district", "districtName").orElse(null),
                firstText(first, "neighborhood", "neighbourhood", "neighborhoodName").orElse(null),
                latitude(first).map(String::valueOf).orElse(null),
                longitude(first).map(String::valueOf).orElse(null),
                firstText(first, "distance").orElse(null),
                firstText(first, "distanceFromCenter", "distanceFromCityCenter").orElse(null),
                nestedText(first, "/content/informationSummary/address/city/name").or(() -> nestedText(first, "/informationSummary/address/city/name")).or(() -> firstText(first, "city", "cityName")).orElse(null)
        );
        log.info("Agoda raw first hotel response for '{}': {}", city, abbreviate(first.toString(), 4000));
    }

    private Optional<String> locationText(JsonNode node) {
        Optional<String> nestedArea = nestedText(node, "/content/informationSummary/address/area/name")
                .or(() -> nestedText(node, "/informationSummary/address/area/name"))
                .or(() -> nestedText(node, "/address/area/name"));
        if (nestedArea.isPresent()) {
            return nestedArea;
        }

        return firstText(
                node,
                "address",
                "addressLine",
                "fullAddress",
                "locationName",
                "location",
                "areaName",
                "area",
                "districtName",
                "district",
                "neighborhoodName",
                "neighborhood",
                "neighbourhood",
                "cityName"
        );
    }

    private Optional<Double> latitude(JsonNode node) {
        return firstDecimal(node, "latitude", "lat")
                .map(BigDecimal::doubleValue);
    }

    private Optional<Double> longitude(JsonNode node) {
        return firstDecimal(node, "longitude", "lng", "lon")
                .map(BigDecimal::doubleValue);
    }

    private String childrenAges(int children) {
        if (children <= 0) {
            return "";
        }
        return "10,".repeat(children).replaceAll(",$", "");
    }

    private Optional<String> distance(JsonNode node) {
        return firstDecimal(node, "distanceFromCityCenter")
                .map(distance -> distance.stripTrailingZeros().toPlainString() + " km from city center")
                .or(() -> firstText(node, "distance", "distanceFromCenter"));
    }

    private String abbreviate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength) + "...";
    }

    private List<JsonNode> collectPropertyNodes(JsonNode root) {
        List<JsonNode> nodes = new ArrayList<>();
        collectPropertyNodes(root, nodes);
        return nodes;
    }

    private void collectPropertyNodes(JsonNode node, List<JsonNode> nodes) {
        if (node == null || node.isMissingNode() || nodes.size() >= MAX_HOTELS_PER_CITY * 3) {
            return;
        }
        if (node.isObject()) {
            if (isPropertyNode(node)) {
                nodes.add(node);
            }
            node.fields().forEachRemaining(entry -> collectPropertyNodes(entry.getValue(), nodes));
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                collectPropertyNodes(item, nodes);
            }
        }
    }

    private boolean isPropertyNode(JsonNode node) {
        if (propertyId(node).isEmpty()) {
            return false;
        }
        String type = firstText(node, "type", "category", "suggestionType", "entityType").orElse("").toLowerCase();
        return type.isBlank()
                || type.contains("hotel")
                || type.contains("property")
                || type.contains("accommodation")
                || type.contains("apartment");
    }

    private Optional<String> propertyId(JsonNode node) {
        return firstDirectText(node, "propertyId", "property_id", "hotelId", "hotel_id", "agodaPropertyId")
                .or(() -> firstDirectText(node.path("content"), "propertyId", "property_id", "hotelId", "hotel_id", "agodaPropertyId"))
                .or(() -> firstDirectText(node.path("content").path("informationSummary"), "propertyId", "property_id", "hotelId", "hotel_id", "agodaPropertyId"))
                .or(() -> firstDirectText(node.path("informationSummary"), "propertyId", "property_id", "hotelId", "hotel_id", "agodaPropertyId"));
    }

    private List<String> extractImages(JsonNode node) {
        LinkedHashSet<String> images = new LinkedHashSet<>();
        collectImages(node, images);
        return images.stream().limit(7).toList();
    }

    private void collectImages(JsonNode node, Set<String> images) {
        if (node == null || node.isMissingNode() || images.size() >= 7) {
            return;
        }
        if (node.isTextual()) {
            String value = node.asText();
            if (isImageUrl(value)) {
                images.add(normalizeImageUrl(value));
            }
            return;
        }
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                collectImages(entry.getValue(), images);
            });
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                collectImages(item, images);
            }
        }
    }

    private boolean isImageUrl(String value) {
        String lower = value == null ? "" : value.toLowerCase();
        return (lower.startsWith("http") || lower.startsWith("//"))
                && (lower.contains(".jpg") || lower.contains(".jpeg") || lower.contains(".png") || lower.contains("agoda"));
    }

    private String normalizeImageUrl(String value) {
        if (value.startsWith("//")) {
            return "https:" + value;
        }
        return value;
    }

    private List<String> extractAmenities(JsonNode node) {
        LinkedHashSet<String> amenities = new LinkedHashSet<>();
        collectAmenities(node, amenities);
        return amenities.stream().limit(12).toList();
    }

    private void collectAmenities(JsonNode node, Set<String> amenities) {
        if (node == null || node.isMissingNode() || amenities.size() >= 12) {
            return;
        }
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey().toLowerCase();
                if (key.contains("amenit") || key.contains("facilit") || key.contains("highlight")) {
                    collectAmenityValues(entry.getValue(), amenities);
                } else if (entry.getValue().isContainerNode()) {
                    collectAmenities(entry.getValue(), amenities);
                }
            });
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                collectAmenities(item, amenities);
            }
        }
    }

    private void collectAmenityValues(JsonNode node, Set<String> amenities) {
        if (node == null || node.isMissingNode() || amenities.size() >= 12) {
            return;
        }
        if (node.isTextual()) {
            String value = node.asText();
            if (!value.isBlank() && value.length() <= 80) {
                amenities.add(value);
            }
        } else if (node.isObject()) {
            firstText(node, "name", "title", "text", "description").ifPresent(amenities::add);
            node.fields().forEachRemaining(entry -> collectAmenityValues(entry.getValue(), amenities));
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                collectAmenityValues(item, amenities);
            }
        }
    }

    private Optional<String> firstText(JsonNode node, String... fields) {
        if (node == null || node.isMissingNode()) {
            return Optional.empty();
        }
        for (String field : fields) {
            Optional<String> value = findText(node, field);
            if (value.isPresent()) {
                return value;
            }
        }
        return Optional.empty();
    }

    private Optional<String> firstDirectText(JsonNode node, String... fields) {
        if (node == null || node.isMissingNode()) {
            return Optional.empty();
        }
        for (String field : fields) {
            JsonNode value = node.path(field);
            if (value.isTextual() || value.isNumber()) {
                String text = value.asText();
                if (!text.isBlank()) {
                    return Optional.of(text);
                }
            }
        }
        return Optional.empty();
    }

    private Optional<String> nestedText(JsonNode node, String pointer) {
        if (node == null || node.isMissingNode()) {
            return Optional.empty();
        }
        JsonNode value = node.at(pointer);
        if (value.isTextual() || value.isNumber()) {
            String text = value.asText();
            if (!text.isBlank()) {
                return Optional.of(text);
            }
        }
        return Optional.empty();
    }

    private Optional<String> findText(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isTextual() || value.isNumber()) {
            String text = value.asText();
            if (!text.isBlank()) {
                return Optional.of(text);
            }
        }
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                Optional<String> result = findText(fields.next().getValue(), field);
                if (result.isPresent()) {
                    return result;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                Optional<String> result = findText(item, field);
                if (result.isPresent()) {
                    return result;
                }
            }
        }
        return Optional.empty();
    }

    private Optional<Integer> firstInteger(JsonNode node, String... fields) {
        return firstText(node, fields).flatMap(value -> {
            try {
                return Optional.of(Integer.parseInt(value.replaceAll("[^0-9]", "")));
            } catch (NumberFormatException ex) {
                return Optional.empty();
            }
        });
    }

    private Optional<BigDecimal> firstDecimal(JsonNode node, String... fields) {
        return firstText(node, fields).flatMap(value -> {
            try {
                String normalized = value.replaceAll("[^0-9.]", "");
                return normalized.isBlank() ? Optional.empty() : Optional.of(new BigDecimal(normalized));
            } catch (NumberFormatException ex) {
                return Optional.empty();
            }
        });
    }
}
