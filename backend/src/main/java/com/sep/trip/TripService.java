package com.sep.trip;

import com.sep.trip.dto.CreateTripRequest;
import com.sep.trip.dto.TripResponse;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Applies trip ownership and business validation between the HTTP and database layers.
 */
@Service
public class TripService {

    private final TripRepository tripRepository;
    private final AppUserRepository appUserRepository;

    public TripService(TripRepository tripRepository, AppUserRepository appUserRepository) {
        this.tripRepository = tripRepository;
        this.appUserRepository = appUserRepository;
    }

    /**
     * Resolves the authenticated email to an owner id before querying trips.
     */
    @Transactional(readOnly = true)
    public List<TripResponse> getTrips(String userEmail) {
        AppUser owner = findOwner(userEmail);

        return tripRepository.findAllByOwnerIdOrderByStartDateAsc(owner.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Creates a trip owned by the authenticated user.
     *
     * @throws IllegalArgumentException when the date range is invalid or the
     * authenticated account no longer exists
     */
    @Transactional
    public TripResponse createTrip(String userEmail, CreateTripRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new IllegalArgumentException("End date must be on or after the start date.");
        }

        Trip trip = new Trip();
        trip.setName(request.name().trim());
        trip.setDestination(request.destination().trim());
        trip.setStartDate(request.startDate());
        trip.setEndDate(request.endDate());
        trip.setBudget(request.budget());
        trip.setStatus(request.status());
        trip.setOwner(findOwner(userEmail));

        return toResponse(tripRepository.save(trip));
    }

    private AppUser findOwner(String userEmail) {
        return appUserRepository.findByEmailIgnoreCase(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));
    }

    private TripResponse toResponse(Trip trip) {
        return new TripResponse(
                trip.getId(),
                trip.getName(),
                trip.getDestination(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getBudget(),
                trip.getStatus(),
                trip.getCreatedAt()
        );
    }
}
