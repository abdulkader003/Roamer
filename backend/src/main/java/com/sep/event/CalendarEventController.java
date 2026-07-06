package com.sep.event;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST API for storing travel calendar items such as flights, hotel stays, and activities.
 *
 * <p>Events are stored with start and end timestamps so the frontend can render
 * both single-day plans and multi-day reservations.</p>
 */
@Tag(name = "Calendar Events", description = "Endpoints for creating, reading, updating, and deleting calendar events.")
@RestController
@RequestMapping("/api/calendar-events")
@CrossOrigin(origins = "*")
public class CalendarEventController {

    private final CalendarEventRepository calendarEventRepository;

    public CalendarEventController(CalendarEventRepository calendarEventRepository) {
        this.calendarEventRepository = calendarEventRepository;
    }

    @Operation(summary = "Get calendar events")
    @GetMapping
    public List<CalendarEvent> getAllCalendarEvents() {
        return calendarEventRepository.findAll();
    }

    /**
     * Persists a new calendar event after applying server-side defaults.
     */
    @Operation(summary = "Create a calendar event")
    @PostMapping
    public CalendarEvent createCalendarEvent(@RequestBody CalendarEvent calendarEvent) {
        applyDefaults(calendarEvent);
        return calendarEventRepository.save(calendarEvent);
    }

    /**
     * Replaces editable event fields while preserving the existing database identity.
     *
     * @throws ResponseStatusException when the event id does not exist
     */
    @Operation(summary = "Update a calendar event")
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

    @Operation(summary = "Delete a calendar event")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCalendarEvent(@PathVariable Long id) {
        if (!calendarEventRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar event not found");
        }

        calendarEventRepository.deleteById(id);
    }

    @Operation(summary = "Delete calendar events for one trip")
    @DeleteMapping("/trip/{tripId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCalendarEventsForTrip(@PathVariable Long tripId) {
        calendarEventRepository.deleteByTripId(tripId);
    }

    /**
     * Applies fallback values that older clients may omit.
     */
    private void applyDefaults(CalendarEvent calendarEvent) {
        if (calendarEvent.getCategory() == null || calendarEvent.getCategory().isBlank()) {
            calendarEvent.setCategory("EVENT");
        }
    }
}
