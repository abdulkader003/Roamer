package com.sep.budget;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface BudgetAlertNotificationRepository extends JpaRepository<BudgetAlertNotification, Long> {

    Optional<BudgetAlertNotification> findByRecipientIdAndAlertKey(Long recipientId, String alertKey);

    List<BudgetAlertNotification> findAllByRecipientIdAndActiveTrueOrderByUpdatedAtDesc(Long recipientId);

    @Modifying
    @Query("delete from BudgetAlertNotification alert where alert.recipient.id = :recipientId")
    void deleteAllByRecipientId(Long recipientId);
}
