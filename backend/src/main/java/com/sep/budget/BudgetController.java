package com.sep.budget;

import com.sep.budget.dto.BudgetSummaryResponse;
import com.sep.budget.dto.CategoryBudgetResponse;
import com.sep.budget.dto.CreateExpenseRequest;
import com.sep.budget.dto.ExpenseResponse;
import com.sep.budget.dto.TripBudgetRowResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
     * User Story #4 — spend vs. an equal per-category share of the budget.
     */
    @GetMapping("/categories")
    public List<CategoryBudgetResponse> getCategoryBudgets(Authentication authentication) {
        return budgetService.getCategoryBudgets(authentication.getName());
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
