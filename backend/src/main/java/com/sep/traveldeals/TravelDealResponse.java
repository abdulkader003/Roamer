package com.sep.traveldeals;

import java.math.BigDecimal;

public record TravelDealResponse(
        String id,
        String type,
        String title,
        String origin,
        String destination,
        BigDecimal price,
        String currency,
        String provider,
        String description,
        String actionLabel,
        String actionRoute
) {
}
