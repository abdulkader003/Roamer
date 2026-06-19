package com.sep.profile;

import com.sep.auth.dto.MessageResponse;
import com.sep.profile.ProfileService.ProfilePictureData;
import com.sep.profile.dto.ChangePasswordRequest;
import com.sep.profile.dto.DeleteAccountRequest;
import com.sep.profile.dto.ProfileResponse;
import com.sep.profile.dto.UpdateProfileRequest;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ProfileController.class);

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile(Authentication authentication) {
        return ResponseEntity.ok(profileService.getProfile(authenticatedEmail(authentication)));
    }

    @PutMapping
    public ResponseEntity<ProfileResponse> updateProfile(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(profileService.updateProfile(authenticatedEmail(authentication), request));
    }

    @PostMapping(value = "/picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProfileResponse> uploadProfilePicture(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(profileService.uploadProfilePicture(authenticatedEmail(authentication), file));
    }

    @GetMapping("/picture")
    public ResponseEntity<byte[]> getProfilePicture(Authentication authentication) {
        return profileService.getProfilePicture(authenticatedEmail(authentication))
                .map(this::toPictureResponse)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/picture")
    public ResponseEntity<ProfileResponse> deleteProfilePicture(Authentication authentication) {
        return ResponseEntity.ok(profileService.deleteProfilePicture(authenticatedEmail(authentication)));
    }

    @PutMapping("/password")
    public ResponseEntity<MessageResponse> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        profileService.changePassword(authenticatedEmail(authentication), request);
        return ResponseEntity.ok(new MessageResponse("Password changed successfully."));
    }

    @DeleteMapping
    public ResponseEntity<MessageResponse> deleteCurrentAccount(
            Authentication authentication,
            @Valid @RequestBody DeleteAccountRequest request
    ) {
        return deleteAccount(authentication, request);
    }

    @PostMapping("/delete-account")
    public ResponseEntity<MessageResponse> deleteCurrentAccountSafely(
            Authentication authentication,
            @Valid @RequestBody DeleteAccountRequest request
    ) {
        return deleteAccount(authentication, request);
    }

    private ResponseEntity<MessageResponse> deleteAccount(Authentication authentication, DeleteAccountRequest request) {
        profileService.deleteCurrentAccount(authenticatedEmail(authentication), request);
        return ResponseEntity.ok(new MessageResponse("Account deleted successfully."));
    }

    private ResponseEntity<byte[]> toPictureResponse(ProfilePictureData picture) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(picture.contentType()))
                .contentLength(picture.bytes().length)
                .cacheControl(CacheControl.noStore())
                .body(picture.bytes());
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

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException exception) {
        LOGGER.warn("Profile account deletion failed because related data still exists.", exception);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "message",
                "Your account could not be deleted because related account data still exists."
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpectedException(Exception exception) {
        LOGGER.error("Unexpected profile request failure.", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "message",
                "Could not delete your account right now. Please try again."
        ));
    }
}
