package com.sep.friend.dto;

import com.sep.friend.FriendRelationshipStatus;

public record FriendSearchResponse(
        FriendUserResponse user,
        FriendRelationshipStatus relationshipStatus
) {
}
