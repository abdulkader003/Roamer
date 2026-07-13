package com.sep.flight.repository.flight;

import com.sep.flight.entity.flight.FlightSearchEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Repository for persisted flight searches and their cached offers.
 */
public interface FlightSearchRepository extends JpaRepository<FlightSearchEntity, Long> {
    @EntityGraph(attributePaths = "offers")
    Optional<FlightSearchEntity> findWithOffersById(Long id);

    /**
     * Finds a recent cached round-trip search with offers eagerly loaded.
     */
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

    /**
     * Finds the newest matching round-trip cache regardless of age for provider outage/quota fallback.
     */
    @EntityGraph(attributePaths = "offers")
    Optional<FlightSearchEntity> findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateAndAdultsAndChildrenAndCabinClassOrderByCreatedAtDesc(
            String tripType,
            String fromCode,
            String toCode,
            LocalDate departureDate,
            LocalDate returnDate,
            Integer adults,
            Integer children,
            String cabinClass
    );

    /**
     * Finds a recent cached one-way search with offers eagerly loaded.
     */
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

    /**
     * Finds the newest matching one-way cache regardless of age for provider outage/quota fallback.
     */
    @EntityGraph(attributePaths = "offers")
    Optional<FlightSearchEntity> findFirstByTripTypeAndFromCodeAndToCodeAndDepartureDateAndReturnDateIsNullAndAdultsAndChildrenAndCabinClassOrderByCreatedAtDesc(
            String tripType,
            String fromCode,
            String toCode,
            LocalDate departureDate,
            Integer adults,
            Integer children,
            String cabinClass
    );
}
