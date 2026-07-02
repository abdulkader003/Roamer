package com.sep.trip.dto;

import com.sep.friend.dto.FriendUserResponse;
import com.sep.trip.TripInvitationStatus;

import java.time.OffsetDateTime;

public record TripInvitationResponse(
        Long id,
        TripInvitationTripSummaryResponse trip,
        FriendUserResponse invitedBy,
        TripInvitationStatus status,
        OffsetDateTime createdAt
) {
}
