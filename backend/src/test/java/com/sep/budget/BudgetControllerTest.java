package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
import com.sep.budget.dto.TripBudgetRowResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetControllerTest {

    @Mock
    private BudgetService budgetService;

    @Mock
    private Authentication authentication;

    private BudgetController budgetController;

    @BeforeEach
    void setUp() {
        budgetController = new BudgetController(budgetService);
    }

    @Test
    void summaryUsesAuthenticatedEmail() {
        BudgetSummaryResponse summary = new BudgetSummaryResponse(
                new BigDecimal("1500.00"),
                BigDecimal.ZERO,
                new BigDecimal("1500.00"),
                0
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(budgetService.getSummary("traveler@example.com")).thenReturn(summary);

        BudgetSummaryResponse response = budgetController.getSummary(authentication);

        assertThat(response).isEqualTo(summary);
        verify(budgetService).getSummary("traveler@example.com");
    }

    @Test
    void tripRowsUseAuthenticatedEmail() {
        TripBudgetRowResponse row = new TripBudgetRowResponse(
                11L,
                "Summer Getaway",
                "Rome, Italy",
                new BigDecimal("1500.00"),
                BigDecimal.ZERO,
                new BigDecimal("1500.00"),
                "Under Budget"
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(budgetService.getTripBudgetRows("traveler@example.com")).thenReturn(List.of(row));

        List<TripBudgetRowResponse> response = budgetController.getTripBudgetRows(authentication);

        assertThat(response).containsExactly(row);
        verify(budgetService).getTripBudgetRows("traveler@example.com");
    }
}
