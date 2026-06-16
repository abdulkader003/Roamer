package com.sep.tripplanning;

import com.sep.tripplanning.dto.CreateTripBudgetRequest;
import com.sep.tripplanning.dto.TripBudgetResponse;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripPlanningServiceTest {

    @Mock
    private TripPlanningRepository tripPlanningRepository;

    @Mock
    private AppUserRepository appUserRepository;

    private TripPlanningService tripPlanningService;

    @BeforeEach
    void setUp() {
        tripPlanningService = new TripPlanningService(tripPlanningRepository, appUserRepository);
    }

    @Test
    void savesBudgetStepForAuthenticatedUser() {
        AppUser user = new AppUser();
        user.setId(42L);
        user.setEmail("traveler@example.com");

        CreateTripBudgetRequest request = new CreateTripBudgetRequest(
                " Summer in Italy ",
                new BigDecimal("2500.00"),
                "EUR",
                7,
                "Mid-range"
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(tripPlanningRepository.save(org.mockito.ArgumentMatchers.any(TripPlanning.class)))
                .thenAnswer(invocation -> {
                    TripPlanning tripPlanning = invocation.getArgument(0);
                    tripPlanning.setId(10L);
                    return tripPlanning;
                });

        TripBudgetResponse response = tripPlanningService.saveBudget(request, "traveler@example.com");

        ArgumentCaptor<TripPlanning> captor = ArgumentCaptor.forClass(TripPlanning.class);
        verify(tripPlanningRepository).save(captor.capture());

        assertThat(captor.getValue().getUser()).isSameAs(user);
        assertThat(captor.getValue().getTripName()).isEqualTo("Summer in Italy");
        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.budget()).isEqualByComparingTo("2500.00");
        assertThat(response.travelStyle()).isEqualTo("Mid-range");
    }
}
