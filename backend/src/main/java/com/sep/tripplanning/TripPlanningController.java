package com.sep.tripplanning;

import com.sep.tripplanning.dto.CreateTripBudgetRequest;
import com.sep.tripplanning.dto.SelectTripActivitiesRequest;
import com.sep.tripplanning.dto.SelectTripHotelRequest;
import com.sep.tripplanning.dto.TripActivitiesResponse;
import com.sep.tripplanning.dto.TripBudgetResponse;
import com.sep.tripplanning.dto.TripHotelResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

<<<<<<< backend/src/main/java/com/sep/tripplanning/TripPlanningController.java
    @PostMapping("/{tripPlanningId}/hotel")
    public TripHotelResponse saveHotel(
            @PathVariable Long tripPlanningId,
            @Valid @RequestBody SelectTripHotelRequest request,
            Authentication authentication
    ) {
        return tripPlanningService.saveHotel(tripPlanningId, request, authentication.getName());
    }

    @PostMapping("/{tripPlanningId}/activities")
    public TripActivitiesResponse saveActivities(
            @PathVariable Long tripPlanningId,
            @Valid @RequestBody SelectTripActivitiesRequest request,
            Authentication authentication
    ) {
        return tripPlanningService.saveActivities(tripPlanningId, request, authentication.getName());
    }
=======
    @GetMapping
    public List<TripBudgetResponse> listTrips(Authentication authentication) {
        return tripPlanningService.findTripsForUser(authentication.getName());
>>>>>>> backend/src/main/java/com/sep/tripplanning/TripPlanningController.java
    }
}
