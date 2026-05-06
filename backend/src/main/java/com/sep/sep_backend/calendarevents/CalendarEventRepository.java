package com.sep.sep_backend.calendarevents;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {
}