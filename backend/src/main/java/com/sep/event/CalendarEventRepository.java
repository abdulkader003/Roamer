package com.sep.event;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for the shared travel calendar event store.
 */
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {
    void deleteByTripId(Long tripId);
}
