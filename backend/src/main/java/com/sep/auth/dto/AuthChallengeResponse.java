package com.sep.auth.dto;

import com.sep.user.VerificationPurpose;

public record AuthChallengeResponse(
        String message,
        String email,
        VerificationPurpose flow,
        int expiresInMinutes
) {
}
