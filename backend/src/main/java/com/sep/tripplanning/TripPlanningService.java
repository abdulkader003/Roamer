package com.sep.tripplanning;

import com.sep.tripplanning.dto.CreateTripBudgetRequest;
import com.sep.tripplanning.dto.TripBudgetResponse;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class TripPlanningService {

    private final TripPlanningRepository tripPlanningRepository;
    private final AppUserRepository appUserRepository;

    public TripPlanningService(
            TripPlanningRepository tripPlanningRepository,
            AppUserRepository appUserRepository
    ) {
        this.tripPlanningRepository = tripPlanningRepository;
        this.appUserRepository = appUserRepository;
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

    @Transactional(readOnly = true)
    public List<TripBudgetResponse> findTripsForUser(String authenticatedEmail) {
        return tripPlanningRepository.findByUserEmailIgnoreCaseOrderByUpdatedAtDesc(authenticatedEmail)
                .stream()
                .map(this::toResponse)
                .toList();
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
}
