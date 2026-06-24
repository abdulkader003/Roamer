package com.sep.budget;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Persistence access for user-defined category budgets.
 */
public interface CategoryBudgetLimitRepository extends JpaRepository<CategoryBudgetLimit, Long> {

    List<CategoryBudgetLimit> findAllByOwnerId(Long ownerId);

    Optional<CategoryBudgetLimit> findByOwnerIdAndCategory(Long ownerId, ExpenseCategory category);
}
