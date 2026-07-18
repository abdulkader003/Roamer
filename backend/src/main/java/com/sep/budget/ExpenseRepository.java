package com.sep.budget;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Persistence access for trip expenses.
 */
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findAllByTripIdOrderByDateDesc(Long tripId);

    List<Expense> findAllByTripOwnerIdOrderByDateDesc(Long ownerId);

    List<Expense> findAllByTripIdInOrderByDateDesc(Collection<Long> tripIds);

    Optional<Expense> findByIdAndTripOwnerId(Long id, Long ownerId);

    void deleteAllByTripId(Long tripId);
}
