package com.sep.auth.dto;

import com.sep.user.VerificationPurpose;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class VerifyEmailRequest {

    @Email
    @NotBlank
    private String email;

    @NotBlank
    private String code;

    @NotNull
    private VerificationPurpose flow;

    public String getEmail() {
        return email;
    }

    public String getCode() {
        return code;
    }

    public VerificationPurpose getFlow() {
        return flow;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public void setFlow(VerificationPurpose flow) {
        this.flow = flow;
    }
}
