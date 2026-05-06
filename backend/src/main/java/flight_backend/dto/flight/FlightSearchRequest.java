package flight_backend.dto.flight;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;
import java.util.List;

public record FlightSearchRequest(
        @NotBlank
        @Pattern(regexp = "one-way|round-trip|multi-city")
        String tripType,

        @Valid @NotNull AirportDto from,
        @Valid @NotNull AirportDto to,

        LocalDate departureDate,
        LocalDate returnDate,

        List<@Valid MultiCitySegmentDto> multiCitySegments,

        @Min(1) Integer travelers,
        @Min(1) Integer adults,
        @Min(0) Integer children,

        @NotBlank
        @Pattern(regexp = "economy|premium|business|first")
        String cabinClass
) {
    public Integer travelers() {
        return travelers == null ? adults() + children() : travelers;
    }

    public Integer adults() {
        return adults == null ? 1 : adults;
    }

    public Integer children() {
        return children == null ? 0 : children;
    }

    public record AirportDto(
            String code,
            String city,
            String fullName
    ) {
    }

    public record MultiCitySegmentDto(
            @NotBlank String fromText,
            @NotBlank String toText,
            LocalDate date
    ) {
    }
}
