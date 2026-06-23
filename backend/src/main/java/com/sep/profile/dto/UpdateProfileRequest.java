package com.sep.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank(message = "Username is required.")
        @Size(min = 3, max = 40, message = "Username must be between 3 and 40 characters.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "Username may only contain letters, numbers, dots, underscores, and hyphens.")
        String username,

        @Size(max = 80, message = "First name must be 80 characters or less.")
        String firstName,

        @Size(max = 80, message = "Last name must be 80 characters or less.")
        String lastName,

        @Pattern(regexp = "^$|^[+0-9 ()-]{6,30}$", message = "Phone number format is invalid.")
        String phoneNumber,

        @Size(max = 30, message = "Passport number must be 30 characters or less.")
        @Pattern(regexp = "^[A-Za-z0-9 -]*$", message = "Passport number format is invalid.")
        String passportNumber,

        @Pattern(regexp = "^$|^[A-Za-z]{3}$", message = "Home airport must be a 3-letter airport code.")
        String homeAirport
) {
}
