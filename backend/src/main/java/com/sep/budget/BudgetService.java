package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
import com.sep.budget.dto.BudgetReportResponse;
import com.sep.budget.dto.UpdateCategoryBudgetRequest;
import com.sep.budget.dto.SpendingDataPointResponse;
import com.sep.budget.dto.SpendingDistributionResponse;
import com.sep.budget.dto.CategoryBudgetResponse;
import com.sep.budget.dto.CreateExpenseRequest;
import com.sep.budget.dto.ExpenseResponse;
import com.sep.budget.dto.TripBudgetRowResponse;
import com.sep.trip.Trip;
import com.sep.trip.TripInvitation;
import com.sep.trip.TripInvitationRepository;
import com.sep.trip.TripInvitationStatus;
import com.sep.trip.TripRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.Month;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.TreeMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

/**
 * Computes budget figures from trips and their logged expenses.
 */
@Service
public class BudgetService {

    private static final BigDecimal NEAR_LIMIT_THRESHOLD = BigDecimal.valueOf(80);
    private static final List<ExpenseCategory> TRACKED_CATEGORIES = List.of(
            ExpenseCategory.FLIGHTS,
            ExpenseCategory.HOTELS,
            ExpenseCategory.FOOD,
            ExpenseCategory.ACTIVITIES,
            ExpenseCategory.OTHERS
    );

    private final TripRepository tripRepository;
    private final TripInvitationRepository tripInvitationRepository;
    private final ExpenseRepository expenseRepository;
    private final CategoryBudgetLimitRepository categoryBudgetLimitRepository;
    private final AppUserRepository appUserRepository;
    private final BudgetRealtimeWebSocketPublisher budgetRealtimeWebSocketPublisher;
    private final BudgetAlertNotificationService budgetAlertNotificationService;
    private final Clock clock;

    private record SpendingEntry(
            Long tripId,
            ExpenseCategory category,
            BigDecimal amount,
            LocalDate date
    ) {
    }

    @Autowired
    public BudgetService(
            TripRepository tripRepository,
            TripInvitationRepository tripInvitationRepository,
            ExpenseRepository expenseRepository,
            CategoryBudgetLimitRepository categoryBudgetLimitRepository,
            AppUserRepository appUserRepository,
            BudgetRealtimeWebSocketPublisher budgetRealtimeWebSocketPublisher,
            BudgetAlertNotificationService budgetAlertNotificationService
    ) {
        this(
                tripRepository,
                tripInvitationRepository,
                expenseRepository,
                categoryBudgetLimitRepository,
                appUserRepository,
                budgetRealtimeWebSocketPublisher,
                budgetAlertNotificationService,
                Clock.systemDefaultZone()
        );
    }

    BudgetService(
            TripRepository tripRepository,
            TripInvitationRepository tripInvitationRepository,
            ExpenseRepository expenseRepository,
            CategoryBudgetLimitRepository categoryBudgetLimitRepository,
            AppUserRepository appUserRepository,
            BudgetRealtimeWebSocketPublisher budgetRealtimeWebSocketPublisher,
            BudgetAlertNotificationService budgetAlertNotificationService,
            Clock clock
    ) {
        this.tripRepository = tripRepository;
        this.tripInvitationRepository = tripInvitationRepository;
        this.expenseRepository = expenseRepository;
        this.categoryBudgetLimitRepository = categoryBudgetLimitRepository;
        this.appUserRepository = appUserRepository;
        this.budgetRealtimeWebSocketPublisher = budgetRealtimeWebSocketPublisher;
        this.budgetAlertNotificationService = budgetAlertNotificationService;
        this.clock = clock;
    }

    /**
     * User Story #1 — aggregates budget and spending across all of the user's trips.
     */
    @Transactional(readOnly = true)
    public BudgetSummaryResponse getSummary(String userEmail) {
        AppUser owner = findOwner(userEmail);

        List<Trip> trips = accessibleTrips(owner);
        List<Expense> expenses = accessibleExpenses(trips);
        List<SpendingEntry> spendingEntries = spendingEntries(trips, expenses);

        BigDecimal totalBudget = trips.stream()
                .map(Trip::getBudget)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSpent = totalSpent(spendingEntries);

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

        List<Trip> trips = accessibleTrips(owner);
        List<Expense> expenses = accessibleExpenses(trips);
        List<SpendingEntry> spendingEntries = spendingEntries(trips, expenses);

        Map<Long, Map<ExpenseCategory, BigDecimal>> spentByTripAndCategory = spendingEntries.stream()
                .collect(Collectors.groupingBy(
                        SpendingEntry::tripId,
                        Collectors.groupingBy(
                                SpendingEntry::category,
                                Collectors.reducing(BigDecimal.ZERO, SpendingEntry::amount, BigDecimal::add)
                        )
                ));

        Map<Long, BigDecimal> spentByTripId = spendingEntries.stream()
                .collect(Collectors.groupingBy(
                        SpendingEntry::tripId,
                        Collectors.reducing(BigDecimal.ZERO, SpendingEntry::amount, BigDecimal::add)
                ));

        return trips.stream()
                .map(trip -> toRow(
                        trip,
                        spentByTripId.getOrDefault(trip.getId(), BigDecimal.ZERO),
                        spentByTripAndCategory.getOrDefault(trip.getId(), Map.of())
                ))
                .toList();
    }

    /**
     * User Story #5 — list the authenticated user's manual expenses.
     */
    @Transactional(readOnly = true)
    public List<ExpenseResponse> getExpenses(String userEmail) {
        AppUser owner = findOwner(userEmail);

        return accessibleExpenses(accessibleTrips(owner)).stream()
                .map(this::toExpenseResponse)
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
        budgetRealtimeWebSocketPublisher.publishExpenseCreated(trip, owner, sharedTripParticipants(trip), saved);
        budgetAlertNotificationService.evaluateForTripAudience(trip);

        return toExpenseResponse(saved);
    }

    @Transactional
    public ExpenseResponse updateExpense(String userEmail, Long expenseId, CreateExpenseRequest request) {
        AppUser owner = findOwner(userEmail);

        Expense expense = expenseRepository.findByIdAndTripOwnerId(expenseId, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Expense was not found."));

        Trip originalTrip = expense.getTrip();
        Expense originalExpense = snapshotExpense(expense);
        Trip trip = tripRepository.findById(request.tripId())
                .orElseThrow(() -> new IllegalArgumentException("Trip was not found."));

        if (!trip.getOwner().getId().equals(owner.getId())) {
            throw new IllegalArgumentException("Trip was not found.");
        }

        expense.setTrip(trip);
        expense.setCategory(request.category());
        expense.setAmount(request.amount());
        expense.setDescription(request.description() == null ? null : request.description().trim());
        expense.setDate(request.date());

        Expense saved = expenseRepository.save(expense);

        if (originalTrip != null && originalTrip.getId() != null && originalTrip.getId().equals(trip.getId())) {
            budgetRealtimeWebSocketPublisher.publishExpenseUpdated(trip, owner, sharedTripParticipants(trip), saved);
        } else {
            if (originalTrip != null) {
                budgetRealtimeWebSocketPublisher.publishExpenseDeleted(
                        originalTrip,
                        owner,
                        sharedTripParticipants(originalTrip),
                        originalExpense
                );
            }

            budgetRealtimeWebSocketPublisher.publishExpenseCreated(trip, owner, sharedTripParticipants(trip), saved);
        }

        budgetAlertNotificationService.evaluateForTripAudience(trip);
        if (originalTrip != null && originalTrip.getId() != null && !originalTrip.getId().equals(trip.getId())) {
            budgetAlertNotificationService.evaluateForTripAudience(originalTrip);
        }

        return toExpenseResponse(saved);
    }

    @Transactional
    public void deleteExpense(String userEmail, Long expenseId) {
        AppUser owner = findOwner(userEmail);

        Expense expense = expenseRepository.findByIdAndTripOwnerId(expenseId, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Expense was not found."));

        Trip trip = expense.getTrip();
        budgetRealtimeWebSocketPublisher.publishExpenseDeleted(trip, owner, sharedTripParticipants(trip), expense);
        expenseRepository.delete(expense);
        expenseRepository.flush();
        budgetAlertNotificationService.evaluateForTripAudience(trip);
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

    private BigDecimal categorySpent(Map<ExpenseCategory, BigDecimal> spentByCategory, ExpenseCategory category) {
        return spentByCategory.getOrDefault(category, BigDecimal.ZERO);
    }

    /**
     * User Story #7 — full budget report for export (PDF/CSV).
     */
    @Transactional(readOnly = true)
    public BudgetReportResponse getReport(String userEmail) {
        BudgetSummaryResponse summary = getSummary(userEmail);
        List<CategoryBudgetResponse> categories = getCategoryBudgets(userEmail);
        List<TripBudgetRowResponse> trips = getTripBudgetRows(userEmail);

        return new BudgetReportResponse(
                summary.totalBudget(),
                summary.totalSpent(),
                summary.remainingBalance(),
                summary.usagePercentage(),
                categories,
                trips
        );
    }

    /**
     * User Story #2 — spending grouped by month or year for the line chart.
     */
    @Transactional(readOnly = true)
    public List<SpendingDataPointResponse> getSpendingOverTime(String userEmail, String view) {
        if (!"monthly".equalsIgnoreCase(view) && !"yearly".equalsIgnoreCase(view)) {
            throw new IllegalArgumentException("View must be either monthly or yearly.");
        }

        AppUser owner = findOwner(userEmail);

        List<Trip> trips = accessibleTrips(owner);
        List<Expense> expenses = accessibleExpenses(trips);
        List<SpendingEntry> spendingEntries = spendingEntries(trips, expenses);

        boolean isYearly = "yearly".equalsIgnoreCase(view);
        int currentYear = LocalDate.now(clock).getYear();

        if (isYearly) {
            TreeMap<Integer, BigDecimal> groupedByYear = new TreeMap<>();
            groupedByYear.put(currentYear - 1, BigDecimal.ZERO);
            groupedByYear.put(currentYear, BigDecimal.ZERO);
            groupedByYear.put(currentYear + 1, BigDecimal.ZERO);

            for (SpendingEntry spendingEntry : spendingEntries) {
                int spendingYear = spendingEntry.date().getYear();
                if (groupedByYear.containsKey(spendingYear)) {
                    groupedByYear.merge(spendingYear, spendingEntry.amount(), BigDecimal::add);
                }
            }

            return groupedByYear.entrySet().stream()
                    .map(entry -> new SpendingDataPointResponse(String.valueOf(entry.getKey()), entry.getValue()))
                    .toList();
        }

        DateTimeFormatter monthlyFormatter = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);
        TreeMap<YearMonth, BigDecimal> groupedByMonth = new TreeMap<>();
        for (Month month : Month.values()) {
            groupedByMonth.put(YearMonth.of(currentYear, month), BigDecimal.ZERO);
        }

        for (SpendingEntry spendingEntry : spendingEntries) {
            YearMonth spendingMonth = YearMonth.from(spendingEntry.date());
            if (groupedByMonth.containsKey(spendingMonth)) {
                groupedByMonth.merge(spendingMonth, spendingEntry.amount(), BigDecimal::add);
            }
        }

        return groupedByMonth.entrySet().stream()
                .map(entry -> new SpendingDataPointResponse(entry.getKey().format(monthlyFormatter), entry.getValue()))
                .toList();
    }

    /**
     * User Story #3 — spending split by category as percentages for the donut chart.
     */
    @Transactional(readOnly = true)
    public List<SpendingDistributionResponse> getSpendingDistribution(String userEmail) {
        AppUser owner = findOwner(userEmail);

        List<Trip> trips = accessibleTrips(owner);
        List<Expense> expenses = accessibleExpenses(trips);
        List<SpendingEntry> spendingEntries = spendingEntries(trips, expenses);

        BigDecimal totalSpent = totalSpent(spendingEntries);

        Map<ExpenseCategory, BigDecimal> spentByCategory = spendingEntries.stream()
                .collect(Collectors.groupingBy(
                        SpendingEntry::category,
                        Collectors.reducing(BigDecimal.ZERO, SpendingEntry::amount, BigDecimal::add)
                ));

        return TRACKED_CATEGORIES.stream()
                .map(category -> {
                    BigDecimal amount = spentByCategory.getOrDefault(category, BigDecimal.ZERO);
                    int percentage = totalSpent.signum() == 0
                            ? 0
                            : amount.multiply(BigDecimal.valueOf(100))
                                    .divide(totalSpent, 0, RoundingMode.HALF_UP)
                                    .intValue();
                    return new SpendingDistributionResponse(category, amount, percentage);
                })
                .toList();
    }

    /**
     * User Story #4 — spend vs. an equal per-category share of the total budget,
     * aggregated across all of the user's trips.
     */
    @Transactional(readOnly = true)
    public List<CategoryBudgetResponse> getCategoryBudgets(String userEmail) {
        AppUser owner = findOwner(userEmail);

        List<Trip> trips = accessibleTrips(owner);
        List<Expense> expenses = accessibleExpenses(trips);
        List<SpendingEntry> spendingEntries = spendingEntries(trips, expenses);

        BigDecimal totalBudget = trips.stream()
                .map(Trip::getBudget)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ExpenseCategory> categories = TRACKED_CATEGORIES;
        BigDecimal categoryBudget = categories.isEmpty()
                ? BigDecimal.ZERO
                : totalBudget.divide(BigDecimal.valueOf(categories.size()), 2, RoundingMode.HALF_UP);

        Map<ExpenseCategory, BigDecimal> savedBudgets = new HashMap<>();
        for (CategoryBudgetLimit limit : categoryBudgetLimitRepository.findAllByOwnerId(owner.getId())) {
            ExpenseCategory normalizedCategory = normalizeCategory(limit.getCategory());
            if (normalizedCategory == ExpenseCategory.OTHERS && limit.getCategory() == ExpenseCategory.TRANSPORT && savedBudgets.containsKey(ExpenseCategory.OTHERS)) {
                continue;
            }

            if (limit.getCategory() == ExpenseCategory.OTHERS || !savedBudgets.containsKey(normalizedCategory)) {
                savedBudgets.put(normalizedCategory, limit.getAmount());
            }
        }

        Map<ExpenseCategory, BigDecimal> spentByCategory = spendingEntries.stream()
                .collect(Collectors.groupingBy(
                        SpendingEntry::category,
                        Collectors.reducing(BigDecimal.ZERO, SpendingEntry::amount, BigDecimal::add)
                ));

        return categories.stream()
                .map(category -> toCategoryRow(
                        category,
                        spentByCategory.getOrDefault(category, BigDecimal.ZERO),
                        savedBudgets.getOrDefault(category, categoryBudget)
                ))
                .toList();
    }

    @Transactional
    public CategoryBudgetResponse updateCategoryBudget(String userEmail, ExpenseCategory category, UpdateCategoryBudgetRequest request) {
        AppUser owner = findOwner(userEmail);
        ExpenseCategory normalizedCategory = category;

        CategoryBudgetLimit limit = categoryBudgetLimitRepository.findByOwnerIdAndCategory(owner.getId(), normalizedCategory)
                .orElseGet(CategoryBudgetLimit::new);

        limit.setOwner(owner);
        limit.setCategory(normalizedCategory);
        limit.setAmount(request.budget());

        categoryBudgetLimitRepository.save(limit);

        return toCategoryRow(normalizedCategory, getCategorySpent(owner.getId(), normalizedCategory), request.budget());
    }

    private BigDecimal getCategorySpent(Long ownerId, ExpenseCategory category) {
        AppUser owner = appUserRepository.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("User was not found."));
        List<Trip> trips = accessibleTrips(owner);
        List<Expense> expenses = accessibleExpenses(trips);
        List<SpendingEntry> spendingEntries = spendingEntries(trips, expenses);

        ExpenseCategory normalized = normalizeCategory(category);

        return spendingEntries.stream()
                .filter(entry -> entry.category() == normalized)
                .map(SpendingEntry::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private ExpenseCategory normalizeCategory(ExpenseCategory category) {
        if (category == ExpenseCategory.TRANSPORT) {
            return ExpenseCategory.OTHERS;
        }

        return category;
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

    private TripBudgetRowResponse toRow(
            Trip trip,
            BigDecimal spent,
            Map<ExpenseCategory, BigDecimal> spentByCategory
    ) {
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
                status,
                categorySpent(spentByCategory, ExpenseCategory.FLIGHTS),
                categorySpent(spentByCategory, ExpenseCategory.HOTELS),
                categorySpent(spentByCategory, ExpenseCategory.FOOD),
                categorySpent(spentByCategory, ExpenseCategory.TRANSPORT),
                categorySpent(spentByCategory, ExpenseCategory.ACTIVITIES),
                categorySpent(spentByCategory, ExpenseCategory.OTHERS)
        );
    }

    private List<SpendingEntry> spendingEntries(List<Trip> trips, List<Expense> expenses) {
        List<SpendingEntry> entries = new ArrayList<>();

        for (Trip trip : trips) {
            addTripCost(entries, trip, ExpenseCategory.FLIGHTS, trip.getFlightTotal());
            addTripCost(entries, trip, ExpenseCategory.HOTELS, trip.getHotelTotal());
            addTripCost(entries, trip, ExpenseCategory.ACTIVITIES, trip.getActivitiesTotal());
        }

        for (Expense expense : expenses) {
            BigDecimal amount = positiveAmount(expense.getAmount());
            if (amount.signum() > 0) {
                entries.add(new SpendingEntry(
                        expense.getTrip().getId(),
                        normalizeCategory(expense.getCategory()),
                        amount,
                        expense.getDate()
                ));
            }
        }

        return entries;
    }

    private List<Trip> accessibleTrips(AppUser owner) {
        return tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(owner.getId());
    }

    private List<AppUser> sharedTripParticipants(Trip trip) {
        if (trip == null || trip.getId() == null) {
            return List.of();
        }

        Map<Long, AppUser> participants = new LinkedHashMap<>();
        for (TripInvitation invitation : tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(
                trip.getId(),
                TripInvitationStatus.ACCEPTED
        )) {
            AppUser invitedUser = invitation.getInvitedUser();
            if (invitedUser == null || invitedUser.getId() == null) {
                continue;
            }
            participants.putIfAbsent(invitedUser.getId(), invitedUser);
        }

        return new ArrayList<>(participants.values());
    }

    private List<Expense> accessibleExpenses(List<Trip> trips) {
        if (trips.isEmpty()) {
            return List.of();
        }

        List<Long> tripIds = trips.stream()
                .map(Trip::getId)
                .toList();

        return expenseRepository.findAllByTripIdInOrderByDateDesc(tripIds);
    }

    private void addTripCost(List<SpendingEntry> entries, Trip trip, ExpenseCategory category, BigDecimal amount) {
        BigDecimal cleanedAmount = positiveAmount(amount);
        if (cleanedAmount.signum() > 0) {
            entries.add(new SpendingEntry(
                    trip.getId(),
                    category,
                    cleanedAmount,
                    trip.getStartDate()
            ));
        }
    }

    private BigDecimal totalSpent(List<SpendingEntry> spendingEntries) {
        return spendingEntries.stream()
                .map(SpendingEntry::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal positiveAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            return BigDecimal.ZERO;
        }

        return amount;
    }

    private Expense snapshotExpense(Expense expense) {
        Expense snapshot = new Expense();
        snapshot.setTrip(expense.getTrip());
        snapshot.setCategory(expense.getCategory());
        snapshot.setAmount(expense.getAmount());
        snapshot.setDescription(expense.getDescription());
        snapshot.setDate(expense.getDate());
        return snapshot;
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
