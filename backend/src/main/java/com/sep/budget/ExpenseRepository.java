package com.sep.budget;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

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

    @Modifying
    @Query("delete from Expense expense where expense.trip.id = :tripId")
    void deleteAllByTripId(Long tripId);

    void deleteAllByTripIdIn(List<Long> tripIds);
}
