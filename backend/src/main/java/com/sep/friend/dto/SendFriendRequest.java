package com.sep.friend.dto;

import jakarta.validation.constraints.NotNull;

public record SendFriendRequest(
        @NotNull(message = "Choose a user to send a friend request.")
        Long receiverId
) {
}
