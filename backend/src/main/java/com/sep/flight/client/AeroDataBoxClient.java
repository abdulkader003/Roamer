package com.sep.flight.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sep.flight.config.AeroDataBoxProperties;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.exception.ExternalApiException;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Adapter for AeroDataBox flight departures.
 *
 * <p>The client splits a day into two provider calls, merges the departures, and
 * enforces a small local delay to reduce RapidAPI rate-limit responses.</p>
 */
@Component
public class AeroDataBoxClient {
    private static final long MIN_REQUEST_INTERVAL_MILLIS = 1_200L;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final Object rateLimitLock = new Object();
    private long lastRequestAtMillis;

    public AeroDataBoxClient(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            AeroDataBoxProperties aeroDataBoxProperties
    ) {
        this.webClient = webClientBuilder
                .baseUrl(aeroDataBoxProperties.getBaseUrl())
                .defaultHeader("X-RapidAPI-Key", aeroDataBoxProperties.getRapidapiKey())
                .defaultHeader("X-RapidAPI-Host", aeroDataBoxProperties.getRapidapiHost())
                .defaultHeader(HttpHeaders.ACCEPT, "application/json")
                .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Fetches all departure offers for the requested origin and date.
     *
     * @throws ExternalApiException when the provider response fails or is invalid
     */
    public JsonNode searchFlights(FlightSearchRequest request) {
        try {
            LocalDateTime dayStart = request.departureDate().atStartOfDay();
            JsonNode firstHalf = fetchFlightsWindow(request, dayStart, request.departureDate().atTime(LocalTime.of(11, 59)));
            JsonNode secondHalf = fetchFlightsWindow(request, request.departureDate().atTime(LocalTime.NOON), request.departureDate().atTime(LocalTime.of(23, 59)));

            ObjectNode merged = objectMapper.createObjectNode();
            ArrayNode departures = merged.putArray("departures");
            appendFlights(departures, firstHalf.path("departures"));
            appendFlights(departures, secondHalf.path("departures"));
            return merged;
        } catch (ExternalApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ExternalApiException("Failed to fetch flights from AeroDataBox: " + ex.getMessage(), ex);
        }
    }

    /**
     * Performs one provider request for a time window and retries once for 429 rate limits.
     */
    private JsonNode fetchFlightsWindow(FlightSearchRequest request, LocalDateTime fromLocal, LocalDateTime toLocal) {
        ExternalApiException lastException = null;

        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                waitForRateLimitSlot();
                return webClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .path("/flights/airports/iata/{airportCode}/{fromLocal}/{toLocal}")
                                .queryParam("direction", "Departure")
                                .queryParam("withLeg", true)
                                .queryParam("withCancelled", false)
                                .queryParam("withCodeshared", false)
                                .queryParam("withCargo", false)
                                .queryParam("withPrivate", false)
                                .queryParam("withLocation", false)
                                .build(request.from().code(), fromLocal.toString(), toLocal.toString()))
                        .exchangeToMono(response -> response.bodyToMono(String.class)
                                .map(body -> {
                                    JsonNode json = readJson(body);
                                    if (response.statusCode().isError()) {
                                        throw new ExternalApiException("AeroDataBox flights error "
                                                + response.statusCode().value() + ": " + body);
                                    }
                                    return json;
                                }))
                        .block();
            } catch (ExternalApiException ex) {
                lastException = ex;
                if (!ex.getMessage().contains("429") || attempt == 1) {
                    throw ex;
                }
                sleep(MIN_REQUEST_INTERVAL_MILLIS);
            }
        }

        throw lastException == null
                ? new ExternalApiException("Failed to fetch flights from AeroDataBox")
                : lastException;
    }

    /**
     * Serializes outbound provider requests to keep minimum spacing between calls.
     */
    private void waitForRateLimitSlot() {
        synchronized (rateLimitLock) {
            long now = System.currentTimeMillis();
            long waitMillis = MIN_REQUEST_INTERVAL_MILLIS - (now - lastRequestAtMillis);
            if (waitMillis > 0) {
                sleep(waitMillis);
            }
            lastRequestAtMillis = System.currentTimeMillis();
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ExternalApiException("Interrupted while waiting for AeroDataBox rate limit", ex);
        }
    }

    private void appendFlights(ArrayNode target, JsonNode source) {
        if (source == null || !source.isArray()) {
            return;
        }

        source.forEach(target::add);
    }

    private JsonNode readJson(String body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception ex) {
            throw new ExternalApiException("AeroDataBox response was not valid JSON: " + body, ex);
        }
    }
}
