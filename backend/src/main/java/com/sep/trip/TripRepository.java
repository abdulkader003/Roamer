package com.sep.trip;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * Persistence access for user-owned trips.
 */
public interface TripRepository extends JpaRepository<Trip, Long> {
    /**
     * Keeps the overview deterministic and prevents data from other users leaking
     * into the authenticated user's response.
     */
    List<Trip> findAllByOwnerIdOrderByStartDateAsc(Long ownerId);

    Optional<Trip> findByIdAndOwnerId(Long id, Long ownerId);

    @Query("""
            select trip
            from Trip trip
            where trip.owner.id = :userId
               or exists (
                    select invitation.id
                    from TripInvitation invitation
                    where invitation.trip.id = trip.id
                      and invitation.invitedUser.id = :userId
                      and invitation.status = com.sep.trip.TripInvitationStatus.ACCEPTED
               )
            order by trip.startDate asc
            """)
    List<Trip> findAllAccessibleByUserIdOrderByStartDateAsc(Long userId);

    @Query("""
            select trip
            from Trip trip
            where trip.id = :tripId
              and (
                    trip.owner.id = :userId
                 or exists (
                        select invitation.id
                        from TripInvitation invitation
                        where invitation.trip.id = trip.id
                          and invitation.invitedUser.id = :userId
                          and invitation.status = com.sep.trip.TripInvitationStatus.ACCEPTED
                 )
              )
            """)
    Optional<Trip> findAccessibleByIdAndUserId(Long tripId, Long userId);

    @Query("""
            select trip
            from Trip trip
            where trip.tripPlanningId = :tripPlanningId
              and (
                    trip.owner.id = :userId
                 or exists (
                        select invitation.id
                        from TripInvitation invitation
                        where invitation.trip.id = trip.id
                          and invitation.invitedUser.id = :userId
                          and invitation.status = com.sep.trip.TripInvitationStatus.ACCEPTED
                 )
              )
            """)
    Optional<Trip> findAccessibleByTripPlanningIdAndUserId(Long tripPlanningId, Long userId);

    void deleteAllByOwnerId(Long ownerId);
}
