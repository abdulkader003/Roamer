package com.sep.trip;

import com.sep.event.CalendarEvent;
import com.sep.event.CalendarEventRepository;
import com.sep.budget.ExpenseRepository;
import com.sep.trip.dto.CreateTripRequest;
import com.sep.auth.dto.MessageResponse;
import com.sep.budget.BudgetAlertNotificationService;
import com.sep.budget.ExpenseRepository;
import com.sep.trip.dto.CreateTripRequest;
import com.sep.trip.dto.TripResponse;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Applies trip ownership and business validation between the HTTP and database layers.
 */
@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TripInvitationRepository tripInvitationRepository;
    private final AppUserRepository appUserRepository;
    private final CalendarEventRepository calendarEventRepository;
    private final ExpenseRepository expenseRepository;
    private final TripRealtimeWebSocketPublisher tripRealtimeWebSocketPublisher;
    private final TripReminderNotificationRepository tripReminderNotificationRepository;
    private final TripReminderService tripReminderService;
    private final BudgetAlertNotificationService budgetAlertNotificationService;
    private final TripUpdateNotificationRepository tripUpdateNotificationRepository;

    public TripService(
            TripRepository tripRepository,
            TripInvitationRepository tripInvitationRepository,
            AppUserRepository appUserRepository,
            CalendarEventRepository calendarEventRepository,
            TripRealtimeWebSocketPublisher tripRealtimeWebSocketPublisher,
            TripReminderNotificationRepository tripReminderNotificationRepository,
            TripReminderService tripReminderService,
            BudgetAlertNotificationService budgetAlertNotificationService,
            ExpenseRepository expenseRepository,
            TripUpdateNotificationRepository tripUpdateNotificationRepository
    ) {
        this.tripRepository = tripRepository;
        this.tripInvitationRepository = tripInvitationRepository;
        this.appUserRepository = appUserRepository;
        this.calendarEventRepository = calendarEventRepository;
        this.expenseRepository = expenseRepository;
        this.tripRealtimeWebSocketPublisher = tripRealtimeWebSocketPublisher;
        this.tripReminderNotificationRepository = tripReminderNotificationRepository;
        this.tripReminderService = tripReminderService;
        this.budgetAlertNotificationService = budgetAlertNotificationService;
        this.tripUpdateNotificationRepository = tripUpdateNotificationRepository;
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
     * Returns one accessible trip for the authenticated user.
     */
    @Transactional(readOnly = true)
    public TripResponse getTrip(String userEmail, Long tripId) {
        AppUser user = findOwner(userEmail);
        Trip trip = findAccessibleTrip(tripId, user);

        return toResponse(trip, user.getId());
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
        Trip savedTrip = tripRepository.save(trip);
        tripReminderService.evaluateTripForToday(savedTrip);
        budgetAlertNotificationService.evaluateForTripAudience(savedTrip);
        return toResponse(savedTrip, owner.getId());
    }

    /**
     * Updates one authenticated user's trip without allowing cross-user access.
     */
    @Transactional
    public TripResponse updateTrip(String userEmail, Long tripId, CreateTripRequest request) {
        AppUser currentUser = findOwner(userEmail);
        Trip trip = findAccessibleTrip(tripId, currentUser);
        LocalDate previousStartDate = trip.getStartDate();
        LocalDate previousEndDate = trip.getEndDate();
        TripStatus previousStatus = trip.getStatus();
        BookingSnapshot previousBooking = BookingSnapshot.from(trip);

        applyEditableFields(trip, request);

        Trip savedTrip = tripRepository.save(trip);
        boolean bookingChanged = previousBooking.changed(savedTrip);
        syncTripCalendarBookingDates(savedTrip, previousStartDate, previousEndDate);
        tripReminderService.refreshTripForToday(savedTrip);
        budgetAlertNotificationService.evaluateForTripAudience(savedTrip);
        tripRealtimeWebSocketPublisher.publishTripDetailsUpdated(
                savedTrip,
                currentUser,
                tripUpdateRecipients(savedTrip, currentUser.getId(), !savedTrip.getOwner().getId().equals(currentUser.getId())),
                bookingChanged
        );

        return toResponse(savedTrip, currentUser.getId());
    }

    /**
     * Deletes one authenticated user's trip.
     */
    @Transactional
    public void deleteTrip(String userEmail, Long tripId) {
        AppUser owner = findOwner(userEmail);
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new IllegalArgumentException("Trip was not found."));

        if (!trip.getOwner().getId().equals(owner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the trip owner can delete this trip.");
        }

        expenseRepository.deleteAllByTripId(trip.getId());
        calendarEventRepository.deleteByTripId(trip.getId());
        tripReminderNotificationRepository.deleteAllByTripId(trip.getId());
        tripUpdateNotificationRepository.deleteAllByTripId(trip.getId());
        tripInvitationRepository.deleteAllByTripId(trip.getId());
        expenseRepository.deleteAllByTripId(trip.getId());
        tripRepository.delete(trip);
        tripRepository.flush();
        budgetAlertNotificationService.evaluateForUser(owner);
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

        tripRealtimeWebSocketPublisher.publishTripParticipantLeft(
                trip,
                user,
                tripUpdateRecipients(trip, user.getId(), true)
        );
        tripRealtimeWebSocketPublisher.publishTripParticipantLeftTopic(trip, user);
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

    private record BookingSnapshot(
            String flightId,
            String flightTitle,
            String flightAirline,
            String flightNumber,
            String flightDepartureTime,
            String flightArrivalTime,
            String flightDuration,
            String flightStops,
            String flightDetails,
            java.math.BigDecimal flightTotal,
            String flightSegmentsJson,
            String hotelName,
            String hotelCity,
            Integer hotelStars,
            String hotelDetails,
            java.math.BigDecimal hotelTotal,
            String hotelStaysJson
    ) {
        static BookingSnapshot from(Trip trip) {
            return new BookingSnapshot(
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
                    trip.getHotelStaysJson()
            );
        }

        boolean changed(Trip trip) {
            BookingSnapshot next = from(trip);
            return !Objects.equals(this, next);
        }
    }

    private List<AppUser> tripUpdateRecipients(Trip trip, Long actorId, boolean includeOwner) {
        var recipients = new java.util.LinkedHashMap<Long, AppUser>();

        if (includeOwner && !trip.getOwner().getId().equals(actorId)) {
            recipients.put(trip.getOwner().getId(), trip.getOwner());
        }

        tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(trip.getId(), TripInvitationStatus.ACCEPTED)
                .stream()
                .map(TripInvitation::getInvitedUser)
                .filter(user -> user.getId() != null && !user.getId().equals(actorId))
                .forEach(user -> recipients.putIfAbsent(user.getId(), user));

        return new java.util.ArrayList<>(recipients.values());
    }

    private void syncTripCalendarBookingDates(Trip trip, LocalDate previousStartDate, LocalDate previousEndDate) {
        if (
                trip.getId() == null
                        || previousStartDate == null
                        || previousEndDate == null
                        || (previousStartDate.equals(trip.getStartDate()) && previousEndDate.equals(trip.getEndDate()))
        ) {
            return;
        }

        List<CalendarEvent> tripEvents = calendarEventRepository.findAllByTripId(trip.getId());
        if (tripEvents == null || tripEvents.isEmpty()) {
            return;
        }

        List<CalendarEvent> bookingEvents = tripEvents.stream()
                .filter(this::isTripBookingEvent)
                .toList();

        if (bookingEvents.isEmpty()) {
            return;
        }

        boolean changed = false;
        for (CalendarEvent event : bookingEvents) {
            boolean outbound = isOutboundBookingEvent(event, trip);
            boolean returning = isReturnBookingEvent(event, trip);
            boolean hotel = isHotelBookingEvent(event);
            LocalDateTime syncedStart = syncBoundaryDate(event.getStartDateTime(), previousStartDate, previousEndDate, trip.getStartDate(), trip.getEndDate(), outbound, returning, hotel);
            LocalDateTime syncedEnd = syncBoundaryDate(event.getEndDateTime(), previousStartDate, previousEndDate, trip.getStartDate(), trip.getEndDate(), outbound, returning, hotel);

            if (!sameDateTime(event.getStartDateTime(), syncedStart)) {
                event.setStartDateTime(syncedStart);
                changed = true;
            }

            if (!sameDateTime(event.getEndDateTime(), syncedEnd)) {
                event.setEndDateTime(syncedEnd);
                changed = true;
            }

            if (hotel) {
                String syncedDescription = syncHotelDescription(event.getDescription(), trip.getStartDate(), trip.getEndDate());
                if (!sameText(event.getDescription(), syncedDescription)) {
                    event.setDescription(syncedDescription);
                    changed = true;
                }
            }
        }

        if (changed) {
            calendarEventRepository.saveAll(bookingEvents);
        }
    }

    private boolean isTripBookingEvent(CalendarEvent event) {
        return isFlightBookingEvent(event) || isHotelBookingEvent(event);
    }

    private boolean isFlightBookingEvent(CalendarEvent event) {
        if (event.getCategory() == null || event.getTitle() == null) {
            return false;
        }

        String category = event.getCategory().trim();
        return category.equalsIgnoreCase("Flight") && event.getTitle().trim().startsWith("Flight:");
    }

    private boolean isHotelBookingEvent(CalendarEvent event) {
        if (event.getCategory() == null || event.getTitle() == null) {
            return false;
        }

        String category = event.getCategory().trim();
        return category.equalsIgnoreCase("Hotel") && event.getTitle().trim().startsWith("Hotel:");
    }

    private LocalDateTime syncBoundaryDate(
            LocalDateTime value,
            LocalDate previousStartDate,
            LocalDate previousEndDate,
            LocalDate nextStartDate,
            LocalDate nextEndDate,
            boolean outbound,
            boolean returning,
            boolean hotel
    ) {
        if (value == null) {
            return null;
        }

        LocalDate currentDate = value.toLocalDate();
        if (currentDate.equals(previousStartDate) && (hotel || outbound)) {
            return value.with(nextStartDate);
        }

        if (currentDate.equals(previousEndDate) && (hotel || returning)) {
            return value.with(nextEndDate);
        }

        return value;
    }

    private boolean isOutboundBookingEvent(CalendarEvent event, Trip trip) {
        String searchable = bookingSearchText(event);
        return searchable.contains("outbound")
                || searchable.contains("departure")
                || routeStartsAtOrigin(event, trip);
    }

    private boolean isReturnBookingEvent(CalendarEvent event, Trip trip) {
        String searchable = bookingSearchText(event);
        return searchable.contains("return") || routeEndsAtOrigin(event, trip);
    }

    private String bookingSearchText(CalendarEvent event) {
        return ((event.getTitle() == null ? "" : event.getTitle()) + " " + (event.getDescription() == null ? "" : event.getDescription()))
                .toLowerCase(java.util.Locale.ROOT);
    }

    private boolean routeStartsAtOrigin(CalendarEvent event, Trip trip) {
        String origin = normalizedCity(trip.getOrigin());
        String location = normalizedText(event.getLocation());

        return origin != null && location.startsWith(origin);
    }

    private boolean routeEndsAtOrigin(CalendarEvent event, Trip trip) {
        String origin = normalizedCity(trip.getOrigin());
        String location = normalizedText(event.getLocation());

        return origin != null && location.endsWith(origin);
    }

    private String normalizedCity(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return normalizedText(value.replaceAll("\\s*\\([A-Za-z]{3}\\)\\s*$", ""));
    }

    private String normalizedText(String value) {
        return value == null ? "" : value.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    private String syncHotelDescription(String description, LocalDate startDate, LocalDate endDate) {
        long nights = java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate);
        String nightsLabel = Math.max(0, nights) + " night" + (Math.max(0, nights) == 1 ? "" : "s");

        if (description == null || description.isBlank()) {
            return nightsLabel;
        }

        if (description.matches("(?is).*\\b\\d+\\s+nights?\\b.*")) {
            return description.replaceFirst("(?i)\\b\\d+\\s+nights?\\b", nightsLabel);
        }

        return description + " · " + nightsLabel;
    }

    private boolean sameText(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private boolean sameDateTime(LocalDateTime left, LocalDateTime right) {
        return left == null ? right == null : left.equals(right);
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
