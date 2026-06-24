package com.sep.budget;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Persistence access for trip expenses.
 */
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findAllByTripIdOrderByDateDesc(Long tripId);

    List<Expense> findAllByTripOwnerIdOrderByDateDesc(Long ownerId);

    Optional<Expense> findByIdAndTripOwnerId(Long id, Long ownerId);
}
