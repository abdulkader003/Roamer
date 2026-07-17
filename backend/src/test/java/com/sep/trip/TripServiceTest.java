package com.sep.trip;

import com.sep.event.CalendarEvent;
import com.sep.event.CalendarEventRepository;
import com.sep.budget.BudgetAlertNotificationService;
import com.sep.budget.ExpenseRepository;
import com.sep.trip.dto.CreateTripRequest;
import com.sep.trip.dto.TripResponse;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.argThat;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripInvitationRepository tripInvitationRepository;

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private CalendarEventRepository calendarEventRepository;

    @Mock
    private TripRealtimeWebSocketPublisher tripRealtimeWebSocketPublisher;

    @Mock
    private TripReminderNotificationRepository tripReminderNotificationRepository;

    @Mock
    private TripReminderService tripReminderService;

    @Mock
    private BudgetAlertNotificationService budgetAlertNotificationService;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private TripUpdateNotificationRepository tripUpdateNotificationRepository;

    private TripService tripService;
    private AppUser owner;

    @BeforeEach
    void setUp() {
        tripService = new TripService(
                tripRepository,
                tripInvitationRepository,
                appUserRepository,
                calendarEventRepository,
                tripRealtimeWebSocketPublisher,
                tripReminderNotificationRepository,
                tripReminderService,
                budgetAlertNotificationService,
                expenseRepository,
                tripUpdateNotificationRepository
        );
        owner = new AppUser();
        owner.setId(7L);
        owner.setEmail("traveler@example.com");
    }

    @Test
    void getTripsReturnsOnlyAuthenticatedUsersTrips() {
        Trip trip = trip("Summer Getaway");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip));

        List<TripResponse> response = tripService.getTrips("traveler@example.com");

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().name()).isEqualTo("Summer Getaway");
        verify(tripRepository).findAllAccessibleByUserIdOrderByStartDateAsc(7L);
    }

    @Test
    void getTripReturnsAccessibleTripForAuthenticatedUser() {
        Trip trip = trip("Summer Getaway");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));

        TripResponse response = tripService.getTrip("traveler@example.com", 11L);

        assertThat(response.id()).isEqualTo(11L);
        assertThat(response.name()).isEqualTo("Summer Getaway");
    }

    @Test
    void createTripPersistsValidatedTripForAuthenticatedUser() {
        CreateTripRequest request = request(
                LocalDate.of(2026, 7, 15),
                LocalDate.of(2026, 7, 22)
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> {
            Trip trip = invocation.getArgument(0);
            trip.setId(11L);
            return trip;
        });

        TripResponse response = tripService.createTrip("traveler@example.com", request);

        assertThat(response.id()).isEqualTo(11L);
        assertThat(response.destination()).isEqualTo("Rome, Italy");
        assertThat(response.budget()).isEqualByComparingTo("2400.00");
        assertThat(response.status()).isEqualTo(TripStatus.UPCOMING);
        assertThat(response.accessRole()).isEqualTo(TripAccessRole.OWNER);
        verify(tripReminderService).evaluateTripForToday(any(Trip.class));
        verify(budgetAlertNotificationService).evaluateForTripAudience(any(Trip.class));
    }

    @Test
    void createTripRejectsEndDateBeforeStartDate() {
        CreateTripRequest request = request(
                LocalDate.of(2026, 7, 22),
                LocalDate.of(2026, 7, 15)
        );

        assertThatThrownBy(() -> tripService.createTrip("traveler@example.com", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("End date must be on or after the start date.");

        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void createTripTrimsTextFieldsBeforeSaving() {
        CreateTripRequest request = new CreateTripRequest(
                "  Summer Getaway  ",
                "  Rome, Italy  ",
                LocalDate.of(2026, 7, 15),
                LocalDate.of(2026, 7, 22),
                new BigDecimal("2400.00"),
                TripStatus.UPCOMING
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.createTrip("traveler@example.com", request);

        assertThat(response.name()).isEqualTo("Summer Getaway");
        assertThat(response.destination()).isEqualTo("Rome, Italy");
    }

    @Test
    void updateTripChangesOnlyAuthenticatedUsersTrip() {
        Trip trip = trip("Old Name");
        CreateTripRequest request = new CreateTripRequest(
                "Updated Name",
                "Barcelona",
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 6),
                new BigDecimal("1800.00"),
                TripStatus.PLANNING
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);

        TripResponse response = tripService.updateTrip("traveler@example.com", 11L, request);

        assertThat(response.name()).isEqualTo("Updated Name");
        assertThat(response.destination()).isEqualTo("Barcelona");
        assertThat(response.status()).isEqualTo(TripStatus.PLANNING);
        assertThat(response.accessRole()).isEqualTo(TripAccessRole.OWNER);
        verify(tripRepository).findAccessibleByIdAndUserId(11L, 7L);
        verify(tripReminderService).refreshTripForToday(trip);
        verify(tripRealtimeWebSocketPublisher).publishTripDetailsUpdated(any(Trip.class), any(AppUser.class), anyCollection(), anyBoolean());
        verify(budgetAlertNotificationService).evaluateForTripAudience(trip);
    }

    @Test
    void updateTripRefreshesReminderEvenWhenStartDateAndStatusAreUnchanged() {
        Trip trip = trip("Existing Trip");
        CreateTripRequest request = request(trip.getStartDate(), trip.getEndDate());

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);

        tripService.updateTrip("traveler@example.com", 11L, request);

        verify(tripReminderService).refreshTripForToday(trip);
    }

    @Test
    void updateTripRejectsTripsNotOwnedByAuthenticatedUser() {
        CreateTripRequest request = request(
                LocalDate.of(2026, 7, 15),
                LocalDate.of(2026, 7, 22)
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(99L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.updateTrip("traveler@example.com", 99L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Trip was not found.");

        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void deleteTripRemovesOnlyAuthenticatedUsersTrip() {
        Trip trip = trip("Summer Getaway");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findByIdAndOwnerId(11L, 7L)).thenReturn(Optional.of(trip));

        tripService.deleteTrip("traveler@example.com", 11L);

        verify(tripInvitationRepository).deleteAllByTripId(11L);
        verify(tripReminderNotificationRepository).deleteAllByTripId(11L);
        verify(tripUpdateNotificationRepository).deleteAllByTripId(11L);
        verify(calendarEventRepository).deleteByTripId(11L);
        verify(expenseRepository).deleteAllByTripId(11L);
        verify(tripRepository).delete(trip);
        verify(tripRepository).flush();
        verify(budgetAlertNotificationService).evaluateForUser(owner);
    }

    @Test
    void leaveTripRemovesAuthenticatedParticipantFromSharedTrip() {
        Trip trip = trip("Shared Trip");
        AppUser sharedOwner = new AppUser();
        sharedOwner.setId(99L);
        trip.setOwner(sharedOwner);

        TripInvitation acceptedInvitation = new TripInvitation();
        acceptedInvitation.setId(42L);
        acceptedInvitation.setTrip(trip);
        acceptedInvitation.setInvitedUser(owner);
        acceptedInvitation.setStatus(TripInvitationStatus.ACCEPTED);

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripInvitationRepository.findAllByTripIdAndInvitedUserIdAndStatusIn(11L, 7L, List.of(TripInvitationStatus.ACCEPTED)))
                .thenReturn(List.of(acceptedInvitation));

        tripService.leaveTrip("traveler@example.com", 11L);

        verify(tripInvitationRepository).deleteAllByTripIdAndInvitedUserIdAndStatus(11L, 7L, TripInvitationStatus.ACCEPTED);
        verify(tripRealtimeWebSocketPublisher).publishTripParticipantLeft(any(Trip.class), any(AppUser.class), anyCollection());
        verify(tripRealtimeWebSocketPublisher).publishTripParticipantLeftTopic(any(Trip.class), any(AppUser.class));
    }

    @Test
    void leaveTripRejectsOwnersTryingToLeaveTheirOwnTrip() {
        Trip trip = trip("Shared Trip");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> tripService.leaveTrip("traveler@example.com", 11L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Trip owners must delete the trip instead of leaving it.");
    }

    @Test
    void updateTripAllowsAccessibleParticipantTrips() {
        Trip trip = trip("Shared Trip");
        AppUser sharedOwner = new AppUser();
        sharedOwner.setId(99L);
        trip.setOwner(sharedOwner);
        CreateTripRequest request = request(
                LocalDate.of(2026, 7, 15),
                LocalDate.of(2026, 7, 22)
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);

        TripResponse response = tripService.updateTrip("traveler@example.com", 11L, request);

        assertThat(response.accessRole()).isEqualTo(TripAccessRole.PARTICIPANT);
        verify(tripRealtimeWebSocketPublisher).publishTripDetailsUpdated(any(Trip.class), any(AppUser.class), anyCollection(), anyBoolean());
    }

    @Test
    void updateTripSynchronizesNormalRoundTripBookingCalendarEvents() {
        Trip trip = trip("Rome");
        trip.setOrigin("Paris");
        CalendarEvent outbound = flightEvent("Paris → Rome", LocalDate.of(2026, 7, 15));
        CalendarEvent returning = flightEvent("Rome → Paris", LocalDate.of(2026, 7, 22));
        CreateTripRequest request = requestWithOrigin(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 8), "Paris");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(calendarEventRepository.findAllByTripId(11L)).thenReturn(List.of(outbound, returning));

        tripService.updateTrip("traveler@example.com", 11L, request);

        assertThat(outbound.getStartDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(returning.getStartDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 8));
        verify(calendarEventRepository).saveAll(argThat(events -> {
            List<CalendarEvent> saved = (List<CalendarEvent>) events;
            return saved.contains(outbound) && saved.contains(returning);
        }));
    }

    @Test
    void updateTripHandlesOneDayTripOutboundAndReturnSegmentsSeparately() {
        Trip trip = trip("Rome");
        trip.setOrigin("Paris");
        trip.setEndDate(LocalDate.of(2026, 7, 15));
        CalendarEvent outbound = flightEvent("Paris → Rome", LocalDate.of(2026, 7, 15));
        CalendarEvent returning = flightEvent("Rome → Paris", LocalDate.of(2026, 7, 15));
        CreateTripRequest request = requestWithOrigin(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 1), "Paris");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(calendarEventRepository.findAllByTripId(11L)).thenReturn(List.of(outbound, returning));

        tripService.updateTrip("traveler@example.com", 11L, request);

        assertThat(outbound.getStartDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(returning.getStartDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        verify(calendarEventRepository).saveAll(anyCollection());
    }

    @Test
    void updateTripDoesNotMoveMultiCityMiddleFlightSegment() {
        Trip trip = trip("Rome");
        trip.setOrigin("Paris");
        CalendarEvent outbound = flightEvent("Paris → Milan", LocalDate.of(2026, 7, 15));
        CalendarEvent middle = flightEvent("Milan → Rome", LocalDate.of(2026, 7, 22));
        CreateTripRequest request = requestWithOrigin(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 8), "Paris");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(calendarEventRepository.findAllByTripId(11L)).thenReturn(List.of(outbound, middle));

        tripService.updateTrip("traveler@example.com", 11L, request);

        assertThat(outbound.getStartDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(middle.getStartDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 7, 22));
    }

    @Test
    void updateTripSynchronizesHotelDatesAndDescriptionNights() {
        Trip trip = trip("Rome");
        CalendarEvent hotel = hotelEvent(LocalDate.of(2026, 7, 15), LocalDate.of(2026, 7, 22), "Hotel Roamer in Rome · 7 nights");
        CreateTripRequest request = requestWithOrigin(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 4), "Paris");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(calendarEventRepository.findAllByTripId(11L)).thenReturn(List.of(hotel));

        tripService.updateTrip("traveler@example.com", 11L, request);

        assertThat(hotel.getStartDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(hotel.getEndDateTime().toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 4));
        assertThat(hotel.getDescription()).contains("3 nights");
    }

    @Test
    void getTripsRejectsMissingAuthenticatedUser() {
        when(appUserRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.getTrips("missing@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Authenticated user was not found.");

        verify(tripRepository, never()).findAllAccessibleByUserIdOrderByStartDateAsc(any());
    }

    private Trip trip(String name) {
        Trip trip = new Trip();
        trip.setId(11L);
        trip.setName(name);
        trip.setDestination("Rome, Italy");
        trip.setStartDate(LocalDate.of(2026, 7, 15));
        trip.setEndDate(LocalDate.of(2026, 7, 22));
        trip.setBudget(new BigDecimal("2400.00"));
        trip.setStatus(TripStatus.UPCOMING);
        trip.setOwner(owner);
        return trip;
    }

    private CalendarEvent flightEvent(String route, LocalDate date) {
        CalendarEvent event = new CalendarEvent();
        event.setTripId(11L);
        event.setTitle("Flight: Test Air TA123");
        event.setCategory("Flight");
        event.setLocation(route);
        event.setDescription(route + " · Test Air · TA123");
        event.setStartDateTime(date.atTime(9, 0));
        event.setEndDateTime(date.atTime(11, 0));
        return event;
    }

    private CalendarEvent hotelEvent(LocalDate startDate, LocalDate endDate, String description) {
        CalendarEvent event = new CalendarEvent();
        event.setTripId(11L);
        event.setTitle("Hotel: Hotel Roamer");
        event.setCategory("Hotel");
        event.setLocation("Rome");
        event.setDescription(description);
        event.setStartDateTime(startDate.atTime(15, 0));
        event.setEndDateTime(endDate.atTime(11, 0));
        return event;
    }

    private CreateTripRequest request(LocalDate startDate, LocalDate endDate) {
        return new CreateTripRequest(
                "Summer Getaway",
                "Rome, Italy",
                startDate,
                endDate,
                new BigDecimal("2400.00"),
                TripStatus.UPCOMING
        );
    }

    private CreateTripRequest requestWithOrigin(LocalDate startDate, LocalDate endDate, String origin) {
        return new CreateTripRequest(
                "Summer Getaway",
                "Rome, Italy",
                startDate,
                endDate,
                new BigDecimal("2400.00"),
                TripStatus.UPCOMING,
                null,
                origin,
                null,
                "EUR",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }
}
