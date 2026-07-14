package com.sep.flight.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.sep.flight.config.AeroDataBoxProperties;
import com.sep.flight.dto.flight.FlightSearchRequest;
import com.sep.flight.exception.ExternalApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AeroDataBoxClientTest {

    @Test
    void searchFlightsMergesSuccessfulResponsesAndSendsExpectedHeaders() {
        RecordingExchangeFunction exchangeFunction = new RecordingExchangeFunction();
        exchangeFunction.enqueue(ClientResponse.create(HttpStatus.OK)
                .body("""
                        {"departures":[{"id":"out-1"},{"id":"out-2"}]}
                        """)
                .build());
        exchangeFunction.enqueue(ClientResponse.create(HttpStatus.OK)
                .body("""
                        {"departures":[{"id":"ret-1"}]}
                        """)
                .build());

        AeroDataBoxClient client = client(exchangeFunction);
        FlightSearchRequest request = oneWayRequest();

        JsonNode result = client.searchFlights(request);

        assertThat(result.path("departures")).hasSize(3);
        assertThat(result.path("departures").get(0).path("id").asText()).isEqualTo("out-1");
        assertThat(result.path("departures").get(2).path("id").asText()).isEqualTo("ret-1");
        assertThat(exchangeFunction.requests()).hasSize(2);
        assertThat(exchangeFunction.requests().get(0).url().toString())
                .contains("/flights/airports/iata/DUS/2026-08-14T00%3A00/2026-08-14T11%3A59");
        assertThat(exchangeFunction.requests().get(1).url().toString())
                .contains("/flights/airports/iata/DUS/2026-08-14T12%3A00/2026-08-14T23%3A59");
        assertThat(exchangeFunction.requests().get(0).url().toString())
                .contains("direction=Departure");
        assertThat(exchangeFunction.requests().get(0).headers().getFirst("X-RapidAPI-Key")).isEqualTo("test-key");
        assertThat(exchangeFunction.requests().get(0).headers().getFirst(HttpHeaders.ACCEPT)).isEqualTo("application/json");
        assertThat(exchangeFunction.requests().get(0).headers().getFirst("X-RapidAPI-Host")).isEqualTo("api.example.test");
    }

    @Test
    void searchFlightsReturnsEmptyMergedResponseWhenProviderReturnsEmptyArrays() {
        RecordingExchangeFunction exchangeFunction = new RecordingExchangeFunction();
        exchangeFunction.enqueue(ClientResponse.create(HttpStatus.OK).body("{\"departures\":[]}").build());
        exchangeFunction.enqueue(ClientResponse.create(HttpStatus.OK).body("{\"departures\":[]}").build());

        AeroDataBoxClient client = client(exchangeFunction);

        JsonNode result = client.searchFlights(oneWayRequest());

        assertThat(result.path("departures")).isEmpty();
        assertThat(exchangeFunction.requests()).hasSize(2);
    }

    @Test
    void searchFlightsWrapsNullBodyAndOtherCommunicationFailures() {
        RecordingExchangeFunction nullBodyExchange = new RecordingExchangeFunction();
        nullBodyExchange.enqueue(ClientResponse.create(HttpStatus.OK).build());
        nullBodyExchange.enqueue(ClientResponse.create(HttpStatus.OK).body("{\"departures\":[]}").build());

        AeroDataBoxClient client = client(nullBodyExchange);

        assertThatThrownBy(() -> client.searchFlights(oneWayRequest()))
                .isInstanceOf(ExternalApiException.class)
                .hasMessageContaining("Failed to fetch flights from AeroDataBox");
        assertThat(nullBodyExchange.requests()).hasSize(2);

        RecordingExchangeFunction failingExchange = new RecordingExchangeFunction();
        failingExchange.enqueue(Mono.error(new IllegalStateException("socket timeout")));

        AeroDataBoxClient failingClient = client(failingExchange);

        assertThatThrownBy(() -> failingClient.searchFlights(oneWayRequest()))
                .isInstanceOf(ExternalApiException.class)
                .hasMessageContaining("socket timeout");
        assertThat(failingExchange.requests()).hasSize(1);
    }

    @Test
    void searchFlightsPropagatesMalformedJsonAndHttpErrorResponses() {
        RecordingExchangeFunction malformedExchange = new RecordingExchangeFunction();
        malformedExchange.enqueue(ClientResponse.create(HttpStatus.OK).body("not-json").build());

        AeroDataBoxClient malformedClient = client(malformedExchange);

        assertThatThrownBy(() -> malformedClient.searchFlights(oneWayRequest()))
                .isInstanceOf(ExternalApiException.class)
                .hasMessageContaining("response was not valid JSON");
        assertThat(malformedExchange.requests()).hasSize(1);

        RecordingExchangeFunction errorExchange = new RecordingExchangeFunction();
        errorExchange.enqueue(ClientResponse.create(HttpStatus.BAD_REQUEST)
                .body("{\"error\":\"bad request\"}")
                .build());

        AeroDataBoxClient errorClient = client(errorExchange);

        assertThatThrownBy(() -> errorClient.searchFlights(oneWayRequest()))
                .isInstanceOf(ExternalApiException.class)
                .hasMessageContaining("AeroDataBox flights error 400");
        assertThat(errorExchange.requests()).hasSize(1);
    }

    @Test
    void searchFlightsRetriesOnceAfterRateLimitResponse() {
        RecordingExchangeFunction exchangeFunction = new RecordingExchangeFunction();
        exchangeFunction.enqueue(ClientResponse.create(HttpStatus.TOO_MANY_REQUESTS)
                .body("{\"error\":\"rate limit\"}")
                .build());
        exchangeFunction.enqueue(ClientResponse.create(HttpStatus.OK)
                .body("""
                        {"departures":[{"id":"out-1"}]}
                        """)
                .build());
        exchangeFunction.enqueue(ClientResponse.create(HttpStatus.OK)
                .body("""
                        {"departures":[{"id":"ret-1"}]}
                        """)
                .build());

        AeroDataBoxClient client = client(exchangeFunction);

        JsonNode result = client.searchFlights(oneWayRequest());

        assertThat(result.path("departures")).hasSize(2);
        assertThat(exchangeFunction.requests()).hasSize(3);
    }

    private AeroDataBoxClient client(RecordingExchangeFunction exchangeFunction) {
        AeroDataBoxProperties properties = new AeroDataBoxProperties();
        properties.setBaseUrl("https://api.example.test");
        properties.setRapidapiKey("test-key");
        properties.setRapidapiHost("api.example.test");

        return new AeroDataBoxClient(
                WebClient.builder().exchangeFunction(exchangeFunction),
                new com.fasterxml.jackson.databind.ObjectMapper(),
                properties
        );
    }

    private FlightSearchRequest oneWayRequest() {
        return new FlightSearchRequest(
                "one-way",
                new FlightSearchRequest.AirportDto("DUS", "Düsseldorf", "Düsseldorf Intl."),
                new FlightSearchRequest.AirportDto("BCN", "Barcelona", "Barcelona-El Prat"),
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

    private static final class RecordingExchangeFunction implements ExchangeFunction {
        private final Queue<Object> responses = new ArrayDeque<>();
        private final List<ClientRequest> requests = new ArrayList<>();

        void enqueue(ClientResponse response) {
            responses.add(response);
        }

        void enqueue(Mono<ClientResponse> response) {
            responses.add(response);
        }

        List<ClientRequest> requests() {
            return requests;
        }

        @Override
        public Mono<ClientResponse> exchange(ClientRequest request) {
            requests.add(request);
            Object next = responses.remove();

            if (next instanceof Mono<?> mono) {
                @SuppressWarnings("unchecked")
                Mono<ClientResponse> typed = (Mono<ClientResponse>) mono;
                return typed;
            }

            return Mono.just((ClientResponse) next);
        }
    }
}
