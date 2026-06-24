package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
import com.sep.budget.dto.BudgetReportResponse;
import com.sep.budget.dto.UpdateCategoryBudgetRequest;
import com.sep.budget.dto.CreateExpenseRequest;
import com.sep.budget.dto.ExpenseResponse;
import com.sep.budget.dto.SpendingDataPointResponse;
import com.sep.budget.dto.SpendingDistributionResponse;
import com.sep.budget.dto.CategoryBudgetResponse;
import com.sep.budget.dto.TripBudgetRowResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Authenticated API for the Budget Tracker page.
 *
 * <p>The JWT filter stores the account email in {@link Authentication#getName()},
 * so every query is scoped to the authenticated user's own trips.</p>
 */
@RestController
@RequestMapping("/api/budget")
public class BudgetController {

    private final BudgetService budgetService;

    public BudgetController(BudgetService budgetService) {
        this.budgetService = budgetService;
    }

    /**
     * User Story #1 — total budget, total spent, remaining balance, usage percentage.
     */
    @GetMapping("/summary")
    public BudgetSummaryResponse getSummary(Authentication authentication) {
        return budgetService.getSummary(authentication.getName());
    }

    /**
     * User Story #6 — one row per trip with spend, remaining balance, and status.
     */
    @GetMapping("/trips")
    public List<TripBudgetRowResponse> getTripBudgetRows(Authentication authentication) {
        return budgetService.getTripBudgetRows(authentication.getName());
    }

    /**
     * User Story #5 — list manual expenses for editing.
     */
    @GetMapping("/expenses")
    public List<ExpenseResponse> getExpenses(Authentication authentication) {
        return budgetService.getExpenses(authentication.getName());
    }

    /**
     * User Story #7 — full budget report for export.
     */
    @GetMapping("/report")
    public BudgetReportResponse getReport(Authentication authentication) {
        return budgetService.getReport(authentication.getName());
    }

    /**
     * User Story #2 — spending grouped by month or year for the line chart.
     */
    @GetMapping("/spending-over-time")
    public List<SpendingDataPointResponse> getSpendingOverTime(
            Authentication authentication,
            @RequestParam(defaultValue = "monthly") String view
    ) {
        return budgetService.getSpendingOverTime(authentication.getName(), view);
    }

    /**
     * User Story #3 — spending split by category as percentages for the donut chart.
     */
    @GetMapping("/distribution")
    public List<SpendingDistributionResponse> getSpendingDistribution(Authentication authentication) {
        return budgetService.getSpendingDistribution(authentication.getName());
    }

    /**
     * User Story #4 — spend vs. an equal per-category share of the budget.
     */
    @GetMapping("/categories")
    public List<CategoryBudgetResponse> getCategoryBudgets(Authentication authentication) {
        return budgetService.getCategoryBudgets(authentication.getName());
    }

    /**
     * User Story #4 — update a saved per-category budget.
     */
    @PutMapping("/categories/{category}")
    public CategoryBudgetResponse updateCategoryBudget(
            Authentication authentication,
            @PathVariable ExpenseCategory category,
            @Valid @RequestBody UpdateCategoryBudgetRequest request
    ) {
        return budgetService.updateCategoryBudget(authentication.getName(), category, request);
    }

    /**
     * User Story #5 — logs a new manual expense against one of the user's trips.
     */
    @PostMapping("/expenses")
    public ExpenseResponse createExpense(
            Authentication authentication,
            @Valid @RequestBody CreateExpenseRequest request
    ) {
        return budgetService.createExpense(authentication.getName(), request);
    }

    /**
     * User Story #5 — update an existing manual expense.
     */
    @PutMapping("/expenses/{expenseId}")
    public ExpenseResponse updateExpense(
            Authentication authentication,
            @PathVariable Long expenseId,
            @Valid @RequestBody CreateExpenseRequest request
    ) {
        return budgetService.updateExpense(authentication.getName(), expenseId, request);
    }

    /**
     * User Story #5 — delete an existing manual expense.
     */
    @DeleteMapping("/expenses/{expenseId}")
    public ResponseEntity<Void> deleteExpense(
            Authentication authentication,
            @PathVariable Long expenseId
    ) {
        budgetService.deleteExpense(authentication.getName(), expenseId);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }
}
