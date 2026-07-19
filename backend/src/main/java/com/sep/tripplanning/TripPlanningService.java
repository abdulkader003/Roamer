package com.sep.tripplanning;

import com.sep.budget.BudgetAlertNotificationService;
import com.sep.trip.Trip;
import com.sep.trip.TripRepository;
import com.sep.tripplanning.dto.CreateTripBudgetRequest;
import com.sep.tripplanning.dto.SelectTripActivitiesRequest;
import com.sep.tripplanning.dto.SelectTripHotelRequest;
import com.sep.tripplanning.dto.SelectedTripActivity;
import com.sep.tripplanning.dto.TripActivitiesResponse;
import com.sep.tripplanning.dto.TripBudgetResponse;
import com.sep.tripplanning.dto.TripHotelResponse;
import com.sep.tripplanning.dto.TripOverviewResponse;
import com.sep.hotel.model.Hotel;
import com.sep.hotel.repository.HotelRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class TripPlanningService {

    private final TripPlanningRepository tripPlanningRepository;
    private final TripRepository tripRepository;
    private final AppUserRepository appUserRepository;
    private final HotelRepository hotelRepository;
    private final BudgetAlertNotificationService budgetAlertNotificationService;

    public TripPlanningService(
            TripPlanningRepository tripPlanningRepository,
            TripRepository tripRepository,
            AppUserRepository appUserRepository,
            HotelRepository hotelRepository,
            BudgetAlertNotificationService budgetAlertNotificationService
    ) {
        this.tripPlanningRepository = tripPlanningRepository;
        this.tripRepository = tripRepository;
        this.appUserRepository = appUserRepository;
        this.hotelRepository = hotelRepository;
        this.budgetAlertNotificationService = budgetAlertNotificationService;
    }

    @Transactional
    public TripBudgetResponse saveBudget(CreateTripBudgetRequest request, String authenticatedEmail) {
        AppUser user = appUserRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found"));

        // Stores only the budget step for now.
        TripPlanning tripPlanning = new TripPlanning();
        tripPlanning.setTripName(request.tripName().trim());
        tripPlanning.setBudget(request.budget());
        tripPlanning.setCurrency(request.currency());
        tripPlanning.setDuration(request.duration());
        tripPlanning.setTravelStyle(request.travelStyle());
        tripPlanning.setUser(user);

        TripPlanning saved = tripPlanningRepository.save(tripPlanning);
        return toResponse(saved);
    }


    @Transactional
    public TripHotelResponse saveHotel(Long tripPlanningId, SelectTripHotelRequest request, String authenticatedEmail) {
        TripPlanning tripPlanning = tripPlanningRepository.findById(tripPlanningId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip planning record not found"));

        if (!tripPlanning.getUser().getEmail().equalsIgnoreCase(authenticatedEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Trip planning record belongs to another user");
        }

        Hotel hotel = hotelRepository.findById(request.hotelId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected hotel is invalid"));

        // Saves selected hotel for the current trip planning session.
        tripPlanning.setSelectedHotel(hotel);
        tripPlanning.setSelectedHotelName(hotel.getName());
        tripPlanning.setSelectedHotelCity(hotel.getCity());
        tripPlanning.setSelectedHotelPricePerNight(hotel.getPricePerNight());
        tripPlanning.setSelectedHotelStars(hotel.getStars());
        tripPlanning.setSelectedHotelRatingScore(hotel.getRatingScore());
        tripPlanning.setSelectedHotelRatingLabel(hotel.getRatingLabel());
        // Keeps multi-city hotel snapshots without changing the existing single-hotel contract.
        tripPlanning.setSelectedHotelStaysJson(cleanOptionalText(request.selectedHotelStaysJson()));

        TripPlanning saved = tripPlanningRepository.save(tripPlanning);
        evaluateLinkedTripBudgetAlerts(saved);
        return toHotelResponse(saved);
    }

    @Transactional
    public TripActivitiesResponse saveActivities(
            Long tripPlanningId,
            SelectTripActivitiesRequest request,
            String authenticatedEmail
    ) {
        TripPlanning tripPlanning = tripPlanningRepository.findById(tripPlanningId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip planning record not found"));

        if (!tripPlanning.getUser().getEmail().equalsIgnoreCase(authenticatedEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Trip planning record belongs to another user");
        }

        // Saves selected activities for the current trip planning session.
        List<TripPlanningActivity> activities = new ArrayList<>(request.activities().stream()
                .map(this::toActivitySnapshot)
                .toList());
        tripPlanning.setSelectedActivities(activities);

        TripPlanning saved = tripPlanningRepository.save(tripPlanning);
        evaluateLinkedTripBudgetAlerts(saved);
        return toActivitiesResponse(saved);
    }


    @Transactional(readOnly = true)
    public List<TripBudgetResponse> findTripsForUser(String authenticatedEmail) {
        return tripPlanningRepository.findByUserEmailIgnoreCaseOrderByUpdatedAtDesc(authenticatedEmail)
                .stream()
                .map(this::toResponse)
                .toList();

    }

    @Transactional(readOnly = true)
    public TripOverviewResponse getOverview(Long tripPlanningId, String authenticatedEmail) {
        TripPlanning tripPlanning = findAccessibleTripPlanning(tripPlanningId, authenticatedEmail);

        return new TripOverviewResponse(
                tripPlanning.getId(),
                tripPlanning.getTripName(),
                tripPlanning.getBudget(),
                tripPlanning.getCurrency(),
                tripPlanning.getDuration(),
                tripPlanning.getTravelStyle(),
                tripPlanning.getSelectedHotelName() != null ? toHotelResponse(tripPlanning) : null,
                tripPlanning.getSelectedHotelStaysJson(),
                selectedActivities(tripPlanning),
                totalActivitiesCost(tripPlanning)
        );
    }

    private TripBudgetResponse toResponse(TripPlanning tripPlanning) {
        return new TripBudgetResponse(
                tripPlanning.getId(),
                tripPlanning.getTripName(),
                tripPlanning.getBudget(),
                tripPlanning.getCurrency(),
                tripPlanning.getDuration(),
                tripPlanning.getTravelStyle()
        );
    }

    private TripHotelResponse toHotelResponse(TripPlanning tripPlanning) {
        Hotel hotel = tripPlanning.getSelectedHotel();

        return new TripHotelResponse(
                tripPlanning.getId(),
                hotel != null ? hotel.getId() : null,
                tripPlanning.getSelectedHotelName(),
                tripPlanning.getSelectedHotelCity(),
                tripPlanning.getSelectedHotelPricePerNight(),
                tripPlanning.getSelectedHotelStars(),
                tripPlanning.getSelectedHotelRatingScore(),
                tripPlanning.getSelectedHotelRatingLabel()
        );
    }

    private TripPlanningActivity toActivitySnapshot(SelectedTripActivity activity) {
        TripPlanningActivity snapshot = new TripPlanningActivity();
        snapshot.setName(activity.name().trim());
        snapshot.setCategory(activity.category().trim());
        snapshot.setPrice(activity.price());
        snapshot.setDuration(activity.duration().trim());
        snapshot.setCity(activity.city().trim());
        return snapshot;
    }

    private TripActivitiesResponse toActivitiesResponse(TripPlanning tripPlanning) {
        List<SelectedTripActivity> activities = selectedActivities(tripPlanning);

        return new TripActivitiesResponse(
                tripPlanning.getId(),
                activities,
                totalActivitiesCost(tripPlanning),
                activities.size()
        );
    }

    private TripPlanning findAccessibleTripPlanning(Long tripPlanningId, String authenticatedEmail) {
        TripPlanning tripPlanning = tripPlanningRepository.findById(tripPlanningId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip planning record not found"));

        if (tripPlanning.getUser().getEmail().equalsIgnoreCase(authenticatedEmail)) {
            return tripPlanning;
        }

        AppUser user = appUserRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found"));

        Trip accessibleTrip = tripRepository.findAccessibleByTripPlanningIdAndUserId(tripPlanningId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Trip planning record belongs to another user"));

        if (accessibleTrip.getTripPlanningId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Trip planning record belongs to another user");
        }

        return tripPlanning;
    }

    private List<SelectedTripActivity> selectedActivities(TripPlanning tripPlanning) {
        return tripPlanning.getSelectedActivities().stream()
                .map(activity -> new SelectedTripActivity(
                        activity.getName(),
                        activity.getCategory(),
                        activity.getPrice(),
                        activity.getDuration(),
                        activity.getCity()
                ))
                .toList();
    }

    private BigDecimal totalActivitiesCost(TripPlanning tripPlanning) {
        return selectedActivities(tripPlanning).stream()
                .map(SelectedTripActivity::price)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String cleanOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }

    private void evaluateLinkedTripBudgetAlerts(TripPlanning tripPlanning) {
        if (tripPlanning.getId() == null || tripPlanning.getUser() == null || tripPlanning.getUser().getId() == null) {
            return;
        }

        tripRepository.findAccessibleByTripPlanningIdAndUserId(tripPlanning.getId(), tripPlanning.getUser().getId())
                .ifPresent(budgetAlertNotificationService::evaluateForTripAudience);
    }
}
