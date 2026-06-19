package com.sep.weather;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Weather API facade used by the frontend so browser clients never call the
 * external weather provider or hold provider credentials directly.
 */
@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    @GetMapping
    public List<WeatherDto> getWeather(@RequestParam(value = "city", required = false) List<String> cities) {
        return weatherService.getWeather(cities);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleWeatherError(ResponseStatusException exception) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        return ResponseEntity
                .status(status == null ? HttpStatus.BAD_GATEWAY : status)
                .body(Map.of("message", exception.getReason() == null ? "Unable to load weather data." : exception.getReason()));
    }
}
