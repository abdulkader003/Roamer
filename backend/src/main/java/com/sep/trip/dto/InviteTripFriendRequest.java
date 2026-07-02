package com.sep.trip.dto;

import jakarta.validation.constraints.NotNull;

public record InviteTripFriendRequest(
        @NotNull(message = "Friend is required")
        Long invitedUserId
) {
}
