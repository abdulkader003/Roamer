package com.sep.traveldeals;

import com.sep.activity.ActivityEntity;
import com.sep.activity.ActivityRepository;
import com.sep.activity.ActivitiesService;
import com.sep.flight.entity.flight.FlightOfferEntity;
import com.sep.flight.entity.flight.FlightSearchEntity;
import com.sep.flight.repository.flight.FlightOfferRepository;
import com.sep.hotel.service.HotelService;
import com.sep.hotel.model.Hotel;
import com.sep.hotel.repository.HotelRepository;
import com.sep.trip.Trip;
import com.sep.trip.TripRepository;
import com.sep.trip.TripStatus;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TravelDealsServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private FlightOfferRepository flightOfferRepository;

    @Mock
    private HotelRepository hotelRepository;

    @Mock
    private ActivityRepository activityRepository;

    @Mock
    private HotelService hotelService;

    @Mock
    private ActivitiesService activitiesService;

    private TravelDealsService travelDealsService;
    private AppUser user;

    @BeforeEach
    void setUp() {
        travelDealsService = new TravelDealsService(
                userRepository,
                tripRepository,
                flightOfferRepository,
                hotelRepository,
                activityRepository,
                hotelService,
                activitiesService
        );
        user = new AppUser();
        user.setId(7L);
        user.setEmail("traveler@example.com");
        user.setHomeAirport("DUS");
    }

    @Test
    void findDealsForUserCombinesSavedTripDestinationWithCachedInventory() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(savedTrip()));
        when(flightOfferRepository.findBySelectedTrue()).thenReturn(List.of(flightOffer()));
        when(hotelRepository.findByCityContainingIgnoreCase(anyString())).thenAnswer(invocation -> {
            String city = invocation.getArgument(0);
            return "Paris".equalsIgnoreCase(city) ? List.of(hotel()) : List.of();
        });
        when(activityRepository.findByCityIgnoreCaseOrderByStartDateAsc(anyString())).thenAnswer(invocation -> {
            String city = invocation.getArgument(0);
            return "Paris".equalsIgnoreCase(city) ? List.of(activity()) : List.of();
        });

        List<TravelDealResponse> deals = travelDealsService.findDealsForUser("traveler@example.com", "test-refresh-key");

        assertThat(deals)
                .extracting(TravelDealResponse::type)
                .contains("FLIGHT", "HOTEL", "ACTIVITY");
        assertThat(deals)
                .anySatisfy(deal -> {
                    assertThat(deal.type()).isEqualTo("FLIGHT");
                    assertThat(deal.origin()).isEqualTo("DUS");
                    assertThat(deal.destination()).isEqualTo("Paris");
                    assertThat(deal.price()).isEqualByComparingTo("88");
                    assertThat(deal.actionRoute()).contains("departureDate=2026-08-14");
                    assertThat(deal.actionRoute()).contains("flightId=flight-paris-123");
                });
        assertThat(deals)
                .anySatisfy(deal -> {
                    assertThat(deal.type()).isEqualTo("HOTEL");
                    assertThat(deal.title()).isEqualTo("Paris Stay");
                    assertThat(deal.price()).isBetween(BigDecimal.valueOf(240), BigDecimal.valueOf(600));
                    assertThat(deal.actionRoute()).contains("checkIn=");
                    assertThat(deal.actionRoute()).contains("checkOut=");
                });
        assertThat(deals)
                .anySatisfy(deal -> {
                    assertThat(deal.type()).isEqualTo("ACTIVITY");
                    assertThat(deal.title()).isEqualTo("Museum Pass");
                    assertThat(deal.price()).isEqualByComparingTo("35");
                    assertThat(deal.actionRoute()).isEqualTo("/activities/tm-paris-42");
                });
    }

    private Trip savedTrip() {
        Trip trip = new Trip();
        trip.setName("Paris Weekend");
        trip.setDestination("Paris");
        trip.setStartDate(LocalDate.of(2026, 8, 10));
        trip.setEndDate(LocalDate.of(2026, 8, 13));
        trip.setBudget(BigDecimal.valueOf(900));
        trip.setStatus(TripStatus.UPCOMING);
        trip.setOwner(user);
        return trip;
    }

    private Hotel hotel() {
        Hotel hotel = new Hotel();
        hotel.setName("Paris Stay");
        hotel.setCity("Paris");
        hotel.setSource("Cached hotels");
        hotel.setPricePerNight(BigDecimal.valueOf(120));
        hotel.setStars(4);
        return hotel;
    }

    private FlightOfferEntity flightOffer() {
        FlightSearchEntity search = new FlightSearchEntity();
        search.setTripType("one-way");
        search.setFromCode("DUS");
        search.setFromCity("Düsseldorf");
        search.setFromFullName("Düsseldorf Intl.");
        search.setToCode("CDG");
        search.setToCity("Paris");
        search.setToFullName("Charles de Gaulle");
        search.setDepartureDate(LocalDate.of(2026, 8, 14));
        search.setTravelers(2);
        search.setAdults(2);
        search.setChildren(0);
        search.setCabinClass("economy");

        FlightOfferEntity offer = new FlightOfferEntity();
        offer.setExternalOfferId("flight-paris-123");
        offer.setAirlineName("Roamer Air");
        offer.setFlightNumber("RA 123");
        offer.setDepartureAirport("DUS");
        offer.setArrivalCity("Paris");
        offer.setArrivalAirport("CDG");
        offer.setDuration("1h 15m");
        offer.setStops(0);
        offer.setPrice(BigDecimal.valueOf(88));
        offer.setCurrency("EUR");
        offer.setSelected(true);
        offer.setSearch(search);
        return offer;
    }

    private ActivityEntity activity() {
        ActivityEntity activity = new ActivityEntity();
        activity.setId(42L);
        activity.setExternalId("tm-paris-42");
        activity.setTitle("Museum Pass");
        activity.setCity("Paris");
        activity.setSource("Cached activities");
        activity.setCategory("Culture");
        activity.setPriceCurrency("EUR");
        activity.setMinPrice(35.0);
        return activity;
    }
}
