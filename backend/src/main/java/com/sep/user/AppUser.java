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

    @Column(length = 80)
    private String firstName;

    @Column(length = 80)
    private String lastName;

    @Column(length = 30)
    private String phoneNumber;

    @Column(name = "passport_number", length = 30)
    private String passportNumber;

    @Column(length = 20)
    private String homeAirport;

    @Column(name = "profile_picture")
    private byte[] profilePicture;

    @Column(length = 80)
    private String profilePictureContentType;

    private LocalDateTime profilePictureUpdatedAt;

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

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getPassportNumber() {
        return passportNumber;
    }

    public String getHomeAirport() {
        return homeAirport;
    }

    public byte[] getProfilePicture() {
        return profilePicture;
    }

    public String getProfilePictureContentType() {
        return profilePictureContentType;
    }

    public LocalDateTime getProfilePictureUpdatedAt() {
        return profilePictureUpdatedAt;
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

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public void setPassportNumber(String passportNumber) {
        this.passportNumber = passportNumber;
    }

    public void setHomeAirport(String homeAirport) {
        this.homeAirport = homeAirport;
    }

    public void setProfilePicture(byte[] profilePicture) {
        this.profilePicture = profilePicture;
    }

    public void setProfilePictureContentType(String profilePictureContentType) {
        this.profilePictureContentType = profilePictureContentType;
    }

    public void setProfilePictureUpdatedAt(LocalDateTime profilePictureUpdatedAt) {
        this.profilePictureUpdatedAt = profilePictureUpdatedAt;
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
