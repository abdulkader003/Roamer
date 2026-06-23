package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
import com.sep.budget.dto.BudgetReportResponse;
import com.sep.budget.dto.CategoryBudgetResponse;
import com.sep.budget.dto.CreateExpenseRequest;
import com.sep.budget.dto.ExpenseResponse;
import com.sep.budget.dto.SpendingDataPointResponse;
import com.sep.budget.dto.SpendingDistributionResponse;
import com.sep.budget.dto.TripBudgetRowResponse;
import com.sep.trip.Trip;
import com.sep.trip.TripRepository;
import com.sep.trip.TripStatus;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private AppUserRepository appUserRepository;

    private BudgetService budgetService;
    private AppUser owner;

    @BeforeEach
    void setUp() {
        budgetService = new BudgetService(tripRepository, expenseRepository, appUserRepository);
        owner = new AppUser();
        owner.setId(7L);
        owner.setEmail("traveler@example.com");
    }

    @Test
    void summaryReturnsZeroValuesForEmptyTrips() {
        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAllByOwnerIdOrderByStartDateAsc(7L)).thenReturn(List.of());
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of());

        BudgetSummaryResponse response = budgetService.getSummary("traveler@example.com");

        assertThat(response.totalBudget()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(response.totalSpent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(response.remainingBalance()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(response.usagePercentage()).isZero();
        verify(tripRepository).findAllByOwnerIdOrderByStartDateAsc(7L);
        verify(expenseRepository).findAllByTripOwnerIdOrderByDateDesc(7L);
    }

    @Test
    void summaryAggregatesBudgetSpentRemainingAndUsagePercentage() {
        Trip rome = trip(11L, "Rome", "1000.00");
        Trip vienna = trip(12L, "Vienna", "500.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAllByOwnerIdOrderByStartDateAsc(7L)).thenReturn(List.of(rome, vienna));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L))
                .thenReturn(List.of(expense(rome, "200.00"), expense(vienna, "100.00")));

        BudgetSummaryResponse response = budgetService.getSummary("traveler@example.com");

        assertThat(response.totalBudget()).isEqualByComparingTo("1500.00");
        assertThat(response.totalSpent()).isEqualByComparingTo("300.00");
        assertThat(response.remainingBalance()).isEqualByComparingTo("1200.00");
        assertThat(response.usagePercentage()).isEqualTo(20);
    }

    @Test
    void tripRowsCalculateStatusesWithoutRoundedPercentageMisclassification() {
        Trip under = trip(11L, "Under", "1000.00");
        Trip near = trip(12L, "Near", "1000.00");
        Trip almostOver = trip(13L, "Almost Over", "1000.00");
        Trip over = trip(14L, "Over", "1000.00");
        Trip zeroBudget = trip(15L, "Zero Budget", "0.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAllByOwnerIdOrderByStartDateAsc(7L))
                .thenReturn(List.of(under, near, almostOver, over, zeroBudget));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of(
                expense(near, "800.00"),
                expense(almostOver, "995.00"),
                expense(over, "1000.00"),
                expense(zeroBudget, "5.00")
        ));

        List<TripBudgetRowResponse> response = budgetService.getTripBudgetRows("traveler@example.com");

        assertThat(response).extracting(TripBudgetRowResponse::status)
                .containsExactly("Under Budget", "Near Limit", "Near Limit", "Over Budget", "Over Budget");
        assertThat(response.get(0).spent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(response.get(4).remaining()).isEqualByComparingTo("-5.00");
        verify(tripRepository).findAllByOwnerIdOrderByStartDateAsc(7L);
        verify(expenseRepository).findAllByTripOwnerIdOrderByDateDesc(7L);
    }

    @Test
    void categoryBudgetsAggregateSpendingAndFlagsByCategory() {
        Trip rome = trip(11L, "Rome", "1000.00");
        Trip vienna = trip(12L, "Vienna", "500.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAllByOwnerIdOrderByStartDateAsc(7L)).thenReturn(List.of(rome, vienna));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of(
                expense(rome, ExpenseCategory.FLIGHTS, "100.00"),
                expense(vienna, ExpenseCategory.FLIGHTS, "140.00"),
                expense(rome, ExpenseCategory.HOTELS, "240.00"),
                expense(vienna, ExpenseCategory.FOOD, "305.00")
        ));

        List<CategoryBudgetResponse> response = budgetService.getCategoryBudgets("traveler@example.com");

        assertThat(response).hasSize(ExpenseCategory.values().length);
        CategoryBudgetResponse flights = category(response, ExpenseCategory.FLIGHTS);
        assertThat(flights.budget()).isEqualByComparingTo("300.00");
        assertThat(flights.spent()).isEqualByComparingTo("240.00");
        assertThat(flights.percentage()).isEqualTo(80);
        assertThat(flights.isNearLimit()).isTrue();
        assertThat(flights.isOverLimit()).isFalse();

        CategoryBudgetResponse hotels = category(response, ExpenseCategory.HOTELS);
        assertThat(hotels.percentage()).isEqualTo(80);
        assertThat(hotels.isNearLimit()).isTrue();
        assertThat(hotels.isOverLimit()).isFalse();

        CategoryBudgetResponse food = category(response, ExpenseCategory.FOOD);
        assertThat(food.percentage()).isEqualTo(100);
        assertThat(food.isNearLimit()).isTrue();
        assertThat(food.isOverLimit()).isTrue();

        CategoryBudgetResponse transport = category(response, ExpenseCategory.TRANSPORT);
        assertThat(transport.spent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(transport.percentage()).isZero();
        assertThat(transport.isNearLimit()).isFalse();
        assertThat(transport.isOverLimit()).isFalse();
    }

    @Test
    void categoryBudgetsReturnConsistentPercentageForZeroBudgetWithSpending() {
        Trip zeroBudget = trip(11L, "Zero Budget", "0.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAllByOwnerIdOrderByStartDateAsc(7L)).thenReturn(List.of(zeroBudget));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of(
                expense(zeroBudget, ExpenseCategory.FOOD, "5.00")
        ));

        List<CategoryBudgetResponse> response = budgetService.getCategoryBudgets("traveler@example.com");

        CategoryBudgetResponse food = category(response, ExpenseCategory.FOOD);
        assertThat(food.budget()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(food.spent()).isEqualByComparingTo("5.00");
        assertThat(food.percentage()).isEqualTo(100);
        assertThat(food.isNearLimit()).isFalse();
        assertThat(food.isOverLimit()).isTrue();

        CategoryBudgetResponse flights = category(response, ExpenseCategory.FLIGHTS);
        assertThat(flights.percentage()).isZero();
        assertThat(flights.isOverLimit()).isFalse();
    }

    @Test
    void createsExpenseForOwnedTrip() {
        Trip trip = trip(11L, "Rome", "1000.00");
        CreateExpenseRequest request = new CreateExpenseRequest(
                11L,
                ExpenseCategory.FOOD,
                new BigDecimal("42.50"),
                "  Lunch  ",
                LocalDate.of(2026, 7, 16)
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findById(11L)).thenReturn(Optional.of(trip));
        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> {
            Expense expense = invocation.getArgument(0);
            expense.setId(99L);
            return expense;
        });

        ExpenseResponse response = budgetService.createExpense("traveler@example.com", request);

        assertThat(response.id()).isEqualTo(99L);
        assertThat(response.tripId()).isEqualTo(11L);
        assertThat(response.category()).isEqualTo(ExpenseCategory.FOOD);
        assertThat(response.amount()).isEqualByComparingTo("42.50");
        assertThat(response.description()).isEqualTo("Lunch");
        assertThat(response.date()).isEqualTo(LocalDate.of(2026, 7, 16));
        verify(expenseRepository).save(any(Expense.class));
    }

    @Test
    void rejectsExpenseForForeignTripWithoutSaving() {
        AppUser anotherOwner = new AppUser();
        anotherOwner.setId(99L);
        anotherOwner.setEmail("other@example.com");
        Trip foreignTrip = trip(11L, "Rome", "1000.00");
        foreignTrip.setOwner(anotherOwner);
        CreateExpenseRequest request = new CreateExpenseRequest(
                11L,
                ExpenseCategory.FOOD,
                new BigDecimal("42.50"),
                "Lunch",
                LocalDate.of(2026, 7, 16)
        );

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findById(11L)).thenReturn(Optional.of(foreignTrip));

        assertThatThrownBy(() -> budgetService.createExpense("traveler@example.com", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Trip was not found.");
        verify(expenseRepository, never()).save(any(Expense.class));
    }

    @Test
    void spendingOverTimeGroupsMonthlyInChronologicalOrder() {
        Trip trip = trip(11L, "Rome", "1000.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of(
                expense(trip, ExpenseCategory.FOOD, "50.00", LocalDate.of(2026, 4, 5)),
                expense(trip, ExpenseCategory.FOOD, "25.00", LocalDate.of(2026, 2, 10)),
                expense(trip, ExpenseCategory.HOTELS, "10.00", LocalDate.of(2026, 1, 1)),
                expense(trip, ExpenseCategory.FLIGHTS, "15.00", LocalDate.of(2026, 2, 12))
        ));

        List<SpendingDataPointResponse> response = budgetService.getSpendingOverTime("traveler@example.com", "monthly");

        assertThat(response).extracting(SpendingDataPointResponse::label)
                .containsExactly("Jan 2026", "Feb 2026", "Apr 2026");
        assertThat(response.get(0).amount()).isEqualByComparingTo("10.00");
        assertThat(response.get(1).amount()).isEqualByComparingTo("40.00");
        assertThat(response.get(2).amount()).isEqualByComparingTo("50.00");
    }

    @Test
    void spendingOverTimeGroupsYearlyInChronologicalOrder() {
        Trip trip = trip(11L, "Rome", "1000.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of(
                expense(trip, ExpenseCategory.FOOD, "50.00", LocalDate.of(2026, 4, 5)),
                expense(trip, ExpenseCategory.HOTELS, "25.00", LocalDate.of(2025, 2, 10)),
                expense(trip, ExpenseCategory.FLIGHTS, "15.00", LocalDate.of(2025, 1, 12))
        ));

        List<SpendingDataPointResponse> response = budgetService.getSpendingOverTime("traveler@example.com", "yearly");

        assertThat(response).extracting(SpendingDataPointResponse::label)
                .containsExactly("2025", "2026");
        assertThat(response.get(0).amount()).isEqualByComparingTo("40.00");
        assertThat(response.get(1).amount()).isEqualByComparingTo("50.00");
    }

    @Test
    void spendingOverTimeRejectsInvalidView() {
        assertThatThrownBy(() -> budgetService.getSpendingOverTime("traveler@example.com", "weekly"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("View must be either monthly or yearly.");

        verify(appUserRepository, never()).findByEmailIgnoreCase(any());
        verify(expenseRepository, never()).findAllByTripOwnerIdOrderByDateDesc(any());
    }

    @Test
    void distributionReturnsEveryCategoryWithRoundedPercentages() {
        Trip trip = trip(11L, "Rome", "1000.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of(
                expense(trip, ExpenseCategory.FLIGHTS, "30.00"),
                expense(trip, ExpenseCategory.HOTELS, "20.00")
        ));

        List<SpendingDistributionResponse> response = budgetService.getSpendingDistribution("traveler@example.com");

        assertThat(response).hasSize(ExpenseCategory.values().length);
        SpendingDistributionResponse flights = distribution(response, ExpenseCategory.FLIGHTS);
        assertThat(flights.amount()).isEqualByComparingTo("30.00");
        assertThat(flights.percentage()).isEqualTo(60);

        SpendingDistributionResponse hotels = distribution(response, ExpenseCategory.HOTELS);
        assertThat(hotels.amount()).isEqualByComparingTo("20.00");
        assertThat(hotels.percentage()).isEqualTo(40);

        SpendingDistributionResponse food = distribution(response, ExpenseCategory.FOOD);
        assertThat(food.amount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(food.percentage()).isZero();
    }

    @Test
    void reportCombinesSummaryCategoriesAndTrips() {
        Trip trip = trip(11L, "Rome", "1000.00");

        when(appUserRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAllByOwnerIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip));
        when(expenseRepository.findAllByTripOwnerIdOrderByDateDesc(7L)).thenReturn(List.of(
                expense(trip, ExpenseCategory.FOOD, "100.00")
        ));

        BudgetReportResponse response = budgetService.getReport("traveler@example.com");

        assertThat(response.totalBudget()).isEqualByComparingTo("1000.00");
        assertThat(response.totalSpent()).isEqualByComparingTo("100.00");
        assertThat(response.remainingBalance()).isEqualByComparingTo("900.00");
        assertThat(response.usagePercentage()).isEqualTo(10);
        assertThat(response.categories()).hasSize(ExpenseCategory.values().length);
        assertThat(response.trips()).hasSize(1);
        assertThat(response.trips().get(0).tripId()).isEqualTo(11L);
    }

    private Trip trip(Long id, String name, String budget) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setName(name);
        trip.setDestination("Rome, Italy");
        trip.setStartDate(LocalDate.of(2026, 7, 15));
        trip.setEndDate(LocalDate.of(2026, 7, 22));
        trip.setBudget(new BigDecimal(budget));
        trip.setStatus(TripStatus.UPCOMING);
        trip.setOwner(owner);
        return trip;
    }

    private Expense expense(Trip trip, String amount) {
        return expense(trip, ExpenseCategory.FOOD, amount);
    }

    private Expense expense(Trip trip, ExpenseCategory category, String amount) {
        return expense(trip, category, amount, LocalDate.of(2026, 7, 16));
    }

    private Expense expense(Trip trip, ExpenseCategory category, String amount, LocalDate date) {
        Expense expense = new Expense();
        expense.setTrip(trip);
        expense.setAmount(new BigDecimal(amount));
        expense.setCategory(category);
        expense.setDate(date);
        return expense;
    }

    private CategoryBudgetResponse category(List<CategoryBudgetResponse> rows, ExpenseCategory category) {
        return rows.stream()
                .filter(row -> row.category() == category)
                .findFirst()
                .orElseThrow();
    }

    private SpendingDistributionResponse distribution(List<SpendingDistributionResponse> rows, ExpenseCategory category) {
        return rows.stream()
                .filter(row -> row.category() == category)
                .findFirst()
                .orElseThrow();
    }
}
