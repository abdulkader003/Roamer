package com.sep.auth.dto;

public record AuthResponse(
        String token,
        String email,
        boolean verified,
        String message
) {
}
