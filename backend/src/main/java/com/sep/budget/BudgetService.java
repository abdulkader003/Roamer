package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
import com.sep.budget.dto.CategoryBudgetResponse;
import com.sep.budget.dto.CreateExpenseRequest;
import com.sep.budget.dto.ExpenseResponse;
import com.sep.budget.dto.TripBudgetRowResponse;
import com.sep.trip.Trip;
import com.sep.trip.TripRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Computes budget figures from trips and their logged expenses.
 */
@Service
public class BudgetService {

    private static final BigDecimal NEAR_LIMIT_THRESHOLD = BigDecimal.valueOf(80);

    private final TripRepository tripRepository;
    private final ExpenseRepository expenseRepository;
    private final AppUserRepository appUserRepository;

    public BudgetService(
            TripRepository tripRepository,
            ExpenseRepository expenseRepository,
            AppUserRepository appUserRepository
    ) {
        this.tripRepository = tripRepository;
        this.expenseRepository = expenseRepository;
        this.appUserRepository = appUserRepository;
    }

    /**
     * User Story #1 — aggregates budget and spending across all of the user's trips.
     */
    @Transactional(readOnly = true)
    public BudgetSummaryResponse getSummary(String userEmail) {
        AppUser owner = findOwner(userEmail);

        List<Trip> trips = tripRepository.findAllByOwnerIdOrderByStartDateAsc(owner.getId());
        List<Expense> expenses = expenseRepository.findAllByTripOwnerIdOrderByDateDesc(owner.getId());

        BigDecimal totalBudget = trips.stream()
                .map(Trip::getBudget)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSpent = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remaining = totalBudget.subtract(totalSpent);

        int usagePercentage = totalBudget.signum() == 0
                ? 0
                : totalSpent
                    .multiply(BigDecimal.valueOf(100))
                    .divide(totalBudget, 0, RoundingMode.HALF_UP)
                    .intValue();

        return new BudgetSummaryResponse(totalBudget, totalSpent, remaining, usagePercentage);
    }

    /**
     * User Story #6 — one row per trip with spend, remaining balance, and status.
     */
    @Transactional(readOnly = true)
    public List<TripBudgetRowResponse> getTripBudgetRows(String userEmail) {
        AppUser owner = findOwner(userEmail);

        List<Trip> trips = tripRepository.findAllByOwnerIdOrderByStartDateAsc(owner.getId());
        List<Expense> expenses = expenseRepository.findAllByTripOwnerIdOrderByDateDesc(owner.getId());

        Map<Long, BigDecimal> spentByTripId = expenses.stream()
                .collect(Collectors.groupingBy(
                        expense -> expense.getTrip().getId(),
                        Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)
                ));

        return trips.stream()
                .map(trip -> toRow(trip, spentByTripId.getOrDefault(trip.getId(), BigDecimal.ZERO)))
                .toList();
    }

    /**
     * User Story #5 — logs a new manual expense against one of the user's trips.
     *
     * @throws IllegalArgumentException when the trip does not exist or does not
     * belong to the authenticated user
     */
    @Transactional
    public ExpenseResponse createExpense(String userEmail, CreateExpenseRequest request) {
        AppUser owner = findOwner(userEmail);

        Trip trip = tripRepository.findById(request.tripId())
                .orElseThrow(() -> new IllegalArgumentException("Trip was not found."));

        if (!trip.getOwner().getId().equals(owner.getId())) {
            throw new IllegalArgumentException("Trip was not found.");
        }

        Expense expense = new Expense();
        expense.setTrip(trip);
        expense.setCategory(request.category());
        expense.setAmount(request.amount());
        expense.setDescription(request.description() == null ? null : request.description().trim());
        expense.setDate(request.date());

        Expense saved = expenseRepository.save(expense);

        return toExpenseResponse(saved);
    }

    private ExpenseResponse toExpenseResponse(Expense expense) {
        return new ExpenseResponse(
                expense.getId(),
                expense.getTrip().getId(),
                expense.getCategory(),
                expense.getAmount(),
                expense.getDescription(),
                expense.getDate()
        );
    }

    /**
     * User Story #4 — spend vs. an equal per-category share of the total budget,
     * aggregated across all of the user's trips.
     */
    @Transactional(readOnly = true)
    public List<CategoryBudgetResponse> getCategoryBudgets(String userEmail) {
        AppUser owner = findOwner(userEmail);

        List<Trip> trips = tripRepository.findAllByOwnerIdOrderByStartDateAsc(owner.getId());
        List<Expense> expenses = expenseRepository.findAllByTripOwnerIdOrderByDateDesc(owner.getId());

        BigDecimal totalBudget = trips.stream()
                .map(Trip::getBudget)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        ExpenseCategory[] categories = ExpenseCategory.values();
        BigDecimal categoryBudget = categories.length == 0
                ? BigDecimal.ZERO
                : totalBudget.divide(BigDecimal.valueOf(categories.length), 2, RoundingMode.HALF_UP);

        Map<ExpenseCategory, BigDecimal> spentByCategory = expenses.stream()
                .collect(Collectors.groupingBy(
                        Expense::getCategory,
                        Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)
                ));

        return Arrays.stream(categories)
                .map(category -> toCategoryRow(category, spentByCategory.getOrDefault(category, BigDecimal.ZERO), categoryBudget))
                .toList();
    }

    private CategoryBudgetResponse toCategoryRow(ExpenseCategory category, BigDecimal spent, BigDecimal budget) {
        int percentage = budget.signum() == 0
                ? (spent.signum() > 0 ? 100 : 0)
                : Math.min(
                        spent.multiply(BigDecimal.valueOf(100))
                                .divide(budget, 0, RoundingMode.HALF_UP)
                                .intValue(),
                        100
                );

        return new CategoryBudgetResponse(
                category,
                spent,
                budget,
                percentage,
                isNearLimit(budget, spent),
                isOverBudget(budget, spent)
        );
    }

    private TripBudgetRowResponse toRow(Trip trip, BigDecimal spent) {
        BigDecimal budget = trip.getBudget();
        BigDecimal remaining = budget.subtract(spent);

        String status;
        if (isOverBudget(budget, spent)) {
            status = "Over Budget";
        } else if (isNearLimit(budget, spent)) {
            status = "Near Limit";
        } else {
            status = "Under Budget";
        }

        return new TripBudgetRowResponse(
                trip.getId(),
                trip.getName(),
                trip.getDestination(),
                budget,
                spent,
                remaining,
                status
        );
    }

    private boolean isOverBudget(BigDecimal budget, BigDecimal spent) {
        if (budget.signum() == 0) {
            return spent.signum() > 0;
        }
        return spent.compareTo(budget) >= 0;
    }

    private boolean isNearLimit(BigDecimal budget, BigDecimal spent) {
        if (budget.signum() == 0) {
            return false;
        }
        return spent.multiply(BigDecimal.valueOf(100))
                .compareTo(budget.multiply(NEAR_LIMIT_THRESHOLD)) >= 0;
    }

    private AppUser findOwner(String userEmail) {
        return appUserRepository.findByEmailIgnoreCase(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));
    }
}
