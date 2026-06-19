package com.sep.tripplanning;

import com.sep.tripplanning.dto.CreateTripBudgetRequest;
import com.sep.tripplanning.dto.TripBudgetResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/trip-planning")
public class TripPlanningController {

    private final TripPlanningService tripPlanningService;

    public TripPlanningController(TripPlanningService tripPlanningService) {
        this.tripPlanningService = tripPlanningService;
    }

    @PostMapping("/budget")
    @ResponseStatus(HttpStatus.CREATED)
    public TripBudgetResponse saveBudget(
            @Valid @RequestBody CreateTripBudgetRequest request,
            Authentication authentication
    ) {
        return tripPlanningService.saveBudget(request, authentication.getName());
    }

    @GetMapping
    public List<TripBudgetResponse> listTrips(Authentication authentication) {
        return tripPlanningService.findTripsForUser(authentication.getName());
    }
}
