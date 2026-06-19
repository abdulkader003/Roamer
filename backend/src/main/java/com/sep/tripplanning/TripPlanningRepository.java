package com.sep.tripplanning;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TripPlanningRepository extends JpaRepository<TripPlanning, Long> {

    void deleteAllByUserId(Long userId);
}
