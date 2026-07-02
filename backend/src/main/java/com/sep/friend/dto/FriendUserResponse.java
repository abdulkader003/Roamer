package com.sep.friend.dto;

import java.time.LocalDateTime;

public record FriendUserResponse(
        Long id,
        String username,
        String firstName,
        String lastName,
        String email,
        boolean verified,
        LocalDateTime profilePictureUpdatedAt
) {
}
