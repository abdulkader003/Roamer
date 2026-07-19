package com.sep.trip;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface TripReminderNotificationRepository extends JpaRepository<TripReminderNotification, Long> {
    boolean existsByTripIdAndRecipientIdAndReminderDate(Long tripId, Long recipientId, LocalDate reminderDate);

    List<TripReminderNotification> findTop20ByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    @Modifying
    @Query("delete from TripReminderNotification reminder where reminder.trip.id = :tripId")
    void deleteAllByTripId(Long tripId);

    @Modifying
    @Query("delete from TripReminderNotification reminder where reminder.trip.id = :tripId and reminder.reminderDate <> :reminderDate")
    void deleteAllByTripIdAndReminderDateNot(Long tripId, LocalDate reminderDate);

    @Modifying
    @Query("delete from TripReminderNotification reminder where reminder.recipient.id = :recipientId")
    void deleteAllByRecipientId(Long recipientId);

    @Modifying
    @Query("delete from TripReminderNotification reminder where reminder.trip.owner.id = :ownerId")
    void deleteAllByTripOwnerId(Long ownerId);
}
