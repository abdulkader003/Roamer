package com.sep.trip;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripUpdateNotificationRepository extends JpaRepository<TripUpdateNotification, Long> {

    List<TripUpdateNotification> findTop20ByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    void deleteAllByTripId(Long tripId);

    void deleteAllByRecipientId(Long recipientId);

    void deleteAllByTripOwnerId(Long ownerId);
}
