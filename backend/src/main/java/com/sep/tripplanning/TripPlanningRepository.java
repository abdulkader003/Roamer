package com.sep.tripplanning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripPlanningRepository extends JpaRepository<TripPlanning, Long> {
    List<TripPlanning> findByUserEmailIgnoreCaseOrderByUpdatedAtDesc(String email);
}
