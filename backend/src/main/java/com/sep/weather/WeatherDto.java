package com.sep.weather;

/**
 * Simplified weather payload returned to the frontend.
 */
public record WeatherDto(
        String city,
        Double temperatureC,
        String condition,
        String icon,
        Integer humidity,
        Double windKph,
        String error
) {
}
