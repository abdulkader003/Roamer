package com.sep.sep_backend.calendarevents;

import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/calendar-events")
@CrossOrigin(origins = "*")
public class CalendarEventController {

    private final CalendarEventRepository calendarEventRepository;

    public CalendarEventController(CalendarEventRepository calendarEventRepository) {
        this.calendarEventRepository = calendarEventRepository;
    }

    @GetMapping
    public List<CalendarEvent> getAllCalendarEvents() {
        return calendarEventRepository.findAll();
    }

    @PostMapping
    public CalendarEvent createCalendarEvent(@RequestBody CalendarEvent calendarEvent) {
        if (calendarEvent.getCategory() == null || calendarEvent.getCategory().isBlank()) {
            calendarEvent.setCategory("EVENT");
        }

        return calendarEventRepository.save(calendarEvent);
    }
}