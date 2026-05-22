package com.sep.auth.dto;

import com.sep.user.VerificationPurpose;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AuthChallengeRequest {

    @Email
    @NotBlank
    private String email;

    @NotNull
    private VerificationPurpose flow;

    public String getEmail() {
        return email;
    }

    public VerificationPurpose getFlow() {
        return flow;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setFlow(VerificationPurpose flow) {
        this.flow = flow;
    }
}
