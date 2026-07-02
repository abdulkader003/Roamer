package com.sep.calendar;

import com.sep.event.CalendarEvent;
import com.sep.event.CalendarEventController;
import com.sep.event.CalendarEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CalendarTest {

    @Mock
    private CalendarEventRepository calendarEventRepository;

    private CalendarEventController calendarEventController;

    @BeforeEach
    void setUp() {
        calendarEventController = new CalendarEventController(calendarEventRepository);
    }

    @Test
    void createCalendarEventSavesNewEvent() {
        CalendarEvent event = calendarEvent(
                "Flight to Dubai",
                "Airport transfer included",
                "Berlin Airport",
                "Flight"
        );

        when(calendarEventRepository.save(any(CalendarEvent.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CalendarEvent savedEvent = calendarEventController.createCalendarEvent(event);

        assertThat(savedEvent.getTitle()).isEqualTo("Flight to Dubai");
        assertThat(savedEvent.getDescription()).isEqualTo("Airport transfer included");
        assertThat(savedEvent.getLocation()).isEqualTo("Berlin Airport");
        assertThat(savedEvent.getCategory()).isEqualTo("Flight");
        assertThat(savedEvent.getBudgetCost()).isEqualTo(120.0);
        verify(calendarEventRepository).save(event);
    }

    @Test
    void createCalendarEventUsesDefaultCategoryWhenCategoryIsBlank() {
        CalendarEvent event = calendarEvent(
                "Dinner reservation",
                "Family dinner",
                "Paris",
                " "
        );

        when(calendarEventRepository.save(any(CalendarEvent.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CalendarEvent savedEvent = calendarEventController.createCalendarEvent(event);

        assertThat(savedEvent.getCategory()).isEqualTo("EVENT");
        verify(calendarEventRepository).save(event);
    }

    @Test
    void updateCalendarEventEditsExistingEvent() {
        CalendarEvent existingEvent = calendarEvent(
                "Old hotel",
                "Old notes",
                "London",
                "Hotel"
        );
        CalendarEvent updateRequest = calendarEvent(
                "Updated hotel",
                "Late check-in",
                "Tokyo",
                "Hotel"
        );
        updateRequest.setBudgetCost(350.0);
        updateRequest.setNotes("Ask for city view");

        when(calendarEventRepository.findById(7L)).thenReturn(Optional.of(existingEvent));
        when(calendarEventRepository.save(any(CalendarEvent.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CalendarEvent updatedEvent = calendarEventController.updateCalendarEvent(7L, updateRequest);

        assertThat(updatedEvent.getTitle()).isEqualTo("Updated hotel");
        assertThat(updatedEvent.getDescription()).isEqualTo("Late check-in");
        assertThat(updatedEvent.getLocation()).isEqualTo("Tokyo");
        assertThat(updatedEvent.getCategory()).isEqualTo("Hotel");
        assertThat(updatedEvent.getBudgetCost()).isEqualTo(350.0);
        assertThat(updatedEvent.getNotes()).isEqualTo("Ask for city view");
        verify(calendarEventRepository).save(existingEvent);
    }

    @Test
    void updateCalendarEventThrowsNotFoundWhenEventDoesNotExist() {
        when(calendarEventRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> calendarEventController.updateCalendarEvent(99L, calendarEvent(
                "Missing event",
                "No data",
                "Nowhere",
                "Event"
        )))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Calendar event not found");
    }

    @Test
    void deleteCalendarEventDeletesExistingEvent() {
        when(calendarEventRepository.existsById(5L)).thenReturn(true);

        calendarEventController.deleteCalendarEvent(5L);

        verify(calendarEventRepository).deleteById(5L);
    }

    @Test
    void deleteCalendarEventThrowsNotFoundWhenEventDoesNotExist() {
        when(calendarEventRepository.existsById(404L)).thenReturn(false);

        assertThatThrownBy(() -> calendarEventController.deleteCalendarEvent(404L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Calendar event not found");
    }

    @Test
    void deleteCalendarEventsForTripDeletesOnlyTripLinkedEvents() {
        calendarEventController.deleteCalendarEventsForTrip(42L);

        verify(calendarEventRepository).deleteByTripId(42L);
    }

    @Test
    void deleteCalendarEventsForTripRouteDoesNotConflictWithSingleEventDelete() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(calendarEventController).build();

        mockMvc.perform(delete("/api/calendar-events/trip/42"))
                .andExpect(status().isNoContent());

        verify(calendarEventRepository).deleteByTripId(42L);
    }

    private CalendarEvent calendarEvent(
            String title,
            String description,
            String location,
            String category
    ) {
        CalendarEvent event = new CalendarEvent();
        event.setTitle(title);
        event.setDescription(description);
        event.setLocation(location);
        event.setStartDateTime(LocalDateTime.of(2026, 6, 10, 9, 30));
        event.setEndDateTime(LocalDateTime.of(2026, 6, 10, 11, 0));
        event.setCategory(category);
        event.setBudgetCost(120.0);
        event.setNotes("Bring confirmation");
        return event;
    }
}
