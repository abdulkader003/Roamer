package com.sep.hotels.service;

import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class CityNameMapper {

    private static final Map<String, String> CITY_ALIASES = Map.of(
            "wien", "Vienna",
            "mailand", "Milan",
            "rom", "Rome",
            "madera", "Funchal",
            "madeira", "Funchal"
    );

    public String normalize(String location) {
        String trimmed = location == null ? "" : location.trim();
        if (trimmed.isBlank()) {
            return trimmed;
        }
        return CITY_ALIASES.getOrDefault(trimmed.toLowerCase(), capitalize(trimmed));
    }

    private String capitalize(String value) {
        String[] words = value.toLowerCase().split("\\s+");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (!result.isEmpty()) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }
}
