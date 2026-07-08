package com.sep.friend;

import com.sep.auth.dto.MessageResponse;
import com.sep.friend.dto.FriendRequestResponse;
import com.sep.friend.dto.FriendResponse;
import com.sep.friend.dto.FriendSearchResponse;
import com.sep.friend.dto.SendFriendRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "Friend Community", description = "Endpoints for searching users and managing friend requests.")
@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @Operation(summary = "Search users by username, email, or name")
    @GetMapping("/users")
    public List<FriendSearchResponse> searchUsers(
            Authentication authentication,
            @RequestParam(defaultValue = "") String query
    ) {
        return friendService.searchUsers(authenticatedEmail(authentication), query);
    }

    @Operation(summary = "Send a friend request")
    @PostMapping("/requests")
    public ResponseEntity<MessageResponse> sendFriendRequest(
            Authentication authentication,
            @Valid @RequestBody SendFriendRequest request
    ) {
        return ResponseEntity.ok(friendService.sendFriendRequest(authenticatedEmail(authentication), request));
    }

    @Operation(summary = "List incoming friend requests")
    @GetMapping("/requests/incoming")
    public List<FriendRequestResponse> listIncomingRequests(Authentication authentication) {
        return friendService.listIncomingRequests(authenticatedEmail(authentication));
    }

    @Operation(summary = "Accept a friend request")
    @PostMapping("/requests/{requestId}/accept")
    public ResponseEntity<MessageResponse> acceptFriendRequest(
            Authentication authentication,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(friendService.acceptFriendRequest(authenticatedEmail(authentication), requestId));
    }

    @Operation(summary = "Decline a friend request")
    @PostMapping("/requests/{requestId}/decline")
    public ResponseEntity<MessageResponse> declineFriendRequest(
            Authentication authentication,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(friendService.declineFriendRequest(authenticatedEmail(authentication), requestId));
    }

    @Operation(summary = "List accepted friends")
    @GetMapping
    public List<FriendResponse> listFriends(Authentication authentication) {
        return friendService.listFriends(authenticatedEmail(authentication));
    }

    @Operation(summary = "Delete an accepted friendship")
    @org.springframework.web.bind.annotation.DeleteMapping("/{friendId}")
    public ResponseEntity<MessageResponse> deleteFriend(
            Authentication authentication,
            @PathVariable Long friendId
    ) {
        return ResponseEntity.ok(
                friendService.deleteFriend(
                        authenticatedEmail(authentication),
                        friendId
                )
        );
    }

    private String authenticatedEmail(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new IllegalArgumentException("Authentication is required.");
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
}
