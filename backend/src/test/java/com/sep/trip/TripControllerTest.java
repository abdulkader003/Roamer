package com.sep.trip;

import com.sep.trip.dto.CreateTripRequest;
import com.sep.trip.dto.TripResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripControllerTest {

    @Mock
    private TripService tripService;

    @Mock
    private Authentication authentication;

    private TripController tripController;

    @BeforeEach
    void setUp() {
        tripController = new TripController(tripService);
    }

    @Test
    void getTripsUsesAuthenticatedEmail() {
        TripResponse trip = response();
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(tripService.getTrips("traveler@example.com")).thenReturn(List.of(trip));

        List<TripResponse> response = tripController.getTrips(authentication);

        assertThat(response).containsExactly(trip);
        verify(tripService).getTrips("traveler@example.com");
    }

    @Test
    void createTripUsesAuthenticatedEmailAndRequest() {
        CreateTripRequest request = request();
        TripResponse savedTrip = response();
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(tripService.createTrip("traveler@example.com", request)).thenReturn(savedTrip);

        TripResponse response = tripController.createTrip(authentication, request);

        assertThat(response).isEqualTo(savedTrip);
        verify(tripService).createTrip("traveler@example.com", request);
    }

    @Test
    void updateTripUsesAuthenticatedEmailTripIdAndRequest() {
        CreateTripRequest request = request();
        TripResponse savedTrip = response();
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(tripService.updateTrip("traveler@example.com", 11L, request)).thenReturn(savedTrip);

        TripResponse response = tripController.updateTrip(authentication, 11L, request);

        assertThat(response).isEqualTo(savedTrip);
        verify(tripService).updateTrip("traveler@example.com", 11L, request);
    }

    @Test
    void deleteTripUsesAuthenticatedEmailAndTripId() {
        when(authentication.getName()).thenReturn("traveler@example.com");

        ResponseEntity<Void> response = tripController.deleteTrip(authentication, 11L);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(tripService).deleteTrip("traveler@example.com", 11L);
    }

    @Test
    void leaveTripUsesAuthenticatedEmailAndTripId() {
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(tripService.leaveTrip("traveler@example.com", 11L)).thenReturn(new com.sep.auth.dto.MessageResponse("You left this trip."));

        ResponseEntity<com.sep.auth.dto.MessageResponse> response = tripController.leaveTrip(authentication, 11L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(tripService).leaveTrip("traveler@example.com", 11L);
    }

    @Test
    void illegalArgumentsBecomeClientSafeBadRequests() {
        ResponseEntity<Map<String, String>> response =
                tripController.handleIllegalArgument(new IllegalArgumentException("Invalid trip dates"));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("message", "Invalid trip dates");
    }

    private CreateTripRequest request() {
        return new CreateTripRequest(
                "Summer Getaway",
                "Rome, Italy",
                LocalDate.of(2026, 7, 15),
                LocalDate.of(2026, 7, 22),
                new BigDecimal("2400.00"),
                TripStatus.UPCOMING
        );
    }

    private TripResponse response() {
        return new TripResponse(
                11L,
                "Summer Getaway",
                "Rome, Italy",
                LocalDate.of(2026, 7, 15),
                LocalDate.of(2026, 7, 22),
                new BigDecimal("2400.00"),
                TripStatus.UPCOMING,
                OffsetDateTime.parse("2026-06-14T12:00:00Z")
        );
    }
}
