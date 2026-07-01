package com.sep.friend;

import com.sep.auth.dto.MessageResponse;
import com.sep.friend.dto.FriendRequestResponse;
import com.sep.friend.dto.FriendResponse;
import com.sep.friend.dto.FriendSearchResponse;
import com.sep.friend.dto.FriendUserResponse;
import com.sep.friend.dto.SendFriendRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FriendControllerTest {

    @Mock
    private FriendService friendService;

    @Mock
    private Authentication authentication;

    private FriendController controller;

    @BeforeEach
    void setUp() {
        controller = new FriendController(friendService);
    }

    @Test
    void searchUsersUsesAuthenticatedEmail() {
        FriendSearchResponse responseItem = new FriendSearchResponse(
                new FriendUserResponse(2L, "friend", "Ada", "Lovelace", "friend@example.com", true, null),
                FriendRelationshipStatus.NONE
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(friendService.searchUsers("traveler@example.com", "ada")).thenReturn(List.of(responseItem));

        List<FriendSearchResponse> response = controller.searchUsers(authentication, "ada");

        assertThat(response).containsExactly(responseItem);
        verify(friendService).searchUsers("traveler@example.com", "ada");
    }

    @Test
    void sendFriendRequestReturnsMessage() {
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(friendService.sendFriendRequest("traveler@example.com", new SendFriendRequest(2L)))
                .thenReturn(new MessageResponse("Friend request sent."));

        ResponseEntity<MessageResponse> response = controller.sendFriendRequest(authentication, new SendFriendRequest(2L));

        assertThat(response.getBody()).isEqualTo(new MessageResponse("Friend request sent."));
        verify(friendService).sendFriendRequest("traveler@example.com", new SendFriendRequest(2L));
    }

    @Test
    void listIncomingRequestsUsesAuthenticatedEmail() {
        FriendRequestResponse request = new FriendRequestResponse(
                10L,
                new FriendUserResponse(2L, "friend", "Ada", "Lovelace", "friend@example.com", true, null),
                LocalDateTime.parse("2026-07-01T10:15:30")
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(friendService.listIncomingRequests("traveler@example.com")).thenReturn(List.of(request));

        List<FriendRequestResponse> response = controller.listIncomingRequests(authentication);

        assertThat(response).containsExactly(request);
        verify(friendService).listIncomingRequests("traveler@example.com");
    }

    @Test
    void acceptFriendRequestUsesAuthenticatedEmailAndRequestId() {
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(friendService.acceptFriendRequest("traveler@example.com", 10L))
                .thenReturn(new MessageResponse("Friend request accepted."));

        ResponseEntity<MessageResponse> response = controller.acceptFriendRequest(authentication, 10L);

        assertThat(response.getBody()).isEqualTo(new MessageResponse("Friend request accepted."));
        verify(friendService).acceptFriendRequest("traveler@example.com", 10L);
    }

    @Test
    void listFriendsUsesAuthenticatedEmail() {
        FriendResponse friend = new FriendResponse(
                10L,
                new FriendUserResponse(2L, "friend", "Ada", "Lovelace", "friend@example.com", true, null),
                LocalDateTime.parse("2026-07-01T10:15:30")
        );
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(friendService.listFriends("traveler@example.com")).thenReturn(List.of(friend));

        List<FriendResponse> response = controller.listFriends(authentication);

        assertThat(response).containsExactly(friend);
        verify(friendService).listFriends("traveler@example.com");
    }

    @Test
    void deleteFriendUsesAuthenticatedEmailAndFriendId() {
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(friendService.deleteFriend("traveler@example.com", 2L))
                .thenReturn(new MessageResponse("Friend removed."));

        ResponseEntity<MessageResponse> response = controller.deleteFriend(authentication, 2L);

        assertThat(response.getBody()).isEqualTo(new MessageResponse("Friend removed."));
        verify(friendService).deleteFriend("traveler@example.com", 2L);
    }
}
