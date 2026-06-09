package com.sep.hotel.repository;

import com.sep.hotel.model.Hotel;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for cached hotel inventory and provider identity lookups.
 */
public interface HotelRepository extends JpaRepository<Hotel, Long> {

    List<Hotel> findByCityContainingIgnoreCase(String city);

    long countByCityIgnoreCase(String city);

    boolean existsByExternalIdAndSource(String externalId, String source);

    Optional<Hotel> findByExternalIdAndSource(String externalId, String source);

    /**
     * Loads hotel cards with child collections eagerly to avoid lazy loading while mapping responses.
     */
    @EntityGraph(attributePaths = {"amenities", "images"})
    List<Hotel> findWithDetailsByCityIgnoreCase(String city);
}
