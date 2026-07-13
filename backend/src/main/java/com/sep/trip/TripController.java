package com.sep.trip;

import com.sep.auth.dto.MessageResponse;
import com.sep.trip.dto.CreateTripRequest;
import com.sep.trip.dto.TripResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Authenticated API for listing and creating the current user's trips.
 *
 * <p>The JWT filter stores the account email in {@link Authentication#getName()},
 * so controllers never accept an owner id from the request body.</p>
 */
@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    /**
     * Returns only trips owned by the authenticated account.
     */
    @GetMapping
    public List<TripResponse> getTrips(Authentication authentication) {
        return tripService.getTrips(authentication.getName());
    }

    /**
     * Returns one accessible trip for the authenticated account.
     */
    @GetMapping("/{tripId}")
    public TripResponse getTrip(Authentication authentication, @PathVariable Long tripId) {
        return tripService.getTrip(authentication.getName(), tripId);
    }

    /**
     * Creates a trip for the authenticated account after DTO and date validation.
     */
    @PostMapping
    public TripResponse createTrip(
            Authentication authentication,
            @Valid @RequestBody CreateTripRequest request
    ) {
        return tripService.createTrip(authentication.getName(), request);
    }

    /**
     * Updates the current user's saved trip summary.
     */
    @PutMapping("/{tripId}")
    public TripResponse updateTrip(
            Authentication authentication,
            @PathVariable Long tripId,
            @Valid @RequestBody CreateTripRequest request
    ) {
        return tripService.updateTrip(authentication.getName(), tripId, request);
    }

    /**
     * Deletes the current user's saved trip.
     */
    @DeleteMapping("/{tripId}")
    public ResponseEntity<Void> deleteTrip(Authentication authentication, @PathVariable Long tripId) {
        tripService.deleteTrip(authentication.getName(), tripId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{tripId}/leave")
    public ResponseEntity<MessageResponse> leaveTrip(Authentication authentication, @PathVariable Long tripId) {
        return ResponseEntity.ok(tripService.leaveTrip(authentication.getName(), tripId));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");

        return ResponseEntity.badRequest().body(Map.of("message", message));
    }
}
