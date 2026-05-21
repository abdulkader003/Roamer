package com.sep.auth.dto;

public record PasswordResetTokenResponse(
        String message,
        String email,
        String resetToken,
        int expiresInMinutes
) {
}
