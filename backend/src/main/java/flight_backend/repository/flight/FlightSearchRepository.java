package flight_backend.repository.flight;

import flight_backend.entity.flight.FlightSearchEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;

public interface FlightSearchRepository extends JpaRepository<FlightSearchEntity, Long> {
    @EntityGraph(attributePaths = "offers")
    Optional<FlightSearchEntity> findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
            String tripType,
            String fromCode,
            String toCode,
            LocalDate departureDate,
            LocalDate returnDate,
            Integer adults,
            Integer children,
            String cabinClass,
            OffsetDateTime createdAfter
    );

    @EntityGraph(attributePaths = "offers")
    Optional<FlightSearchEntity> findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassAndCreatedAtAfterOrderByCreatedAtDesc(
            String tripType,
            String fromCode,
            String toCode,
            LocalDate departureDate,
            Integer adults,
            Integer children,
            String cabinClass,
            OffsetDateTime createdAfter
    );
}
