package com.sep.traveldeals;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/travel-deals")
public class TravelDealsController {

    private final TravelDealsService travelDealsService;

    public TravelDealsController(TravelDealsService travelDealsService) {
        this.travelDealsService = travelDealsService;
    }

    @GetMapping
    public List<TravelDealResponse> getTravelDeals(
            Authentication authentication,
            @RequestParam(required = false) String refreshKey
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }

        return travelDealsService.findDealsForUser(authentication.getName(), refreshKey);
    }
}
