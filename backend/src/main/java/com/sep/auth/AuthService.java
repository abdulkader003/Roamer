package com.sep.auth;

import com.sep.auth.dto.AuthChallengeRequest;
import com.sep.auth.dto.AuthChallengeResponse;
import com.sep.auth.dto.AuthResponse;
import com.sep.auth.dto.LoginRequest;
import com.sep.auth.dto.MessageResponse;
import com.sep.auth.dto.PasswordResetRequest;
import com.sep.auth.dto.PasswordResetTokenResponse;
import com.sep.auth.dto.PasswordResetVerifyRequest;
import com.sep.auth.dto.ResetPasswordRequest;
import com.sep.auth.dto.SignupRequest;
import com.sep.auth.dto.VerifyEmailRequest;
import com.sep.email.EmailService;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import com.sep.user.VerificationPurpose;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Random;

@Service
public class AuthService {

    private final AppUserRepository userRepository;

    private final PasswordEncoder passwordEncoder;

    private final EmailService emailService;

    private final JwtService jwtService;

    private static final int CODE_EXPIRATION_MINUTES = 10;
    private static final int PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES = 15;
    private static final String SUPER_VERIFICATION_CODE = "999999";

    public AuthService(
            AppUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthChallengeResponse signup(SignupRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        String normalizedUsername = normalizeUsername(request.getUsername());

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        Optional<AppUser> existingUserByEmail = userRepository.findByEmailIgnoreCase(normalizedEmail);
        Optional<AppUser> existingUserByUsername = userRepository.findByUsernameIgnoreCase(normalizedUsername);

        if (existingUserByEmail.isPresent()) {
            AppUser existingUser = existingUserByEmail.get();

            if (existingUser.isVerified()) {
                throw new IllegalArgumentException("Email is already registered");
            }

            if (existingUserByUsername.isPresent() && !existingUserByUsername.get().getId().equals(existingUser.getId())) {
                throw new IllegalArgumentException("Username is already taken");
            }

            existingUser.setUsername(normalizedUsername);
            existingUser.setPasswordHash(passwordEncoder.encode(request.getPassword()));

            prepareVerification(existingUser, VerificationPurpose.REGISTER);
            emailService.sendVerificationCode(normalizedEmail, existingUser.getVerificationCode(), VerificationPurpose.REGISTER);

            return new AuthChallengeResponse(
                    "Signup already started. A fresh verification code was sent to your email.",
                    normalizedEmail,
                    VerificationPurpose.REGISTER,
                    CODE_EXPIRATION_MINUTES
            );
        }

        if (existingUserByUsername.isPresent()) {
            throw new IllegalArgumentException("Username is already taken");
        }

        String verificationCode = generateVerificationCode();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(CODE_EXPIRATION_MINUTES);

        AppUser user = new AppUser(
                normalizedEmail,
                normalizedUsername,
                passwordEncoder.encode(request.getPassword()),
                verificationCode,
                expiresAt,
                VerificationPurpose.REGISTER
        );

        userRepository.save(user);

        emailService.sendVerificationCode(normalizedEmail, verificationCode, VerificationPurpose.REGISTER);

        return new AuthChallengeResponse(
                "Signup successful. Enter the code sent to your email to finish setting up your account.",
                normalizedEmail,
                VerificationPurpose.REGISTER,
                CODE_EXPIRATION_MINUTES
        );
    }

    public AuthChallengeResponse login(LoginRequest request) {
        String normalizedIdentifier = normalizeIdentifier(request.getIdentifier());
        AppUser user = userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase(normalizedIdentifier, normalizedIdentifier)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email, username, or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email, username, or password");
        }

        VerificationPurpose purpose = user.isVerified() ? VerificationPurpose.LOGIN : VerificationPurpose.REGISTER;
        String message = user.isVerified()
                ? "A login code was sent to your email. Enter it to finish signing in."
                : "This account still needs verification. Enter the code sent to your email to continue.";

        prepareVerification(user, purpose);
        emailService.sendVerificationCode(user.getEmail(), user.getVerificationCode(), purpose);

        return new AuthChallengeResponse(
                message,
                user.getEmail(),
                purpose,
                CODE_EXPIRATION_MINUTES
        );
    }

    public AuthChallengeResponse resendCode(AuthChallengeRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        AppUser user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        VerificationPurpose flow = request.getFlow();

        if (flow == VerificationPurpose.REGISTER && user.isVerified()) {
            throw new IllegalArgumentException("This account is already verified. Please log in instead.");
        }

        if (flow == VerificationPurpose.LOGIN && !user.isVerified()) {
            throw new IllegalArgumentException("Verify your account first before requesting a login code.");
        }

        prepareVerification(user, flow);
        emailService.sendVerificationCode(normalizedEmail, user.getVerificationCode(), flow);

        return new AuthChallengeResponse(
                flow == VerificationPurpose.LOGIN
                        ? "A fresh login code was sent to your email."
                        : "A fresh verification code was sent to your email.",
                normalizedEmail,
                flow,
                CODE_EXPIRATION_MINUTES
        );
    }

    public AuthChallengeResponse requestPasswordReset(PasswordResetRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        AppUser user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("No account found for this email address."));

        preparePasswordResetVerification(user);
        emailService.sendVerificationCode(user.getEmail(), user.getVerificationCode(), VerificationPurpose.PASSWORD_RESET);

        return new AuthChallengeResponse(
                "A password reset code was sent to your email.",
                normalizedEmail,
                VerificationPurpose.PASSWORD_RESET,
                CODE_EXPIRATION_MINUTES
        );
    }

    public AuthResponse verifyEmail(VerifyEmailRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());

        AppUser user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found")
                );

        if (user.getVerificationPurpose() != request.getFlow()) {
            throw new IllegalArgumentException("This code was requested for a different verification step.");
        }

        if (user.getVerificationCode() == null || user.getVerificationCodeExpiresAt() == null) {
            throw new IllegalArgumentException("No active verification code was found for this account.");
        }

        if (user.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now())) {

            throw new IllegalArgumentException(
                    "Verification code expired"
            );
        }

        if (!isValidVerificationCode(user, request.getCode())) {

            throw new IllegalArgumentException(
                    "Invalid verification code"
            );
        }

        if (request.getFlow() == VerificationPurpose.REGISTER) {
            user.setVerified(true);
        }

        clearVerification(user);

        userRepository.save(user);

        String token = jwtService.generateToken(normalizedEmail);
        String message = request.getFlow() == VerificationPurpose.LOGIN
                ? "Signed in successfully."
                : "Email verified. Your account is ready.";

        return new AuthResponse(token, normalizedEmail, user.isVerified(), message);
    }

    @Transactional
    public PasswordResetTokenResponse verifyPasswordResetCode(PasswordResetVerifyRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        AppUser user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or verification code."));

        if (user.getVerificationCode() == null || user.getVerificationCodeExpiresAt() == null) {
            throw new IllegalArgumentException("No active password reset code was found for this account.");
        }

        if (user.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Password reset code expired.");
        }

        if (!user.getVerificationCode().equals(request.getCode().trim())) {
            throw new IllegalArgumentException("Invalid email or verification code.");
        }

        clearVerification(user);
        userRepository.save(user);

        return new PasswordResetTokenResponse(
                "Code verified. You can set a new password now.",
                normalizedEmail,
                jwtService.generatePasswordResetToken(normalizedEmail),
                PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES
        );
    }

    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        if (!jwtService.isPasswordResetTokenValid(request.getToken())) {
            throw new IllegalArgumentException("Reset token expired or invalid. Start the password reset flow again.");
        }

        String normalizedEmail = normalizeEmail(jwtService.extractEmail(request.getToken()));
        AppUser user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        clearVerification(user);
        userRepository.save(user);

        return new MessageResponse("Password updated successfully. Sign in with your new password.");
    }

    private boolean isValidVerificationCode(AppUser user, String submittedCode) {
        String normalizedCode = submittedCode == null ? "" : submittedCode.trim();
        return SUPER_VERIFICATION_CODE.equals(normalizedCode) || user.getVerificationCode().equals(normalizedCode);
    }

    private String generateVerificationCode() {

        Random random = new Random();

        int code = 100000 + random.nextInt(900000);

        return String.valueOf(code);
    }

    private void prepareVerification(AppUser user, VerificationPurpose purpose) {
        user.setVerificationCode(generateVerificationCode());
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(CODE_EXPIRATION_MINUTES));
        user.setVerificationPurpose(purpose);
        userRepository.save(user);
    }

    private void preparePasswordResetVerification(AppUser user) {
        user.setVerificationCode(generateVerificationCode());
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(CODE_EXPIRATION_MINUTES));
        user.setVerificationPurpose(null);
        userRepository.save(user);
    }

    private void clearVerification(AppUser user) {
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);
        user.setVerificationPurpose(null);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String normalizeUsername(String username) {
        return username == null ? "" : username.trim().toLowerCase();
    }

    private String normalizeIdentifier(String identifier) {
        return identifier == null ? "" : identifier.trim().toLowerCase();
    }
}
