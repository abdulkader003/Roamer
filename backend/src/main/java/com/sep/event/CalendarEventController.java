package com.sep.event;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
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
        applyDefaults(calendarEvent);
        return calendarEventRepository.save(calendarEvent);
    }

    @PutMapping("/{id}")
    public CalendarEvent updateCalendarEvent(
            @PathVariable Long id,
            @RequestBody CalendarEvent calendarEvent
    ) {
        CalendarEvent existingEvent = calendarEventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar event not found"));

        existingEvent.setTitle(calendarEvent.getTitle());
        existingEvent.setDescription(calendarEvent.getDescription());
        existingEvent.setLocation(calendarEvent.getLocation());
        existingEvent.setStartDateTime(calendarEvent.getStartDateTime());
        existingEvent.setEndDateTime(calendarEvent.getEndDateTime());
        existingEvent.setCategory(calendarEvent.getCategory());
        existingEvent.setBudgetCost(calendarEvent.getBudgetCost());
        existingEvent.setNotes(calendarEvent.getNotes());

        applyDefaults(existingEvent);
        return calendarEventRepository.save(existingEvent);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCalendarEvent(@PathVariable Long id) {
        if (!calendarEventRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar event not found");
        }

        calendarEventRepository.deleteById(id);
    }

    private void applyDefaults(CalendarEvent calendarEvent) {
        if (calendarEvent.getCategory() == null || calendarEvent.getCategory().isBlank()) {
            calendarEvent.setCategory("EVENT");
        }
    }
}
