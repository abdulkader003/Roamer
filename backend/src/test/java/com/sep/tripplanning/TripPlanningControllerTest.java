package com.sep.tripplanning;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class TripPlanningControllerTest {

    @Mock
    private TripPlanningService tripPlanningService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TripPlanningController(tripPlanningService)).build();
    }

    @Test
    void rejectsInvalidBudgetRequestBeforeSaving() throws Exception {
        String invalidRequest = """
                {
                  "tripName": " ",
                  "budget": 0,
                  "currency": "GBP",
                  "duration": 0,
                  "travelStyle": "Premium"
                }
                """;

        mockMvc.perform(post("/api/trip-planning/budget")
                        .principal(new UsernamePasswordAuthenticationToken(
                                "traveler@example.com",
                                null
                        ))
                        .contentType("application/json")
                        .content(invalidRequest))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(tripPlanningService);
    }

    @Test
    void listsTripsForAuthenticatedUser() throws Exception {
        mockMvc.perform(get("/api/trip-planning")
                        .principal(new UsernamePasswordAuthenticationToken(
                                "traveler@example.com",
                                null
                        )))
                .andExpect(status().isOk());

        verify(tripPlanningService).findTripsForUser("traveler@example.com");
    }
}
