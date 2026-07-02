package com.sep.trip;

import com.sep.auth.dto.MessageResponse;
import com.sep.trip.dto.InviteTripFriendRequest;
import com.sep.trip.dto.TripInvitationResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trips")
public class TripInvitationController {

    private final TripInvitationService tripInvitationService;

    public TripInvitationController(TripInvitationService tripInvitationService) {
        this.tripInvitationService = tripInvitationService;
    }

    @PostMapping("/{tripId}/invitations")
    public ResponseEntity<TripInvitationResponse> inviteFriend(
            Authentication authentication,
            @PathVariable Long tripId,
            @Valid @RequestBody InviteTripFriendRequest request
    ) {
        return ResponseEntity.ok(tripInvitationService.inviteFriend(authentication.getName(), tripId, request));
    }

    @GetMapping("/invitations/incoming")
    public List<TripInvitationResponse> listIncomingInvitations(Authentication authentication) {
        return tripInvitationService.listIncomingInvitations(authentication.getName());
    }

    @PostMapping("/invitations/{invitationId}/accept")
    public ResponseEntity<MessageResponse> acceptInvitation(
            Authentication authentication,
            @PathVariable Long invitationId
    ) {
        return ResponseEntity.ok(tripInvitationService.acceptInvitation(authentication.getName(), invitationId));
    }

    @PostMapping("/invitations/{invitationId}/decline")
    public ResponseEntity<MessageResponse> declineInvitation(
            Authentication authentication,
            @PathVariable Long invitationId
    ) {
        return ResponseEntity.ok(tripInvitationService.declineInvitation(authentication.getName(), invitationId));
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
}
