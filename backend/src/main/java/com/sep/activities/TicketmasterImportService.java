package com.sep.activities;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class TicketmasterImportService {
    private static final String EVENTS_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
    private static final String EVENT_URL = "https://app.ticketmaster.com/discovery/v2/events/{id}.json";
    private static final String EVENT_IMAGES_URL = "https://app.ticketmaster.com/discovery/v2/events/{id}/images.json";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(4);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(6);

    private final String apiKey;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public TicketmasterImportService(
            @Value("${ticketmaster.api-key:}") String apiKey,
            ObjectMapper objectMapper,
            RestTemplateBuilder restTemplateBuilder
    ) {
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(CONNECT_TIMEOUT)
                .setReadTimeout(READ_TIMEOUT)
                .build();
    }

    public List<ActivityEntity> importByCity(String city) {
        return importByCity(city, null, 0, 40).getActivities();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public List<ActivityEntity> importByCity(String city, String keyword) {
        return importByCity(city, keyword, 0, 40).getActivities();
    }

    public ActivityImportBatch importByCity(String city, String keyword, int page, int size) {
        if (!isConfigured()) {
            return new ActivityImportBatch(List.of(), false);
        }

        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromHttpUrl(EVENTS_URL)
                    .queryParam("apikey", apiKey)
                    .queryParam("city", city)
                    .queryParam("size", size)
                    .queryParam("page", page)
                    .queryParam("sort", "date,asc")
                    .queryParam("includeSpellcheck", "yes");

            if (keyword != null && !keyword.isBlank()) {
                builder.queryParam("keyword", keyword.trim());
            }

            JsonNode root = fetchJson(builder.build().toUriString());
            JsonNode events = root.path("_embedded").path("events");

            if (!events.isArray()) {
                return new ActivityImportBatch(List.of(), false);
            }

            List<ActivityEntity> activities = new ArrayList<>();

            for (JsonNode event : events) {
                ActivityEntity activity = mapEvent(event, city, false);
                if (activity != null) {
                    activities.add(activity);
                }
            }

            activities.sort(Comparator.comparing(
                    ActivityEntity::getStartDate,
                    Comparator.nullsLast(Comparator.naturalOrder())
            ));

            JsonNode pageNode = root.path("page");
            int currentPage = pageNode.path("number").asInt(page);
            int totalPages = pageNode.path("totalPages").asInt(currentPage + (activities.size() >= size ? 2 : 1));
            boolean hasMore = currentPage + 1 < totalPages;

            return new ActivityImportBatch(activities, hasMore);
        } catch (Exception exception) {
            System.err.println("Ticketmaster import failed for city " + city + ": " + exception.getMessage());
            return new ActivityImportBatch(List.of(), false);
        }
    }

    public ActivityEntity importByExternalId(String externalId) {
        if (!isConfigured() || externalId == null || externalId.isBlank()) {
            return null;
        }

        try {
            JsonNode event = fetchJson(
                    UriComponentsBuilder
                            .fromHttpUrl(EVENT_URL.replace("{id}", externalId))
                            .queryParam("apikey", apiKey)
                            .build()
                            .toUriString()
            );

            JsonNode imagesResponse = fetchJson(
                    UriComponentsBuilder
                            .fromHttpUrl(EVENT_IMAGES_URL.replace("{id}", externalId))
                            .queryParam("apikey", apiKey)
                            .build()
                            .toUriString()
            );

            JsonNode mergedEvent = mergeEventImages(event, imagesResponse);
            return mapEvent(mergedEvent, null, true);
        } catch (Exception exception) {
            System.err.println("Ticketmaster detail import failed for id " + externalId + ": " + exception.getMessage());
            return null;
        }
    }

    private JsonNode fetchJson(String url) throws Exception {
        String response = restTemplate.getForObject(url, String.class);
        return objectMapper.readTree(response);
    }

    private JsonNode mergeEventImages(JsonNode event, JsonNode imagesResponse) {
        if (!event.isObject()) {
            return event;
        }

        ArrayNode mergedImages = extractImagesNode(imagesResponse);
        if (mergedImages == null || mergedImages.isEmpty()) {
            return event;
        }

        ObjectNode mergedEvent = ((ObjectNode) event).deepCopy();
        mergedEvent.set("images", mergedImages);
        return mergedEvent;
    }

    private ArrayNode extractImagesNode(JsonNode imagesResponse) {
        if (imagesResponse == null || imagesResponse.isMissingNode()) {
            return null;
        }

        if (imagesResponse.path("images").isArray()) {
            return (ArrayNode) imagesResponse.path("images");
        }

        if (imagesResponse.isArray()) {
            return (ArrayNode) imagesResponse;
        }

        return null;
    }

    private ActivityEntity mapEvent(JsonNode event, String requestedCity, boolean detailFetched) {
        String externalId = text(event, "id");
        String title = text(event, "name");

        if (externalId.isBlank() || title.isBlank()) {
            return null;
        }

        JsonNode venueNode = resolveVenueNode(event);
        JsonNode placeNode = event.path("place");
        JsonNode promoterNode = resolvePromoterNode(event);
        JsonNode classificationsNode = event.path("classifications");
        LocalDateTime startDate = resolveStartDate(event);
        LocalDateTime endDate = resolveEndDate(event);
        Double minPrice = resolveMinPrice(event);
        Double maxPrice = resolveMaxPrice(event);
        String priceCurrency = resolvePriceCurrency(event);
        double fallbackPrice = resolveFallbackPrice(externalId);
        double resolvedMinPrice = round(minPrice != null && minPrice > 0 ? minPrice : fallbackPrice);
        double resolvedPrice = resolvedMinPrice;
        double resolvedMaxPrice = round(maxPrice != null && maxPrice >= resolvedMinPrice ? maxPrice : resolvedMinPrice);
        String resolvedCurrency = !priceCurrency.isBlank() ? priceCurrency : "EUR";
        LocalDateTime now = LocalDateTime.now();

        ActivityEntity activity = new ActivityEntity();

        activity.setExternalId(externalId);
        activity.setTitle(clean(title));
        activity.setType(clean(firstNonBlank(text(event, "type"), "event")));
        activity.setUrl(clean(text(event, "url")));
        activity.setLocale(clean(text(event, "locale")));
        activity.setSource(clean(text(event, "source")));
        activity.setCity(clean(firstNonBlank(
                requestedCity,
                nestedText(venueNode, "city", "name"),
                nestedText(placeNode, "city", "name")
        )));
        activity.setCountry(clean(firstNonBlank(
                nestedText(venueNode, "country", "name"),
                nestedText(placeNode, "country", "name"),
                nestedText(venueNode, "country", "countryCode"),
                nestedText(placeNode, "country", "countryCode")
        )));
        activity.setState(clean(firstNonBlank(
                nestedText(venueNode, "state", "name"),
                nestedText(placeNode, "state", "name"),
                nestedText(venueNode, "state", "stateCode"),
                nestedText(placeNode, "state", "stateCode")
        )));
        activity.setSegment(clean(resolveClassificationName(classificationsNode, "segment")));
        activity.setGenre(clean(resolveClassificationName(classificationsNode, "genre")));
        activity.setSubGenre(clean(resolveClassificationName(classificationsNode, "subGenre")));
        activity.setCategory(clean(resolveCategory(classificationsNode)));
        activity.setVenue(clean(firstNonBlank(text(venueNode, "name"), text(placeNode, "name"), "Venue not available")));
        activity.setVenueId(clean(text(venueNode, "id")));
        activity.setVenueUrl(clean(text(venueNode, "url")));
        activity.setVenueTimezone(clean(firstNonBlank(text(venueNode, "timezone"), nestedText(event, "dates", "timezone"))));
        activity.setVenueAddress(clean(resolveAddress(venueNode, placeNode)));
        activity.setVenuePostalCode(clean(firstNonBlank(text(venueNode, "postalCode"), text(placeNode, "postalCode"))));
        activity.setVenueLatitude(resolveCoordinate(firstNonBlank(
                nestedText(venueNode, "location", "latitude"),
                nestedText(placeNode, "location", "latitude")
        )));
        activity.setVenueLongitude(resolveCoordinate(firstNonBlank(
                nestedText(venueNode, "location", "longitude"),
                nestedText(placeNode, "location", "longitude")
        )));
        activity.setDescription(clean(resolveDescription(event)));
        activity.setInfo(clean(text(event, "info")));
        activity.setPleaseNote(clean(text(event, "pleaseNote")));
        activity.setImage(resolveBestImage(event));
        activity.setSeatmapUrl(clean(nestedText(event, "seatmap", "staticUrl")));
        activity.setAccessibilityInfo(clean(firstNonBlank(
                text(event, "accessibility"),
                text(venueNode, "accessibleSeatingDetail"),
                nestedText(venueNode, "ada", "adaCustomCopy")
        )));
        activity.setTicketLimitInfo(clean(text(event, "ticketLimit")));
        activity.setStatus(clean(nestedText(event, "dates", "status", "code")));
        activity.setPromoterName(clean(firstNonBlank(text(promoterNode, "name"), text(event.path("promoters").path(0), "name"))));
        activity.setPromoterDescription(clean(firstNonBlank(
                text(promoterNode, "description"),
                text(event.path("promoters").path(0), "description")
        )));
        activity.setStartDate(startDate);
        activity.setEndDate(endDate);
        activity.setSalesStartDate(resolveDateTime(nestedText(event, "sales", "public", "startDateTime")));
        activity.setSalesEndDate(resolveDateTime(nestedText(event, "sales", "public", "endDateTime")));
        activity.setTimeOfDay(resolveTimeOfDay(startDate));
        activity.setDuration(resolveDuration(event, startDate, endDate));
        activity.setPrice(resolvedPrice);
        activity.setMinPrice(resolvedMinPrice);
        activity.setMaxPrice(resolvedMaxPrice);
        activity.setPriceCurrency(clean(resolvedCurrency));
        activity.setPriceLevel(resolvePriceLevel(resolvedPrice, event));
        activity.setRating(resolveRating(activity.getCategory()));
        activity.setFeatured(isFeatured(activity));
        activity.setTba(event.path("dates").path("start").path("dateTBA").asBoolean(false));
        activity.setTbd(event.path("dates").path("start").path("dateTBD").asBoolean(false));
        activity.setSpanMultipleDays(event.path("dates").path("spanMultipleDays").asBoolean(false));
        activity.setFetchedAt(now);
        activity.setDetailFetchedAt(detailFetched ? now : null);
        activity.setSalesJson(toJson(event.path("sales")));
        activity.setPriceRangesJson(toJson(event.path("priceRanges")));
        activity.setImagesJson(toJson(event.path("images")));
        activity.setVenueDetailsJson(toJson(!venueNode.isMissingNode() ? venueNode : placeNode));
        activity.setAttractionsJson(toJson(event.path("_embedded").path("attractions")));
        activity.setClassificationsJson(toJson(classificationsNode));
        activity.setPromoterJson(toJson(promoterNode));
        activity.setPromotersJson(toJson(event.path("promoters")));
        activity.setOutletsJson(toJson(event.path("outlets")));
        activity.setProductsJson(toJson(event.path("products")));
        activity.setRawEventJson(toJson(event));

        return activity;
    }

    private JsonNode resolveVenueNode(JsonNode event) {
        JsonNode venues = event.path("_embedded").path("venues");
        if (venues.isArray() && !venues.isEmpty()) {
            return venues.get(0);
        }

        return JsonNodeFactory.instance.objectNode();
    }

    private JsonNode resolvePromoterNode(JsonNode event) {
        JsonNode promoter = event.path("promoter");
        if (promoter.isObject()) {
            return promoter;
        }

        JsonNode promoters = event.path("promoters");
        if (promoters.isArray() && !promoters.isEmpty()) {
            return promoters.get(0);
        }

        return JsonNodeFactory.instance.objectNode();
    }

    private String resolveCategory(JsonNode classificationsNode) {
        String genre = resolveClassificationName(classificationsNode, "genre");
        String subGenre = resolveClassificationName(classificationsNode, "subGenre");
        String segment = resolveClassificationName(classificationsNode, "segment");

        if (!genre.isBlank() && !"Undefined".equalsIgnoreCase(genre)) {
            return genre;
        }

        if (!subGenre.isBlank() && !"Undefined".equalsIgnoreCase(subGenre)) {
            return subGenre;
        }

        if (!segment.isBlank() && !"Undefined".equalsIgnoreCase(segment)) {
            return segment;
        }

        return "Miscellaneous";
    }

    private String resolveClassificationName(JsonNode classificationsNode, String key) {
        if (!classificationsNode.isArray() || classificationsNode.isEmpty()) {
            return "";
        }

        return classificationsNode.get(0).path(key).path("name").asText("");
    }

    private String resolveDescription(JsonNode event) {
        String info = text(event, "info");
        String pleaseNote = text(event, "pleaseNote");
        String description = text(event, "description");
        String accessibility = text(event, "accessibility");

        String best = firstNonBlank(description, info, pleaseNote, accessibility);

        if (!best.isBlank()) {
            return limit(best, 900);
        }

        String title = text(event, "name");
        return title + " is available now. Open the event page for the latest details and ticket availability.";
    }

    private String resolveBestImage(JsonNode event) {
        JsonNode images = event.path("images");
        if (!images.isArray() || images.isEmpty()) {
            return "";
        }

        String bestUrl = "";
        int bestScore = -1;

        for (JsonNode image : images) {
            String url = image.path("url").asText("");
            int width = image.path("width").asInt(0);
            int height = image.path("height").asInt(0);
            String ratio = image.path("ratio").asText("");

            if (url.isBlank()) {
                continue;
            }

            int score = width + height;

            if ("16_9".equals(ratio)) {
                score += 3000;
            }

            if (!image.path("fallback").asBoolean(false)) {
                score += 1500;
            }

            if (score > bestScore) {
                bestScore = score;
                bestUrl = url;
            }
        }

        return bestUrl;
    }

    private LocalDateTime resolveStartDate(JsonNode event) {
        return resolveEventDateTime(event.path("dates").path("start"));
    }

    private LocalDateTime resolveEndDate(JsonNode event) {
        JsonNode endNode = event.path("dates").path("end");
        if (!endNode.isObject()) {
            return null;
        }

        return resolveEventDateTime(endNode);
    }

    private LocalDateTime resolveEventDateTime(JsonNode node) {
        try {
            String localDateText = node.path("localDate").asText("");
            String localTimeText = node.path("localTime").asText("");

            if (localDateText.isBlank()) {
                return null;
            }

            LocalDate date = LocalDate.parse(localDateText);
            LocalTime time = localTimeText.isBlank() ? LocalTime.of(19, 0) : LocalTime.parse(localTimeText);

            return LocalDateTime.of(date, time);
        } catch (Exception exception) {
            return null;
        }
    }

    private LocalDateTime resolveDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return LocalDateTime.parse(value.replace("Z", ""));
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private String resolveTimeOfDay(LocalDateTime startDate) {
        if (startDate == null) {
            return "Evening";
        }

        int hour = startDate.getHour();

        if (hour < 12) {
            return "Morning";
        }

        if (hour < 17) {
            return "Afternoon";
        }

        if (hour < 22) {
            return "Evening";
        }

        return "Night";
    }

    private String resolveDuration(JsonNode event, LocalDateTime startDate, LocalDateTime endDate) {
        String duration = text(event, "duration");

        if (!duration.isBlank()) {
            return duration;
        }

        if (startDate != null && endDate != null && endDate.isAfter(startDate)) {
            Duration computed = Duration.between(startDate, endDate);
            long hours = computed.toHours();
            long minutes = computed.minusHours(hours).toMinutes();

            if (hours > 0 && minutes > 0) {
                return hours + "h " + minutes + "m";
            }

            if (hours > 0) {
                return hours + "h";
            }

            if (minutes > 0) {
                return minutes + "m";
            }
        }

        return "See event time";
    }

    private Double resolveMinPrice(JsonNode event) {
        JsonNode priceRanges = event.path("priceRanges");

        if (!priceRanges.isArray() || priceRanges.isEmpty()) {
            return null;
        }

        double minPrice = Double.MAX_VALUE;

        for (JsonNode priceRange : priceRanges) {
            double min = priceRange.path("min").asDouble(0.0);
            if (min > 0 && min < minPrice) {
                minPrice = min;
            }
        }

        return minPrice == Double.MAX_VALUE ? null : minPrice;
    }

    private Double resolveMaxPrice(JsonNode event) {
        JsonNode priceRanges = event.path("priceRanges");

        if (!priceRanges.isArray() || priceRanges.isEmpty()) {
            return null;
        }

        double maxPrice = 0.0;

        for (JsonNode priceRange : priceRanges) {
            double max = priceRange.path("max").asDouble(0.0);
            if (max > maxPrice) {
                maxPrice = max;
            }
        }

        return maxPrice > 0 ? maxPrice : null;
    }

    private String resolvePriceCurrency(JsonNode event) {
        JsonNode priceRanges = event.path("priceRanges");
        if (!priceRanges.isArray() || priceRanges.isEmpty()) {
            return "";
        }

        return priceRanges.get(0).path("currency").asText("");
    }

    private String resolvePriceLevel(Double price, JsonNode event) {
        if (price == null || price <= 0) {
            if (event.path("priceRanges").isMissingNode() || event.path("priceRanges").isEmpty()) {
                return "Unknown";
            }

            return "See ticket page";
        }

        if (price <= 25) {
            return "Budget";
        }

        if (price <= 75) {
            return "Mid-Range";
        }

        return "Premium";
    }

    private double resolveFallbackPrice(String externalId) {
        String seed = externalId == null ? "" : externalId.trim();
        int hash = Math.abs(seed.hashCode());
        return 15 + (hash % 106);
    }

    private Double resolveRating(String category) {
        if (category == null) {
            return 4.3;
        }

        String normalized = category.toLowerCase();

        if (normalized.contains("music") || normalized.contains("concert")) {
            return 4.7;
        }

        if (normalized.contains("theatre") || normalized.contains("arts")) {
            return 4.5;
        }

        if (normalized.contains("sport")) {
            return 4.4;
        }

        return 4.3;
    }

    private Boolean isFeatured(ActivityEntity activity) {
        return activity.getImage() != null
                && !activity.getImage().isBlank()
                && activity.getRating() != null
                && activity.getRating() >= 4.5;
    }

    private String resolveAddress(JsonNode venueNode, JsonNode placeNode) {
        JsonNode addressNode = venueNode.path("address").isObject() ? venueNode.path("address") : placeNode.path("address");
        return joinLines(text(addressNode, "line1"), text(addressNode, "line2"), text(addressNode, "line3"));
    }

    private String joinLines(String... lines) {
        StringBuilder builder = new StringBuilder();

        for (String line : lines) {
            if (line == null || line.isBlank()) {
                continue;
            }

            if (!builder.isEmpty()) {
                builder.append(", ");
            }

            builder.append(line.trim());
        }

        return builder.toString();
    }

    private Double resolveCoordinate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String nestedText(JsonNode node, String... path) {
        JsonNode current = node;
        for (String key : path) {
            current = current.path(key);
        }

        return current.asText("");
    }

    private String text(JsonNode node, String field) {
        return node.path(field).asText("");
    }

    private String toJson(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }

        if (node.isArray() && node.isEmpty()) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception exception) {
            return null;
        }
    }

    private double round(Double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String clean(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("â€“", "–")
                .replace("â€”", "—")
                .replace("Ã©", "é")
                .replace("Ã¨", "è")
                .replace("Ã¼", "ü")
                .replace("Ã¶", "ö")
                .replace("Ã¤", "ä")
                .replace("ÃŸ", "ß")
                .replace("Ã‰", "É")
                .replace("GLÃœCK", "GLÜCK")
                .trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    private String limit(String value, int maxLength) {
        if (value == null) {
            return "";
        }

        String trimmed = value.trim();

        if (trimmed.length() <= maxLength) {
            return trimmed;
        }

        return trimmed.substring(0, maxLength - 3) + "...";
    }
}
