package com.sep.friend.dto;

import java.time.LocalDateTime;

public record FriendResponse(
        Long id,
        FriendUserResponse user,
        LocalDateTime connectedAt
) {
}
