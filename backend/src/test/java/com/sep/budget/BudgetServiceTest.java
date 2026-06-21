package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
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
        Expense expense = new Expense();
        expense.setTrip(trip);
        expense.setAmount(new BigDecimal(amount));
        expense.setCategory(ExpenseCategory.FOOD);
        expense.setDate(LocalDate.of(2026, 7, 16));
        return expense;
    }
}
