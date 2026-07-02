package com.sep.trip;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TripInvitationRepository extends JpaRepository<TripInvitation, Long> {

    List<TripInvitation> findAllByInvitedUserIdAndStatusOrderByCreatedAtDesc(Long invitedUserId, TripInvitationStatus status);

    List<TripInvitation> findAllByInvitedByIdOrderByCreatedAtDesc(Long invitedById);

    Optional<TripInvitation> findByIdAndInvitedUserIdAndStatus(Long id, Long invitedUserId, TripInvitationStatus status);

    Optional<TripInvitation> findByIdAndInvitedByIdAndStatus(Long id, Long invitedById, TripInvitationStatus status);

    boolean existsByTripIdAndInvitedUserIdAndStatus(Long tripId, Long invitedUserId, TripInvitationStatus status);

    List<TripInvitation> findAllByTripIdAndInvitedUserIdAndStatusIn(Long tripId, Long invitedUserId, List<TripInvitationStatus> statuses);

    List<TripInvitation> findAllByTripIdAndStatusOrderByCreatedAtDesc(Long tripId, TripInvitationStatus status);

    void deleteAllByTripIdAndInvitedUserIdAndStatus(Long tripId, Long invitedUserId, TripInvitationStatus status);

    void deleteAllByTripId(Long tripId);
}
