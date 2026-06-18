package com.sep.tripplanning;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
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
    void rejectsInvalidHotelSelectionBeforeSaving() throws Exception {
        mockMvc.perform(post("/api/trip-planning/10/hotel")
                        .principal(new UsernamePasswordAuthenticationToken(
                                "traveler@example.com",
                                null
                        ))
                        .contentType("application/json")
                        .content("{\"hotelId\":0}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(tripPlanningService);
    }

    @Test
    void forwardsValidHotelSelectionToService() throws Exception {
        mockMvc.perform(post("/api/trip-planning/10/hotel")
                        .principal(new UsernamePasswordAuthenticationToken(
                                "traveler@example.com",
                                null
                        ))
                        .contentType("application/json")
                        .content("{\"hotelId\":77}"))
                .andExpect(status().isOk());

        verify(tripPlanningService).saveHotel(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.argThat(request -> request.hotelId().equals(77L)),
                org.mockito.ArgumentMatchers.eq("traveler@example.com")
        );
    }

    @Test
    void rejectsNegativeActivityPriceBeforeSaving() throws Exception {
        String invalidRequest = """
                {
                  "activities": [
                    {
                      "name": "Picasso Museum",
                      "category": "Arts & Culture",
                      "price": -1,
                      "duration": "2 hours",
                      "city": "Barcelona"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/trip-planning/10/activities")
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
    void rejectsBlankActivityNameBeforeSaving() throws Exception {
        String invalidRequest = """
                {
                  "activities": [
                    {
                      "name": " ",
                      "category": "Tours",
                      "price": 20,
                      "duration": "1 hour",
                      "city": "Barcelona"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/trip-planning/10/activities")
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
    void forwardsValidActivitiesSelectionToService() throws Exception {
        String validRequest = """
                {
                  "activities": [
                    {
                      "name": "Picasso Museum",
                      "category": "Arts & Culture",
                      "price": 28,
                      "duration": "2 hours",
                      "city": "Barcelona"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/trip-planning/10/activities")
                        .principal(new UsernamePasswordAuthenticationToken(
                                "traveler@example.com",
                                null
                        ))
                        .contentType("application/json")
                        .content(validRequest))
                .andExpect(status().isOk());

        verify(tripPlanningService).saveActivities(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.argThat(request -> request.activities().size() == 1),
                org.mockito.ArgumentMatchers.eq("traveler@example.com")
        );
    }
}
