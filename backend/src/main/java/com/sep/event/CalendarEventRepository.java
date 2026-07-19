package com.sep.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Repository for the shared travel calendar event store.
 */
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {
    List<CalendarEvent> findAllByTripId(Long tripId);

    @Transactional
    void deleteByTripId(Long tripId);

    @Transactional
    void deleteByTripIdIn(List<Long> tripIds);
}
