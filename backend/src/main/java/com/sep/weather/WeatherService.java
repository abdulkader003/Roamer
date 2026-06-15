package com.sep.weather;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Retrieves weather data from the configured providers and normalizes provider-specific
 * responses into DTOs suitable for the dashboard.
 */
@Service
public class WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);
    private static final String PLACEHOLDER_URL = "PASTE_YOUR_API_URL_HERE";
    private static final List<WeatherLocation> WEATHER_LOCATIONS = List.of(
            new WeatherLocation("Berlin", 52.520008, 13.404954),
            new WeatherLocation("Paris", 48.856613, 2.352222),
            new WeatherLocation("Rome", 41.902782, 12.496366),
            new WeatherLocation("Istanbul", 41.008240, 28.978359),
            new WeatherLocation("Dubai", 25.204849, 55.270782),
            new WeatherLocation("New York", 40.730610, -73.935242)
    );

    private final RestClient restClient;
    private final String apiUrl;
    private final String rapidApiHost;
    private final String rapidApiKey;
    private final String fallbackUrl;

    public WeatherService(
            RestClient.Builder restClientBuilder,
            @Value("${weather.api-url:}") String apiUrl,
            @Value("${weather.rapidapi-host:open-weather13.p.rapidapi.com}") String rapidApiHost,
            @Value("${weather.rapidapi-key:}") String rapidApiKey,
            @Value("${weather.fallback-url:}") String fallbackUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.apiUrl = apiUrl == null ? "" : apiUrl.trim();
        this.rapidApiHost = rapidApiHost == null ? "" : rapidApiHost.trim();
        this.rapidApiKey = rapidApiKey == null ? "" : rapidApiKey.trim();
        this.fallbackUrl = fallbackUrl == null ? "" : fallbackUrl.trim();
    }

    /**
     * Loads weather for the dashboard city set. A provider failure for one city is
     * isolated to that city so the dashboard can still render the remaining data.
     */
    public List<WeatherDto> getWeather() {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Weather API URL is not configured.");
        }

        List<WeatherDto> weatherItems = new ArrayList<>();

        for (WeatherLocation location : WEATHER_LOCATIONS) {
            weatherItems.add(getWeatherForLocation(location));
        }

        return weatherItems;
    }

    private WeatherDto getWeatherForLocation(WeatherLocation location) {
        try {
            return loadFromRapidApi(location);
        } catch (RestClientResponseException exception) {
            log.warn("Weather RapidAPI request failed for {}: status={} body={}", location.name(), exception.getStatusCode().value(), truncate(exception.getResponseBodyAsString()));
            return loadFromFallbackOrError(location, exception);
        } catch (RuntimeException exception) {
            log.warn("Unable to load weather data from RapidAPI provider for {}.", location.name(), exception);
            return loadFromFallbackOrError(location, exception);
        }
    }

    private WeatherDto loadFromRapidApi(WeatherLocation location) {
        log.info("Loading weather from RapidAPI provider city={} url={} host={} keyConfigured={}", location.name(), apiUrl, rapidApiHost, !rapidApiKey.isBlank());

        JsonNode payload = restClient
                .get()
                .uri(buildUri(apiUrl, location))
                .headers(headers -> {
                    headers.set("Content-Type", "application/json");
                    if (!rapidApiHost.isBlank()) {
                        headers.set("x-rapidapi-host", rapidApiHost);
                    }
                    if (!rapidApiKey.isBlank()) {
                        headers.set("x-rapidapi-key", rapidApiKey);
                    }
                })
                .retrieve()
                .body(JsonNode.class);

        WeatherDto weather = mapProviderResponse(requirePayload(payload, "RapidAPI"), location.name());
        log.info("RapidAPI weather mapped city={} temperature={} condition={}", weather.city(), weather.temperatureC(), weather.condition());
        return weather;
    }

    private WeatherDto loadFromFallbackOrError(WeatherLocation location, RuntimeException primaryFailure) {
        if (fallbackUrl.isBlank()) {
            log.warn("No weather fallback configured for {}.", location.name(), primaryFailure);
            return failedWeather(location.name(), "Weather unavailable");
        }

        try {
            log.info("Loading weather from fallback provider city={} url={}", location.name(), fallbackUrl);

            JsonNode payload = restClient
                    .get()
                    .uri(buildUri(fallbackUrl, location))
                    .retrieve()
                    .body(JsonNode.class);

            WeatherDto weather = mapProviderResponse(requirePayload(payload, "fallback weather provider"), location.name());
            log.info("Fallback weather mapped city={} temperature={} condition={}", weather.city(), weather.temperatureC(), weather.condition());
            return weather;
        } catch (RestClientResponseException exception) {
            log.warn("Weather fallback request failed for {}: status={} body={}", location.name(), exception.getStatusCode().value(), truncate(exception.getResponseBodyAsString()));
            return failedWeather(location.name(), "Weather unavailable");
        } catch (RuntimeException exception) {
            log.warn("Unable to load weather data from fallback provider for {}.", location.name(), exception);
            return failedWeather(location.name(), "Weather unavailable");
        }
    }

    private WeatherDto failedWeather(String city, String error) {
        return new WeatherDto(city, null, null, null, null, null, error);
    }

    private JsonNode requirePayload(JsonNode payload, String providerName) {
        if (payload == null || payload.isMissingNode() || payload.isNull()) {
            log.warn("{} returned an empty weather response.", providerName);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Weather provider returned an empty response.");
        }

        return payload;
    }

    private boolean isConfigured() {
        return (!apiUrl.isBlank() && !PLACEHOLDER_URL.equals(apiUrl)) || !fallbackUrl.isBlank();
    }

    private URI buildUri(String url, WeatherLocation location) {
        if (url.contains("{city}") || url.contains("{q}") || url.contains("{latitude}") || url.contains("{longitude}")) {
            return UriComponentsBuilder.fromUriString(url)
                    .buildAndExpand(Map.of(
                            "city", location.name(),
                            "q", location.name(),
                            "latitude", location.latitude(),
                            "longitude", location.longitude()
                    ))
                    .toUri();
        }

        return UriComponentsBuilder.fromUriString(url).build(true).toUri();
    }

    private WeatherDto mapProviderResponse(JsonNode payload, String cityName) {
        JsonNode forecast = payload.path("list").isArray() && !payload.path("list").isEmpty()
                ? payload.path("list").path(0)
                : payload;

        Double temperature = firstDouble(
                forecast.path("current").path("temp_c"),
                forecast.path("current").path("temperature_2m"),
                forecast.path("current_weather").path("temperature"),
                forecast.path("main").path("temp"),
                forecast.path("temperature"),
                forecast.path("temp")
        );

        if (temperature != null && temperature > 80) {
            temperature = Math.round((temperature - 273.15) * 10.0) / 10.0;
        }

        String condition = firstText(
                forecast.path("current").path("condition").path("text"),
                forecast.path("weather").path(0).path("description"),
                forecast.path("condition"),
                forecast.path("description")
        );

        if (condition == null) {
            condition = weatherCodeLabel(firstInteger(
                    forecast.path("current").path("weather_code"),
                    forecast.path("current_weather").path("weathercode")
            ));
        }

        String icon = firstText(
                forecast.path("current").path("condition").path("icon"),
                forecast.path("weather").path(0).path("icon"),
                forecast.path("icon")
        );

        Integer humidity = firstInteger(
                forecast.path("current").path("humidity"),
                forecast.path("current").path("relative_humidity_2m"),
                forecast.path("main").path("humidity"),
                forecast.path("humidity")
        );

        Double windKph = firstDouble(
                forecast.path("current").path("wind_kph"),
                forecast.path("current").path("wind_speed_10m"),
                forecast.path("wind").path("speed"),
                forecast.path("current_weather").path("windspeed"),
                forecast.path("windKph")
        );

        return new WeatherDto(
                cityName,
                temperature,
                humanize(condition),
                icon,
                humidity,
                windKph,
                null
        );
    }

    private String firstText(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && !node.isMissingNode() && !node.isNull()) {
                String value = node.asText("").trim();
                if (!value.isBlank()) {
                    return value;
                }
            }
        }
        return null;
    }

    private Double firstDouble(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && node.isNumber()) {
                return Math.round(node.asDouble() * 10.0) / 10.0;
            }
            if (node != null && node.isTextual()) {
                try {
                    return Math.round(Double.parseDouble(node.asText()) * 10.0) / 10.0;
                } catch (NumberFormatException ignored) {
                    // Try the next candidate field.
                }
            }
        }
        return null;
    }

    private Integer firstInteger(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && node.isNumber()) {
                return node.asInt();
            }
            if (node != null && node.isTextual()) {
                try {
                    return Integer.parseInt(node.asText());
                } catch (NumberFormatException ignored) {
                    // Try the next candidate field.
                }
            }
        }
        return null;
    }

    private String weatherCodeLabel(Integer code) {
        if (code == null) {
            return null;
        }

        return switch (code) {
            case 0 -> "Clear sky";
            case 1, 2, 3 -> "Partly cloudy";
            case 45, 48 -> "Fog";
            case 51, 53, 55, 56, 57 -> "Drizzle";
            case 61, 63, 65, 66, 67, 80, 81, 82 -> "Rain";
            case 71, 73, 75, 77, 85, 86 -> "Snow";
            case 95, 96, 99 -> "Thunderstorm";
            default -> "Current forecast";
        };
    }

    private String truncate(String value) {
        if (value == null || value.length() <= 240) {
            return value;
        }

        return value.substring(0, 240) + "...";
    }

    private String humanize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.replace('_', ' ').replace('-', ' ').trim().toLowerCase(Locale.ROOT);
        return normalized.substring(0, 1).toUpperCase(Locale.ROOT) + normalized.substring(1);
    }

    private record WeatherLocation(String name, double latitude, double longitude) {
    }
}
