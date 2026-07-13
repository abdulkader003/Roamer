package com.sep.settings;

import com.sep.settings.dto.FeedbackRequest;
import com.sep.settings.dto.FeedbackResponse;
import com.sep.settings.dto.SettingsPreferencesResponse;
import com.sep.settings.dto.UpdateSettingsRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping("/api/settings")
    public ResponseEntity<SettingsPreferencesResponse> getSettings(Authentication authentication) {
        return ResponseEntity.ok(settingsService.getSettings(authenticatedEmail(authentication)));
    }

    @PutMapping("/api/settings")
    public ResponseEntity<SettingsPreferencesResponse> updateSettings(
            Authentication authentication,
            @Valid @RequestBody UpdateSettingsRequest request
    ) {
        return ResponseEntity.ok(settingsService.updateSettings(authenticatedEmail(authentication), request));
    }

    @PostMapping("/api/feedback")
    public ResponseEntity<FeedbackResponse> submitFeedback(
            Authentication authentication,
            @Valid @RequestBody FeedbackRequest request
    ) {
        return ResponseEntity.ok(settingsService.submitFeedback(authenticatedEmail(authentication), request));
    }

    private String authenticatedEmail(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }

        return authentication.getName();
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

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException exception) {
        String message = exception.getReason() != null ? exception.getReason() : "Request failed.";
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message", message));
    }
}
