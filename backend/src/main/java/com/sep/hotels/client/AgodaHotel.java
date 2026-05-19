package com.sep.hotels.client;

import java.math.BigDecimal;
import java.util.List;

public record AgodaHotel(
        String externalId,
        String name,
        String city,
        Double latitude,
        Double longitude,
        String address,
        Integer stars,
        BigDecimal pricePerNight,
        Double ratingScore,
        String ratingLabel,
        Integer reviewCount,
        String distance,
        String description,
        List<String> amenities,
        List<String> images
) {
}
