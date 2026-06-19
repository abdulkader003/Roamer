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
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.Map;

/**
 * Public authentication API for registration, login challenges, email
 * verification, and password reset flows.
 */
@Tag(name = "Authentication", description = "Endpoints for signup, login, verification, and password reset.")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Register a new user")
    @PostMapping("/signup")
    public ResponseEntity<AuthChallengeResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    @Operation(summary = "Log in a user")
    @PostMapping("/login")
    public ResponseEntity<AuthChallengeResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Operation(summary = "Verify email or login code")
    @PostMapping("/verify-email")
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request));
    }

    @Operation(summary = "Resend verification code")
    @PostMapping("/resend-code")
    public ResponseEntity<AuthChallengeResponse> resendCode(@Valid @RequestBody AuthChallengeRequest request) {
        return ResponseEntity.ok(authService.resendCode(request));
    }

    @Operation(summary = "Request password reset")
    @PostMapping("/forgot-password")
    public ResponseEntity<AuthChallengeResponse> requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        return ResponseEntity.ok(authService.requestPasswordReset(request));
    }

    @Operation(summary = "Verify password reset code")
    @PostMapping("/forgot-password/verify")
    public ResponseEntity<PasswordResetTokenResponse> verifyPasswordResetCode(@Valid @RequestBody PasswordResetVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyPasswordResetCode(request));
    }

    @Operation(summary = "Reset password")
    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");

        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    /**
     * Converts unique-constraint failures into a client-safe duplicate account message.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException exception) {
        String details = exception.getMostSpecificCause() != null
                ? exception.getMostSpecificCause().getMessage()
                : exception.getMessage();

        if (details != null) {
            String normalized = details.toLowerCase();
            if (normalized.contains("email") || normalized.contains("username")) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message",
                        "This email or username is already in use."
                ));
            }
        }

        return ResponseEntity.badRequest().body(Map.of(
                "message",
                "Unable to save your request right now. Please try again."
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception exception) {
        return ResponseEntity.internalServerError().body(Map.of(
                "message",
                "Unexpected server error. Check the backend logs for details."
        ));
    }
}
