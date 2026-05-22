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

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthChallengeResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthChallengeResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request));
    }

    @PostMapping("/resend-code")
    public ResponseEntity<AuthChallengeResponse> resendCode(@Valid @RequestBody AuthChallengeRequest request) {
        return ResponseEntity.ok(authService.resendCode(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<AuthChallengeResponse> requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        return ResponseEntity.ok(authService.requestPasswordReset(request));
    }

    @PostMapping("/forgot-password/verify")
    public ResponseEntity<PasswordResetTokenResponse> verifyPasswordResetCode(@Valid @RequestBody PasswordResetVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyPasswordResetCode(request));
    }

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
