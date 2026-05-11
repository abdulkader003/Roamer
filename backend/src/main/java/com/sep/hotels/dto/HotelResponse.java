package com.sep.hotels.dto;

import java.math.BigDecimal;
import java.util.List;

public record HotelResponse(
        Long id,
        String name,
        String city,
        BigDecimal pricePerNight,
        Double rating,
        Double ratingScore,
        String ratingLabel,
        Integer reviewCount,
        Integer stars,
        String checkIn,
        String checkOut,
        String distance,
        String distanceFromCenter,
        String tag,
        String description,
        List<String> amenities,
        Integer adults,
        Integer children,
        String image,
        List<String> images
) {
}
