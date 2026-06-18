package com.sep.weather;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.manyTimes;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class WeatherServiceTest {

    @Test
    void getWeatherReturnsConfiguredCityListFromRapidApiForecastResponse() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        WeatherService weatherService = new WeatherService(
                builder,
                "https://weather.example.test/current?latitude={latitude}&longitude={longitude}",
                "open-weather13.p.rapidapi.com",
                "test-key",
                ""
        );

        server.expect(manyTimes(), requestTo(org.hamcrest.Matchers.startsWith("https://weather.example.test/current?latitude=")))
                .andExpect(header("x-rapidapi-host", "open-weather13.p.rapidapi.com"))
                .andExpect(header("x-rapidapi-key", "test-key"))
                .andRespond(withSuccess("""
                        {
                          "list": [
                            {
                              "main": { "temp": 22.6, "humidity": 61 },
                              "weather": [{ "description": "partly cloudy", "icon": "02d" }],
                              "wind": { "speed": 14.2 }
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        List<WeatherDto> weather = weatherService.getWeather(List.of("Bangkok", "Paris", "London", "Dubai", "Singapore", "Kuala Lumpur"));

        assertThat(weather).hasSize(6);
        assertThat(weather).extracting(WeatherDto::city)
                .containsExactly("Bangkok", "Paris", "London", "Dubai", "Singapore", "Kuala Lumpur");
        assertThat(weather).allSatisfy(item -> {
            assertThat(item.temperatureC()).isEqualTo(22.6);
            assertThat(item.condition()).isEqualTo("Partly cloudy");
            assertThat(item.error()).isNull();
        });
        server.verify();
    }

    @Test
    void getWeatherUsesFallbackProviderForRequestedCities() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        WeatherService weatherService = new WeatherService(
                builder,
                "https://open-weather13.p.rapidapi.com/fivedaysforcast?latitude={latitude}&longitude={longitude}&lang=EN",
                "open-weather13.p.rapidapi.com",
                "test-key",
                "https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto"
        );

        server.expect(manyTimes(), requestTo(org.hamcrest.Matchers.startsWith("https://api.open-meteo.com/v1/forecast?latitude=")))
                .andRespond(withSuccess("""
                        {
                          "current": {
                            "temperature_2m": 32.0,
                            "relative_humidity_2m": 38,
                            "weather_code": 3,
                            "wind_speed_10m": 22.8
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        List<WeatherDto> weather = weatherService.getWeather(List.of("New York City", "Istanbul", "Tokyo", "Seoul", "Hong Kong", "Barcelona"));

        assertThat(weather).hasSize(6);
        assertThat(weather).allSatisfy(item -> {
            assertThat(item.temperatureC()).isEqualTo(32.0);
            assertThat(item.condition()).isEqualTo("Partly cloudy");
            assertThat(item.humidity()).isEqualTo(38);
            assertThat(item.windKph()).isEqualTo(22.8);
            assertThat(item.error()).isNull();
        });
        server.verify();
    }

    @Test
    void getWeatherReturnsPerCityErrorsWhenAllProvidersFail() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        WeatherService weatherService = new WeatherService(
                builder,
                "https://open-weather13.p.rapidapi.com/fivedaysforcast?latitude={latitude}&longitude={longitude}&lang=EN",
                "open-weather13.p.rapidapi.com",
                "test-key",
                "https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto"
        );

        server.expect(manyTimes(), requestTo(org.hamcrest.Matchers.startsWith("https://api.open-meteo.com/v1/forecast?latitude=")))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        server.expect(manyTimes(), requestTo(org.hamcrest.Matchers.startsWith("https://open-weather13.p.rapidapi.com/fivedaysforcast?latitude=")))
                .andRespond(withStatus(HttpStatus.FORBIDDEN));

        List<WeatherDto> weather = weatherService.getWeather(List.of("Rome", "Amsterdam", "Milan", "Vienna", "Prague", "Madrid"));

        assertThat(weather).hasSize(6);
        assertThat(weather).allSatisfy(item -> {
            assertThat(item.city()).isNotBlank();
            assertThat(item.error()).isEqualTo("Weather unavailable");
        });
        server.verify();
    }

    @Test
    void getWeatherRejectsMissingConfiguration() {
        WeatherService weatherService = new WeatherService(RestClient.builder(), "PASTE_YOUR_API_URL_HERE", "open-weather13.p.rapidapi.com", "", "");

        assertThatThrownBy(() -> weatherService.getWeather(List.of("Berlin")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Weather API URL is not configured");
    }
}
