package com.sep.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for cached Ticketmaster activity imports.
 */
public interface ActivityRepository extends JpaRepository<ActivityEntity, Long> {
    Optional<ActivityEntity> findByExternalId(String externalId);

    List<ActivityEntity> findByCityIgnoreCaseOrderByStartDateAsc(String city);

    /**
     * Finds city activities still inside the service cache freshness window.
     */
    List<ActivityEntity> findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
            String city,
            LocalDateTime fetchedAfter
    );

    /**
     * Provides a recent global activity feed when the user has not selected a city.
     */
    List<ActivityEntity> findTop80ByOrderByFetchedAtDesc();
}
