package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
import com.sep.budget.dto.BudgetReportResponse;
import com.sep.budget.dto.CategoryBudgetResponse;
import com.sep.budget.dto.CreateExpenseRequest;
import com.sep.budget.dto.ExpenseResponse;
import com.sep.budget.dto.SpendingDataPointResponse;
import com.sep.budget.dto.SpendingDistributionResponse;
import com.sep.budget.dto.TripBudgetRowResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

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
    private Validator validator;

    @BeforeEach
    void setUp() {
        budgetController = new BudgetController(budgetService);
        validator = Validation.buildDefaultValidatorFactory().getValidator();
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

    @Test
    void categoryBudgetsUseAuthenticatedEmail() {
        CategoryBudgetResponse category = new CategoryBudgetResponse(
                ExpenseCategory.FOOD,
                new BigDecimal("120.00"),
                new BigDecimal("300.00"),
                40,
                false,
                false
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(budgetService.getCategoryBudgets("traveler@example.com")).thenReturn(List.of(category));

        List<CategoryBudgetResponse> response = budgetController.getCategoryBudgets(authentication);

        assertThat(response).containsExactly(category);
        verify(budgetService).getCategoryBudgets("traveler@example.com");
    }

    @Test
    void spendingOverTimeUsesAuthenticatedEmailAndView() {
        SpendingDataPointResponse point = new SpendingDataPointResponse("Jan 2026", new BigDecimal("42.00"));
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(budgetService.getSpendingOverTime("traveler@example.com", "monthly")).thenReturn(List.of(point));

        List<SpendingDataPointResponse> response = budgetController.getSpendingOverTime(authentication, "monthly");

        assertThat(response).containsExactly(point);
        verify(budgetService).getSpendingOverTime("traveler@example.com", "monthly");
    }

    @Test
    void distributionUsesAuthenticatedEmail() {
        SpendingDistributionResponse distribution = new SpendingDistributionResponse(
                ExpenseCategory.FOOD,
                new BigDecimal("42.00"),
                100
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(budgetService.getSpendingDistribution("traveler@example.com")).thenReturn(List.of(distribution));

        List<SpendingDistributionResponse> response = budgetController.getSpendingDistribution(authentication);

        assertThat(response).containsExactly(distribution);
        verify(budgetService).getSpendingDistribution("traveler@example.com");
    }

    @Test
    void reportUsesAuthenticatedEmail() {
        BudgetReportResponse report = new BudgetReportResponse(
                new BigDecimal("1500.00"),
                new BigDecimal("300.00"),
                new BigDecimal("1200.00"),
                20,
                List.of(),
                List.of()
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(budgetService.getReport("traveler@example.com")).thenReturn(report);

        BudgetReportResponse response = budgetController.getReport(authentication);

        assertThat(response).isEqualTo(report);
        verify(budgetService).getReport("traveler@example.com");
    }

    @Test
    void createExpenseUsesAuthenticatedEmail() {
        CreateExpenseRequest request = validExpenseRequest();
        ExpenseResponse expense = new ExpenseResponse(
                99L,
                11L,
                ExpenseCategory.FOOD,
                new BigDecimal("42.50"),
                "Lunch",
                LocalDate.of(2026, 7, 16)
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(budgetService.createExpense("traveler@example.com", request)).thenReturn(expense);

        ExpenseResponse response = budgetController.createExpense(authentication, request);

        assertThat(response).isEqualTo(expense);
        verify(budgetService).createExpense("traveler@example.com", request);
    }

    @Test
    void expenseRequestRejectsInvalidAmount() {
        CreateExpenseRequest zero = new CreateExpenseRequest(
                11L,
                ExpenseCategory.FOOD,
                BigDecimal.ZERO,
                "Lunch",
                LocalDate.of(2026, 7, 16)
        );
        CreateExpenseRequest tooManyDecimals = new CreateExpenseRequest(
                11L,
                ExpenseCategory.FOOD,
                new BigDecimal("12.345"),
                "Lunch",
                LocalDate.of(2026, 7, 16)
        );
        CreateExpenseRequest tooManyIntegerDigits = new CreateExpenseRequest(
                11L,
                ExpenseCategory.FOOD,
                new BigDecimal("10000000000.00"),
                "Lunch",
                LocalDate.of(2026, 7, 16)
        );

        assertThat(propertyNames(validator.validate(zero))).contains("amount");
        assertThat(propertyNames(validator.validate(tooManyDecimals))).contains("amount");
        assertThat(propertyNames(validator.validate(tooManyIntegerDigits))).contains("amount");
    }

    @Test
    void expenseRequestRejectsMissingRequiredFields() {
        CreateExpenseRequest request = new CreateExpenseRequest(null, null, null, "Lunch", null);

        assertThat(propertyNames(validator.validate(request)))
                .contains("tripId", "category", "amount", "date");
    }

    @Test
    void expenseRequestRejectsTooLongDescription() {
        CreateExpenseRequest request = new CreateExpenseRequest(
                11L,
                ExpenseCategory.FOOD,
                new BigDecimal("42.50"),
                "x".repeat(256),
                LocalDate.of(2026, 7, 16)
        );

        assertThat(propertyNames(validator.validate(request))).contains("description");
    }

    private CreateExpenseRequest validExpenseRequest() {
        return new CreateExpenseRequest(
                11L,
                ExpenseCategory.FOOD,
                new BigDecimal("42.50"),
                "Lunch",
                LocalDate.of(2026, 7, 16)
        );
    }

    private Set<String> propertyNames(Set<ConstraintViolation<CreateExpenseRequest>> violations) {
        return violations.stream()
                .map(violation -> violation.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }
}
