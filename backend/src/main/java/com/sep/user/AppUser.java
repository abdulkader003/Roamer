package com.sep.user;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(unique = true)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private boolean verified = false;

    private String verificationCode;

    private LocalDateTime verificationCodeExpiresAt;

    @Enumerated(EnumType.STRING)
    private VerificationPurpose verificationPurpose;

    public AppUser() {
    }

    public AppUser(
            String email,
            String username,
            String passwordHash,
            String verificationCode,
            LocalDateTime verificationCodeExpiresAt,
            VerificationPurpose verificationPurpose
    ) {
        this.email = email;
        this.username = username;
        this.passwordHash = passwordHash;
        this.verificationCode = verificationCode;
        this.verificationCodeExpiresAt = verificationCodeExpiresAt;
        this.verificationPurpose = verificationPurpose;
        this.verified = false;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getUsername() {
        return username;
    }

    public boolean isVerified() {
        return verified;
    }

    public String getVerificationCode() {
        return verificationCode;
    }

    public LocalDateTime getVerificationCodeExpiresAt() {
        return verificationCodeExpiresAt;
    }

    public VerificationPurpose getVerificationPurpose() {
        return verificationPurpose;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public void setVerificationCode(String verificationCode) {
        this.verificationCode = verificationCode;
    }

    public void setVerificationCodeExpiresAt(LocalDateTime verificationCodeExpiresAt) {
        this.verificationCodeExpiresAt = verificationCodeExpiresAt;
    }

    public void setVerificationPurpose(VerificationPurpose verificationPurpose) {
        this.verificationPurpose = verificationPurpose;
    }
}
