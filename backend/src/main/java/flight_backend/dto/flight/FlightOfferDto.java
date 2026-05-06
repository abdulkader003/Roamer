package flight_backend.dto.flight;

public record FlightOfferDto(
        String id,
        AirlineDto airline,
        FlightEndpointDto departure,
        FlightEndpointDto arrival,
        String duration,
        Integer stops,
        String stopDetails,
        Integer price,
        String currency,
        Boolean carryOnIncluded,
        Boolean checkedBagIncluded,
        Integer carryOnWeightKg,
        Integer checkedBagWeightKg,
        BadgeDto badge
) {
    public record AirlineDto(
            String code,
            String name,
            String colorClass
    ) {
    }

    public record FlightEndpointDto(
            String time,
            String airport,
            String city
    ) {
    }

    public record BadgeDto(
            String type,
            String label
    ) {
    }
}
