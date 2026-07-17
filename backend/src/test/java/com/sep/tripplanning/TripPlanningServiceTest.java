package com.sep.tripplanning;

import com.sep.budget.BudgetAlertNotificationService;
import com.sep.tripplanning.dto.CreateTripBudgetRequest;
import com.sep.tripplanning.dto.SelectTripActivitiesRequest;
import com.sep.tripplanning.dto.SelectTripHotelRequest;
import com.sep.tripplanning.dto.SelectedTripActivity;
import com.sep.tripplanning.dto.TripActivitiesResponse;
import com.sep.tripplanning.dto.TripBudgetResponse;
import com.sep.tripplanning.dto.TripHotelResponse;
import com.sep.tripplanning.dto.TripOverviewResponse;
import com.sep.trip.Trip;
import com.sep.trip.TripRepository;
import com.sep.hotel.model.Hotel;
import com.sep.hotel.repository.HotelRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripPlanningServiceTest {

    @Mock
    private TripPlanningRepository tripPlanningRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private HotelRepository hotelRepository;

    @Mock
    private BudgetAlertNotificationService budgetAlertNotificationService;

    private TripPlanningService tripPlanningService;

    @BeforeEach
    void setUp() {
        tripPlanningService = new TripPlanningService(
                tripPlanningRepository,
                tripRepository,
                appUserRepository,
                hotelRepository,
                budgetAlertNotificationService
        );
    }

    @Test
    void savesBudgetStepForAuthenticatedUser() {
        AppUser user = new AppUser();
        user.setId(42L);
        user.setEmail("traveler@example.com");

        CreateTripBudgetRequest request = new CreateTripBudgetRequest(
                " Summer in Italy ",
                new BigDecimal("2500.00"),
                "EUR",
                7,
                "Mid-range"
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(tripPlanningRepository.save(org.mockito.ArgumentMatchers.any(TripPlanning.class)))
                .thenAnswer(invocation -> {
                    TripPlanning tripPlanning = invocation.getArgument(0);
                    tripPlanning.setId(10L);
                    return tripPlanning;
                });

        TripBudgetResponse response = tripPlanningService.saveBudget(request, "traveler@example.com");

        ArgumentCaptor<TripPlanning> captor = ArgumentCaptor.forClass(TripPlanning.class);
        verify(tripPlanningRepository).save(captor.capture());

        assertThat(captor.getValue().getUser()).isSameAs(user);
        assertThat(captor.getValue().getTripName()).isEqualTo("Summer in Italy");
        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.budget()).isEqualByComparingTo("2500.00");
        assertThat(response.travelStyle()).isEqualTo("Mid-range");
    }

    @Test
    void savesSelectedHotelForOwnedTripPlanningRecord() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setId(10L);
        tripPlanning.setUser(user);

        Hotel hotel = new Hotel();
        ReflectionTestUtils.setField(hotel, "id", 77L);
        hotel.setName("Barcelona Grand");
        hotel.setCity("Barcelona");
        hotel.setPricePerNight(new BigDecimal("220.00"));
        hotel.setStars(5);
        hotel.setRatingScore(9.1);
        hotel.setRatingLabel("Superb");

        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));
        when(hotelRepository.findById(77L)).thenReturn(Optional.of(hotel));
        when(tripPlanningRepository.save(tripPlanning)).thenReturn(tripPlanning);

        TripHotelResponse response = tripPlanningService.saveHotel(
                10L,
                new SelectTripHotelRequest(77L, "[{\"city\":\"Barcelona\"}]"),
                "traveler@example.com"
        );

        verify(tripPlanningRepository).save(tripPlanning);
        assertThat(tripPlanning.getSelectedHotel()).isSameAs(hotel);
        assertThat(tripPlanning.getSelectedHotelStaysJson()).isEqualTo("[{\"city\":\"Barcelona\"}]");
        assertThat(response.hotelId()).isEqualTo(77L);
        assertThat(response.hotelName()).isEqualTo("Barcelona Grand");
    }

    @Test
    void reevaluatesBudgetAlertsWhenHotelSelectionBelongsToLinkedTrip() {
        AppUser user = new AppUser();
        user.setId(42L);
        user.setEmail("traveler@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setId(10L);
        tripPlanning.setUser(user);
        Trip trip = new Trip();
        trip.setId(11L);

        Hotel hotel = new Hotel();
        ReflectionTestUtils.setField(hotel, "id", 77L);
        hotel.setName("Barcelona Grand");

        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));
        when(hotelRepository.findById(77L)).thenReturn(Optional.of(hotel));
        when(tripPlanningRepository.save(tripPlanning)).thenReturn(tripPlanning);
        when(tripRepository.findAccessibleByTripPlanningIdAndUserId(10L, 42L)).thenReturn(Optional.of(trip));

        tripPlanningService.saveHotel(10L, new SelectTripHotelRequest(77L, null), "traveler@example.com");

        verify(budgetAlertNotificationService).evaluateForTripAudience(trip);
    }

    @Test
    void rejectsMissingTripPlanningRecordWhenSavingHotel() {
        when(tripPlanningRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripPlanningService.saveHotel(
                404L,
                new SelectTripHotelRequest(77L, null),
                "traveler@example.com"
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
    }

    @Test
    void rejectsHotelSaveForAnotherUserTripPlanningRecord() {
        AppUser user = new AppUser();
        user.setEmail("owner@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setUser(user);

        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));

        assertThatThrownBy(() -> tripPlanningService.saveHotel(
                10L,
                new SelectTripHotelRequest(77L, null),
                "traveler@example.com"
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403 FORBIDDEN");
    }

    @Test
    void savesSelectedActivitiesForOwnedTripPlanningRecord() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setId(10L);
        tripPlanning.setUser(user);

        SelectTripActivitiesRequest request = new SelectTripActivitiesRequest(List.of(
                new SelectedTripActivity("Picasso Museum", "Arts & Culture", new BigDecimal("28.00"), "2 hours", "Barcelona"),
                new SelectedTripActivity("Food Walk", "Tours", new BigDecimal("64.00"), "3 hours", "Barcelona")
        ));

        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));
        when(tripPlanningRepository.save(tripPlanning)).thenReturn(tripPlanning);

        TripActivitiesResponse response = tripPlanningService.saveActivities(10L, request, "traveler@example.com");

        verify(tripPlanningRepository).save(tripPlanning);
        assertThat(tripPlanning.getSelectedActivities()).hasSize(2);
        assertThat(response.selectedActivitiesCount()).isEqualTo(2);
        assertThat(response.totalActivitiesCost()).isEqualByComparingTo("92.00");
    }

    @Test
    void reevaluatesBudgetAlertsWhenActivitySelectionBelongsToLinkedTrip() {
        AppUser user = new AppUser();
        user.setId(42L);
        user.setEmail("traveler@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setId(10L);
        tripPlanning.setUser(user);
        Trip trip = new Trip();
        trip.setId(11L);

        SelectTripActivitiesRequest request = new SelectTripActivitiesRequest(List.of(
                new SelectedTripActivity("Food Walk", "Tours", new BigDecimal("64.00"), "3 hours", "Barcelona")
        ));

        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));
        when(tripPlanningRepository.save(tripPlanning)).thenReturn(tripPlanning);
        when(tripRepository.findAccessibleByTripPlanningIdAndUserId(10L, 42L)).thenReturn(Optional.of(trip));

        tripPlanningService.saveActivities(10L, request, "traveler@example.com");

        verify(budgetAlertNotificationService).evaluateForTripAudience(trip);
    }

    @Test
    void rejectsMissingTripPlanningRecordWhenSavingActivities() {
        when(tripPlanningRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripPlanningService.saveActivities(
                404L,
                new SelectTripActivitiesRequest(List.of()),
                "traveler@example.com"
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
    }

    @Test
    void rejectsActivitiesSaveForAnotherUserTripPlanningRecord() {
        AppUser user = new AppUser();
        user.setEmail("owner@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setUser(user);

        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));

        assertThatThrownBy(() -> tripPlanningService.saveActivities(
                10L,
                new SelectTripActivitiesRequest(List.of()),
                "traveler@example.com"
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403 FORBIDDEN");
    }

    @Test
    void listsOnlyTripsForAuthenticatedUser() {
        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setId(11L);
        tripPlanning.setTripName("Business Conference");
        tripPlanning.setBudget(new BigDecimal("1200.00"));
        tripPlanning.setCurrency("EUR");
        tripPlanning.setDuration(3);
        tripPlanning.setTravelStyle("Budget");

        when(tripPlanningRepository.findByUserEmailIgnoreCaseOrderByUpdatedAtDesc("traveler@example.com"))
                .thenReturn(List.of(tripPlanning));

        List<TripBudgetResponse> trips = tripPlanningService.findTripsForUser("traveler@example.com");

        verify(tripPlanningRepository).findByUserEmailIgnoreCaseOrderByUpdatedAtDesc("traveler@example.com");
        assertThat(trips).hasSize(1);
        assertThat(trips.get(0).tripName()).isEqualTo("Business Conference");
        assertThat(trips.get(0).budget()).isEqualByComparingTo("1200.00");
    }

    @Test
    void loadsOverviewForOwnedTripPlanningRecord() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setId(10L);
        tripPlanning.setTripName("Summer in Barcelona");
        tripPlanning.setBudget(new BigDecimal("2000.00"));
        tripPlanning.setCurrency("EUR");
        tripPlanning.setDuration(7);
        tripPlanning.setTravelStyle("Mid-range");
        tripPlanning.setUser(user);
        tripPlanning.setSelectedHotelName("Barcelona Grand");
        tripPlanning.setSelectedHotelCity("Barcelona");
        tripPlanning.setSelectedHotelPricePerNight(new BigDecimal("285.00"));
        tripPlanning.setSelectedHotelStars(5);
        tripPlanning.setSelectedHotelRatingScore(9.1);
        tripPlanning.setSelectedHotelRatingLabel("Superb");
        tripPlanning.setSelectedHotelStaysJson("[{\"city\":\"Barcelona\"}]");
        tripPlanning.setSelectedActivities(List.of(activity("Picasso Museum", "Arts", "120.00")));

        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));

        TripOverviewResponse response = tripPlanningService.getOverview(10L, "traveler@example.com");

        assertThat(response.tripName()).isEqualTo("Summer in Barcelona");
        assertThat(response.selectedHotel().hotelName()).isEqualTo("Barcelona Grand");
        assertThat(response.selectedHotelStaysJson()).isEqualTo("[{\"city\":\"Barcelona\"}]");
        assertThat(response.selectedActivities()).hasSize(1);
        assertThat(response.totalActivitiesCost()).isEqualByComparingTo("120.00");
    }

    @Test
    void loadsOverviewForAcceptedSharedTripParticipant() {
        AppUser owner = new AppUser();
        owner.setEmail("owner@example.com");

        AppUser participant = new AppUser();
        participant.setId(42L);
        participant.setEmail("traveler@example.com");

        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setId(10L);
        tripPlanning.setTripName("Summer in Barcelona");
        tripPlanning.setBudget(new BigDecimal("2000.00"));
        tripPlanning.setCurrency("EUR");
        tripPlanning.setDuration(7);
        tripPlanning.setTravelStyle("Mid-range");
        tripPlanning.setUser(owner);

        Trip sharedTrip = new Trip();
        sharedTrip.setId(99L);
        sharedTrip.setTripPlanningId(10L);

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(participant));
        when(tripPlanningRepository.findById(10L)).thenReturn(Optional.of(tripPlanning));
        when(tripRepository.findAccessibleByTripPlanningIdAndUserId(10L, 42L)).thenReturn(Optional.of(sharedTrip));

        TripOverviewResponse response = tripPlanningService.getOverview(10L, "traveler@example.com");

        assertThat(response.tripName()).isEqualTo("Summer in Barcelona");
        assertThat(response.budget()).isEqualByComparingTo("2000.00");
        verify(tripRepository).findAccessibleByTripPlanningIdAndUserId(10L, 42L);
    }

    private TripPlanningActivity activity(String name, String category, String price) {
        TripPlanningActivity activity = new TripPlanningActivity();
        activity.setName(name);
        activity.setCategory(category);
        activity.setPrice(new BigDecimal(price));
        activity.setDuration("2 hours");
        activity.setCity("Barcelona");
        return activity;
    }
}
