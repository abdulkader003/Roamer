package com.sep.trip.dto;

import com.sep.friend.dto.FriendUserResponse;
import com.sep.trip.TripAccessRole;

public record TripParticipantResponse(
        FriendUserResponse user,
        TripAccessRole role
) {
}
