package com.sep.profile.dto;

import java.time.LocalDateTime;

public record ProfileResponse(
        Long id,
        String email,
        String username,
        String firstName,
        String lastName,
        String phoneNumber,
        String homeAirport,
        boolean verified,
        boolean hasProfilePicture,
        LocalDateTime profilePictureUpdatedAt
) {
}
