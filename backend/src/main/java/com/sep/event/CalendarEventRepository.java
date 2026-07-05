package com.sep.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Repository for the shared travel calendar event store.
 */
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {
    @Transactional
    void deleteByTripId(Long tripId);
}
