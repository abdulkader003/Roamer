package com.sep.trip;

import com.sep.event.CalendarEventRepository;
import com.sep.trip.dto.CreateTripRequest;
import com.sep.auth.dto.MessageResponse;
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
    private final TripInvitationRepository tripInvitationRepository;
    private final AppUserRepository appUserRepository;
    private final CalendarEventRepository calendarEventRepository;

    public TripService(
            TripRepository tripRepository,
            TripInvitationRepository tripInvitationRepository,
            AppUserRepository appUserRepository,
            CalendarEventRepository calendarEventRepository
    ) {
        this.tripRepository = tripRepository;
        this.tripInvitationRepository = tripInvitationRepository;
        this.appUserRepository = appUserRepository;
        this.calendarEventRepository = calendarEventRepository;
    }

    /**
     * Resolves the authenticated email to an owner id before querying trips.
     */
    @Transactional(readOnly = true)
    public List<TripResponse> getTrips(String userEmail) {
        AppUser owner = findOwner(userEmail);

        return tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(owner.getId()).stream()
                .map(trip -> toResponse(trip, owner.getId()))
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
        Trip trip = new Trip();
        applyEditableFields(trip, request);
        trip.setOwner(findOwner(userEmail));

        AppUser owner = trip.getOwner();
        return toResponse(tripRepository.save(trip), owner.getId());
    }

    /**
     * Updates one authenticated user's trip without allowing cross-user access.
     */
    @Transactional
    public TripResponse updateTrip(String userEmail, Long tripId, CreateTripRequest request) {
        AppUser owner = findOwner(userEmail);
        Trip trip = findAccessibleTrip(tripId, owner);

        applyEditableFields(trip, request);

        return toResponse(tripRepository.save(trip), owner.getId());
    }

    /**
     * Deletes one authenticated user's trip.
     */
    @Transactional
    public void deleteTrip(String userEmail, Long tripId) {
        AppUser owner = findOwner(userEmail);
        Trip trip = findOwnedTrip(tripId, owner);

        calendarEventRepository.deleteByTripId(trip.getId());
        tripInvitationRepository.deleteAllByTripId(trip.getId());
        tripRepository.delete(trip);
    }

    /**
     * Removes the authenticated participant from a shared trip without affecting other users.
     */
    @Transactional
    public MessageResponse leaveTrip(String userEmail, Long tripId) {
        AppUser user = findOwner(userEmail);
        Trip trip = findAccessibleTrip(tripId, user);

        if (trip.getOwner().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Trip owners must delete the trip instead of leaving it.");
        }

        var acceptedInvitations = tripInvitationRepository.findAllByTripIdAndInvitedUserIdAndStatusIn(
                trip.getId(),
                user.getId(),
                List.of(TripInvitationStatus.ACCEPTED)
        );

        if (acceptedInvitations.isEmpty()) {
            throw new IllegalArgumentException("Trip was not found.");
        }

        tripInvitationRepository.deleteAllByTripIdAndInvitedUserIdAndStatus(
                trip.getId(),
                user.getId(),
                TripInvitationStatus.ACCEPTED
        );
        return new MessageResponse("You left this trip.");
    }

    private AppUser findOwner(String userEmail) {
        return appUserRepository.findByEmailIgnoreCase(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));
    }

    private Trip findOwnedTrip(Long tripId, AppUser owner) {
        return tripRepository.findByIdAndOwnerId(tripId, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Trip was not found."));
    }

    private Trip findAccessibleTrip(Long tripId, AppUser user) {
        return tripRepository.findAccessibleByIdAndUserId(tripId, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Trip was not found."));
    }

    private void applyEditableFields(Trip trip, CreateTripRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new IllegalArgumentException("End date must be on or after the start date.");
        }

        trip.setName(request.name().trim());
        trip.setDestination(request.destination().trim());
        trip.setStartDate(request.startDate());
        trip.setEndDate(request.endDate());
        trip.setBudget(request.budget());
        trip.setStatus(request.status());
        trip.setTripPlanningId(request.tripPlanningId());
        trip.setOrigin(cleanOptionalText(request.origin()));
        trip.setDestinationCities(cleanOptionalText(request.destinationCities()));
        trip.setCurrency(cleanOptionalText(request.currency()));
        trip.setDurationNights(request.durationNights());
        trip.setTravelStyle(cleanOptionalText(request.travelStyle()));
        trip.setTravelers(request.travelers());
        trip.setFlightId(cleanOptionalText(request.flightId()));
        trip.setFlightTitle(cleanOptionalText(request.flightTitle()));
        trip.setFlightAirline(cleanOptionalText(request.flightAirline()));
        trip.setFlightNumber(cleanOptionalText(request.flightNumber()));
        trip.setFlightDepartureTime(cleanOptionalText(request.flightDepartureTime()));
        trip.setFlightArrivalTime(cleanOptionalText(request.flightArrivalTime()));
        trip.setFlightDuration(cleanOptionalText(request.flightDuration()));
        trip.setFlightStops(cleanOptionalText(request.flightStops()));
        trip.setFlightDetails(cleanOptionalText(request.flightDetails()));
        trip.setFlightTotal(request.flightTotal());
        trip.setFlightSegmentsJson(cleanOptionalText(request.flightSegmentsJson()));
        trip.setHotelName(cleanOptionalText(request.hotelName()));
        trip.setHotelCity(cleanOptionalText(request.hotelCity()));
        trip.setHotelStars(request.hotelStars());
        trip.setHotelDetails(cleanOptionalText(request.hotelDetails()));
        trip.setHotelTotal(request.hotelTotal());
        trip.setHotelStaysJson(cleanOptionalText(request.hotelStaysJson()));
        trip.setActivitiesTitle(cleanOptionalText(request.activitiesTitle()));
        trip.setActivitiesDetails(cleanOptionalText(request.activitiesDetails()));
        trip.setActivitiesJson(cleanOptionalText(request.activitiesJson()));
        trip.setActivitiesTotal(request.activitiesTotal());
    }

    private String cleanOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }

    private TripResponse toResponse(Trip trip, Long currentUserId) {
        TripAccessRole accessRole = trip.getOwner().getId().equals(currentUserId)
                ? TripAccessRole.OWNER
                : TripAccessRole.PARTICIPANT;

        return new TripResponse(
                trip.getId(),
                trip.getName(),
                trip.getDestination(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getBudget(),
                trip.getStatus(),
                trip.getCreatedAt(),
                trip.getTripPlanningId(),
                trip.getOrigin(),
                trip.getDestinationCities(),
                trip.getCurrency(),
                trip.getDurationNights(),
                trip.getTravelStyle(),
                trip.getTravelers(),
                trip.getFlightId(),
                trip.getFlightTitle(),
                trip.getFlightAirline(),
                trip.getFlightNumber(),
                trip.getFlightDepartureTime(),
                trip.getFlightArrivalTime(),
                trip.getFlightDuration(),
                trip.getFlightStops(),
                trip.getFlightDetails(),
                trip.getFlightTotal(),
                trip.getFlightSegmentsJson(),
                trip.getHotelName(),
                trip.getHotelCity(),
                trip.getHotelStars(),
                trip.getHotelDetails(),
                trip.getHotelTotal(),
                trip.getHotelStaysJson(),
                trip.getActivitiesTitle(),
                trip.getActivitiesDetails(),
                trip.getActivitiesJson(),
                trip.getActivitiesTotal(),
                accessRole
        );
    }
}
