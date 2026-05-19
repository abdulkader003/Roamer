package com.sep.hotels.repository;

import com.sep.hotels.model.Hotel;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HotelRepository extends JpaRepository<Hotel, Long> {

    List<Hotel> findByCityContainingIgnoreCase(String city);

    long countByCityIgnoreCase(String city);

    boolean existsByExternalIdAndSource(String externalId, String source);

    Optional<Hotel> findByExternalIdAndSource(String externalId, String source);

    @EntityGraph(attributePaths = {"amenities", "images"})
    List<Hotel> findWithDetailsByCityIgnoreCase(String city);
}
