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
            new WeatherLocation("Bangkok", 13.756331, 100.501762),
            new WeatherLocation("Paris", 48.856613, 2.352222),
            new WeatherLocation("London", 51.507351, -0.127758),
            new WeatherLocation("Dubai", 25.204849, 55.270782),
            new WeatherLocation("Singapore", 1.352083, 103.819836),
            new WeatherLocation("Kuala Lumpur", 3.139003, 101.686855),
            new WeatherLocation("New York City", 40.712776, -74.005974),
            new WeatherLocation("Istanbul", 41.008240, 28.978359),
            new WeatherLocation("Tokyo", 35.676193, 139.650311),
            new WeatherLocation("Seoul", 37.566536, 126.977966),
            new WeatherLocation("Hong Kong", 22.319304, 114.169361),
            new WeatherLocation("Barcelona", 41.385063, 2.173404),
            new WeatherLocation("Rome", 41.902782, 12.496366),
            new WeatherLocation("Amsterdam", 52.367573, 4.904139),
            new WeatherLocation("Milan", 45.464203, 9.189982),
            new WeatherLocation("Vienna", 48.208176, 16.373819),
            new WeatherLocation("Prague", 50.075539, 14.437800),
            new WeatherLocation("Madrid", 40.416775, -3.703790),
            new WeatherLocation("Berlin", 52.520008, 13.404954),
            new WeatherLocation("Los Angeles", 34.052235, -118.243683),
            new WeatherLocation("Miami", 25.761681, -80.191788),
            new WeatherLocation("Sydney", -33.868820, 151.209290),
            new WeatherLocation("Toronto", 43.653225, -79.383186),
            new WeatherLocation("Las Vegas", 36.169941, -115.139832)
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
    public List<WeatherDto> getWeather(List<String> requestedCities) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Weather API URL is not configured.");
        }

        List<WeatherDto> weatherItems = new ArrayList<>();

        for (WeatherLocation location : resolveLocations(requestedCities)) {
            weatherItems.add(getWeatherForLocation(location));
        }

        return weatherItems;
    }

    private List<WeatherLocation> resolveLocations(List<String> requestedCities) {
        if (requestedCities == null || requestedCities.isEmpty()) {
            return WEATHER_LOCATIONS;
        }

        return requestedCities.stream()
                .flatMap(city -> java.util.Arrays.stream(city == null ? new String[] { "" } : city.split(",")))
                .map(String::trim)
                .filter(city -> !city.isBlank())
                .map(this::findLocation)
                .toList();
    }

    private WeatherLocation findLocation(String city) {
        return WEATHER_LOCATIONS.stream()
                .filter(location -> location.name().equalsIgnoreCase(city == null ? "" : city.trim()))
                .findFirst()
                .orElseGet(() -> new WeatherLocation(city == null || city.isBlank() ? "Unknown" : city.trim(), 40.712776, -74.005974));
    }

    private WeatherDto getWeatherForLocation(WeatherLocation location) {
        if (!fallbackUrl.isBlank()) {
            return loadFromFallbackOrRapidApiOrError(location);
        }

        try {
            return loadFromRapidApi(location);
        } catch (RestClientResponseException exception) {
            log.warn("Weather RapidAPI request failed for {}: status={} body={}", location.name(), exception.getStatusCode().value(), truncate(exception.getResponseBodyAsString()));
            return failedWeather(location.name(), "Weather unavailable");
        } catch (RuntimeException exception) {
            log.warn("Unable to load weather data from RapidAPI provider for {}.", location.name(), exception);
            return failedWeather(location.name(), "Weather unavailable");
        }
    }

    private WeatherDto loadFromFallbackOrRapidApiOrError(WeatherLocation location) {
        try {
            return loadFromFallback(location);
        } catch (RestClientResponseException exception) {
            log.warn("Weather fallback request failed for {}: status={} body={}", location.name(), exception.getStatusCode().value(), truncate(exception.getResponseBodyAsString()));
            return loadFromRapidApiOrError(location, exception);
        } catch (RuntimeException exception) {
            log.warn("Unable to load weather data from fallback provider for {}.", location.name(), exception);
            return loadFromRapidApiOrError(location, exception);
        }
    }

    private WeatherDto loadFromRapidApiOrError(WeatherLocation location, RuntimeException fallbackFailure) {
        if (apiUrl.isBlank() || PLACEHOLDER_URL.equals(apiUrl)) {
            return failedWeather(location.name(), "Weather unavailable");
        }

        try {
            return loadFromRapidApi(location);
        } catch (RestClientResponseException exception) {
            log.warn("Weather RapidAPI request failed for {} after fallback failure: status={} body={}", location.name(), exception.getStatusCode().value(), truncate(exception.getResponseBodyAsString()));
            return failedWeather(location.name(), "Weather unavailable");
        } catch (RuntimeException exception) {
            log.warn("Unable to load weather data from RapidAPI provider for {} after fallback failure.", location.name(), exception);
            return failedWeather(location.name(), "Weather unavailable");
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

    private WeatherDto loadFromFallback(WeatherLocation location) {
        log.info("Loading weather from fallback provider city={} url={}", location.name(), fallbackUrl);

        JsonNode payload = restClient
                .get()
                .uri(buildUri(fallbackUrl, location))
                .retrieve()
                .body(JsonNode.class);

        WeatherDto weather = mapProviderResponse(requirePayload(payload, "fallback weather provider"), location.name());
        log.info("Fallback weather mapped city={} temperature={} condition={}", weather.city(), weather.temperatureC(), weather.condition());
        return weather;
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
