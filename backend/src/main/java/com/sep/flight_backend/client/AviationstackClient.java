package com.sep.flight_backend.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.flight_backend.config.AviationstackProperties;
import com.sep.flight_backend.dto.flight.FlightSearchRequest;
import com.sep.flight_backend.exception.ExternalApiException;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class AviationstackClient {
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public AviationstackClient(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            AviationstackProperties aviationstackProperties
    ) {
        this.webClient = webClientBuilder
                .baseUrl(aviationstackProperties.getBaseUrl())
                .filter((request, next) -> {
                    var authenticatedUrl = UriComponentsBuilder.fromUri(request.url())
                            .queryParam("access_key", aviationstackProperties.getAccessKey())
                            .build(true)
                            .toUri();
                    ClientRequest authenticatedRequest = ClientRequest.from(request)
                            .url(authenticatedUrl)
                            .build();
                    return next.exchange(authenticatedRequest);
                })
                .build();
        this.objectMapper = objectMapper;
    }

    public JsonNode searchFlights(FlightSearchRequest request) {
        try {
            return webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/flights")
                            .queryParam("limit", 100)
                            .build())
                    .exchangeToMono(response -> response.bodyToMono(String.class)
                            .map(body -> {
                                JsonNode json = readJson(body);
                                if (response.statusCode().isError() || json.has("error")) {
                                    throw new ExternalApiException("Aviationstack flights error "
                                            + response.statusCode().value() + ": " + body);
                                }
                                return json;
                            }))
                    .block();
        } catch (ExternalApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ExternalApiException("Failed to fetch flights from Aviationstack: " + ex.getMessage(), ex);
        }
    }

    private JsonNode readJson(String body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception ex) {
            throw new ExternalApiException("Aviationstack response was not valid JSON: " + body, ex);
        }
    }
}
