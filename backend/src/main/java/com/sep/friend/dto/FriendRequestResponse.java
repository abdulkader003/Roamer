package com.sep.friend.dto;

import java.time.LocalDateTime;

public record FriendRequestResponse(
        Long id,
        FriendUserResponse sender,
        LocalDateTime createdAt
) {
}
