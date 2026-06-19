package com.sep.trip;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Persistence access for user-owned trips.
 */
public interface TripRepository extends JpaRepository<Trip, Long> {
    /**
     * Keeps the overview deterministic and prevents data from other users leaking
     * into the authenticated user's response.
     */
    List<Trip> findAllByOwnerIdOrderByStartDateAsc(Long ownerId);
}
