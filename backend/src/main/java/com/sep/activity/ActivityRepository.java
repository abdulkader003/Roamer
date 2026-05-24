package com.sep.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends JpaRepository<ActivityEntity, Long> {
    Optional<ActivityEntity> findByExternalId(String externalId);

    List<ActivityEntity> findByCityIgnoreCaseOrderByStartDateAsc(String city);

    List<ActivityEntity> findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
            String city,
            LocalDateTime fetchedAfter
    );

    List<ActivityEntity> findTop80ByOrderByFetchedAtDesc();
}