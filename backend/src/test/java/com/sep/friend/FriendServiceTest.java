package com.sep.friend;

import com.sep.auth.dto.MessageResponse;
import com.sep.friend.dto.FriendRequestResponse;
import com.sep.friend.dto.FriendResponse;
import com.sep.friend.dto.FriendSearchResponse;
import com.sep.friend.dto.FriendUserResponse;
import com.sep.friend.dto.SendFriendRequest;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FriendServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private FriendRequestRepository friendRequestRepository;

    private FriendService friendService;
    private AppUser currentUser;
    private AppUser otherUser;

    @BeforeEach
    void setUp() {
        friendService = new FriendService(userRepository, friendRequestRepository);

        currentUser = user();
        currentUser.setId(1L);
        currentUser.setEmail("traveler@example.com");
        currentUser.setUsername("traveler");

        otherUser = user();
        otherUser.setId(2L);
        otherUser.setEmail("friend@example.com");
        otherUser.setUsername("friend");
        otherUser.setFirstName("Ada");
        otherUser.setLastName("Lovelace");
    }

    @Test
    void searchUsersReturnsRelationshipStatesAndExcludesCurrentUser() {
        AppUser incoming = user();
        incoming.setId(3L);
        incoming.setEmail("incoming@example.com");
        incoming.setUsername("incoming");

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(userRepository.searchCommunityUsers(1L, "ada")).thenReturn(List.of(otherUser, incoming));
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(1L, 2L, FriendRequestStatus.ACCEPTED)).thenReturn(true);
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(1L, 3L, FriendRequestStatus.ACCEPTED)).thenReturn(false);
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(3L, 1L, FriendRequestStatus.ACCEPTED)).thenReturn(false);
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(1L, 3L, FriendRequestStatus.PENDING)).thenReturn(false);
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(3L, 1L, FriendRequestStatus.PENDING)).thenReturn(true);

        List<FriendSearchResponse> response = friendService.searchUsers("traveler@example.com", "ada");

        assertThat(response).hasSize(2);
        assertThat(response.get(0).relationshipStatus()).isEqualTo(FriendRelationshipStatus.FRIEND);
        assertThat(response.get(1).relationshipStatus()).isEqualTo(FriendRelationshipStatus.INCOMING_PENDING);
    }

    @Test
    void sendFriendRequestRejectsSelfRequestsAndDuplicateConnections() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(userRepository.findById(1L)).thenReturn(Optional.of(currentUser));

        assertThatThrownBy(() -> friendService.sendFriendRequest("traveler@example.com", new SendFriendRequest(1L)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("You cannot send a friend request to yourself.");

        verify(friendRequestRepository, never()).save(any(FriendRequest.class));
    }

    @Test
    void sendFriendRequestPersistsPendingRequestWhenNoConnectionExists() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(userRepository.findById(2L)).thenReturn(Optional.of(otherUser));
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(1L, 2L, FriendRequestStatus.ACCEPTED)).thenReturn(false);
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(2L, 1L, FriendRequestStatus.ACCEPTED)).thenReturn(false);
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(1L, 2L, FriendRequestStatus.PENDING)).thenReturn(false);
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(2L, 1L, FriendRequestStatus.PENDING)).thenReturn(false);

        MessageResponse response = friendService.sendFriendRequest("traveler@example.com", new SendFriendRequest(2L));

        assertThat(response.message()).isEqualTo("Friend request sent.");
        verify(friendRequestRepository).save(any(FriendRequest.class));
    }

    @Test
    void acceptFriendRequestOnlyAllowsTheReceiverToHandleIt() {
        FriendRequest request = new FriendRequest(otherUser, currentUser, FriendRequestStatus.PENDING);
        request.setId(15L);
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(friendRequestRepository.findByIdAndReceiverIdAndStatus(15L, 1L, FriendRequestStatus.PENDING)).thenReturn(Optional.of(request));
        when(friendRequestRepository.save(request)).thenReturn(request);

        MessageResponse response = friendService.acceptFriendRequest("traveler@example.com", 15L);

        assertThat(response.message()).isEqualTo("Friend request accepted.");
        assertThat(request.getStatus()).isEqualTo(FriendRequestStatus.ACCEPTED);
    }

    @Test
    void declineFriendRequestOnlyAllowsTheReceiverToHandleIt() {
        FriendRequest request = new FriendRequest(otherUser, currentUser, FriendRequestStatus.PENDING);
        request.setId(16L);
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(friendRequestRepository.findByIdAndReceiverIdAndStatus(16L, 1L, FriendRequestStatus.PENDING)).thenReturn(Optional.of(request));
        when(friendRequestRepository.save(request)).thenReturn(request);

        MessageResponse response = friendService.declineFriendRequest("traveler@example.com", 16L);

        assertThat(response.message()).isEqualTo("Friend request declined.");
        assertThat(request.getStatus()).isEqualTo(FriendRequestStatus.DECLINED);
    }

    @Test
    void listIncomingRequestsReturnsPendingRequestsSentToCurrentUser() {
        FriendRequest request = new FriendRequest(otherUser, currentUser, FriendRequestStatus.PENDING);
        request.setId(17L);
        request.setCreatedAt(LocalDateTime.parse("2026-07-01T10:15:30"));

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(friendRequestRepository.findByReceiverIdAndStatusOrderByCreatedAtDesc(1L, FriendRequestStatus.PENDING))
                .thenReturn(List.of(request));

        List<FriendRequestResponse> response = friendService.listIncomingRequests("traveler@example.com");

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().sender().username()).isEqualTo("friend");
    }

    @Test
    void listFriendsReturnsAcceptedConnections() {
        FriendRequest request = new FriendRequest(currentUser, otherUser, FriendRequestStatus.ACCEPTED);
        request.setId(18L);
        request.setCreatedAt(LocalDateTime.parse("2026-07-01T10:15:30"));

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(friendRequestRepository.findAcceptedConnectionsForUser(1L)).thenReturn(List.of(request));

        List<FriendResponse> response = friendService.listFriends("traveler@example.com");

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().user().username()).isEqualTo("friend");
    }

    @Test
    void deleteFriendRemovesAcceptedConnection() {
        FriendRequest request = new FriendRequest(currentUser, otherUser, FriendRequestStatus.ACCEPTED);
        request.setId(19L);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(friendRequestRepository.findAcceptedConnectionsBetweenUsers(1L, 2L)).thenReturn(List.of(request));

        MessageResponse response = friendService.deleteFriend("traveler@example.com", 2L);

        assertThat(response.message()).isEqualTo("Friend removed.");
        verify(friendRequestRepository).deleteAll(List.of(request));
    }

    @Test
    void deleteFriendRejectsNonFriends() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(friendRequestRepository.findAcceptedConnectionsBetweenUsers(1L, 19L)).thenReturn(List.of());

        assertThatThrownBy(() -> friendService.deleteFriend("traveler@example.com", 19L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> {
                    ResponseStatusException exception = (ResponseStatusException) error;
                    assertThat(exception.getStatusCode().value()).isEqualTo(404);
                    assertThat(exception.getReason()).isEqualTo("Friendship was not found.");
                });
    }

    @Test
    void deleteFriendRemovesAllDuplicateAcceptedConnections() {
        FriendRequest requestOne = new FriendRequest(currentUser, otherUser, FriendRequestStatus.ACCEPTED);
        requestOne.setId(19L);
        FriendRequest requestTwo = new FriendRequest(otherUser, currentUser, FriendRequestStatus.ACCEPTED);
        requestTwo.setId(20L);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(currentUser));
        when(friendRequestRepository.findAcceptedConnectionsBetweenUsers(1L, 2L)).thenReturn(List.of(requestOne, requestTwo));

        MessageResponse response = friendService.deleteFriend("traveler@example.com", 2L);

        assertThat(response.message()).isEqualTo("Friend removed.");
        verify(friendRequestRepository).deleteAll(List.of(requestOne, requestTwo));
    }

    private AppUser user() {
        AppUser user = new AppUser();
        user.setVerified(true);
        user.setProfilePictureUpdatedAt(LocalDateTime.parse("2026-06-30T12:00:00"));
        return user;
    }
}
