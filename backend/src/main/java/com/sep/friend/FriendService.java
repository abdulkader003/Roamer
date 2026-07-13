package com.sep.friend;

import com.sep.auth.dto.MessageResponse;
import com.sep.friend.dto.FriendRequestResponse;
import com.sep.friend.dto.FriendResponse;
import com.sep.friend.dto.FriendSearchResponse;
import com.sep.friend.dto.FriendUserResponse;
import com.sep.friend.dto.SendFriendRequest;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class FriendService {

    private final AppUserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final FriendNotificationWebSocketPublisher friendNotificationWebSocketPublisher;

    public FriendService(
            AppUserRepository userRepository,
            FriendRequestRepository friendRequestRepository,
            FriendNotificationWebSocketPublisher friendNotificationWebSocketPublisher
    ) {
        this.userRepository = userRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.friendNotificationWebSocketPublisher = friendNotificationWebSocketPublisher;
    }

    @Transactional(readOnly = true)
    public List<FriendSearchResponse> searchUsers(String authenticatedEmail, String query) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        String normalizedQuery = normalizeQuery(query);

        if (!StringUtils.hasText(normalizedQuery)) {
            return List.of();
        }

        return userRepository.searchCommunityUsers(currentUser.getId(), normalizedQuery)
                .stream()
                .map(user -> new FriendSearchResponse(toFriendUserResponse(user), relationshipStatus(currentUser.getId(), user.getId())))
                .toList();
    }

    @Transactional
    public MessageResponse sendFriendRequest(String authenticatedEmail, SendFriendRequest request) {
        AppUser sender = findCurrentUser(authenticatedEmail);
        AppUser receiver = userRepository.findById(request.receiverId())
                .orElseThrow(() -> new IllegalArgumentException("User was not found."));

        validateSendRequest(sender, receiver);

        FriendRequest friendRequest = friendRequestRepository.save(new FriendRequest(sender, receiver, FriendRequestStatus.PENDING));
        friendNotificationWebSocketPublisher.publishFriendRequestCreated(friendRequest);
        return new MessageResponse("Friend request sent.");
    }

    @Transactional(readOnly = true)
    public List<FriendRequestResponse> listIncomingRequests(String authenticatedEmail) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        return friendRequestRepository.findByReceiverIdAndStatusOrderByCreatedAtDesc(currentUser.getId(), FriendRequestStatus.PENDING)
                .stream()
                .map(this::toFriendRequestResponse)
                .toList();
    }

    @Transactional
    public MessageResponse acceptFriendRequest(String authenticatedEmail, Long requestId) {
        FriendRequest friendRequest = findPendingRequestForReceiver(authenticatedEmail, requestId);
        friendRequest.setStatus(FriendRequestStatus.ACCEPTED);
        FriendRequest savedRequest = friendRequestRepository.save(friendRequest);
        friendNotificationWebSocketPublisher.publishFriendRequestAccepted(savedRequest);
        return new MessageResponse("Friend request accepted.");
    }

    @Transactional
    public MessageResponse declineFriendRequest(String authenticatedEmail, Long requestId) {
        FriendRequest friendRequest = findPendingRequestForReceiver(authenticatedEmail, requestId);
        friendRequest.setStatus(FriendRequestStatus.DECLINED);
        FriendRequest savedRequest = friendRequestRepository.save(friendRequest);
        friendNotificationWebSocketPublisher.publishFriendRequestDeclined(savedRequest);
        return new MessageResponse("Friend request declined.");
    }

    @Transactional
    public MessageResponse deleteFriend(String authenticatedEmail, Long friendUserId) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        if (currentUser.getId().equals(friendUserId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Friendship was not found.");
        }

        List<FriendRequest> connections = friendRequestRepository.findAcceptedConnectionsBetweenUsers(currentUser.getId(), friendUserId);

        if (connections.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Friendship was not found.");
        }

        friendRequestRepository.deleteAll(connections);
        return new MessageResponse("Friend removed.");
    }

    @Transactional(readOnly = true)
    public List<FriendResponse> listFriends(String authenticatedEmail) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        Map<Long, FriendResponse> friendsById = new LinkedHashMap<>();

        for (FriendRequest request : friendRequestRepository.findAcceptedConnectionsForUser(currentUser.getId())) {
            AppUser friend = request.getSender().getId().equals(currentUser.getId())
                    ? request.getReceiver()
                    : request.getSender();

            friendsById.putIfAbsent(friend.getId(), new FriendResponse(
                    request.getId(),
                    toFriendUserResponse(friend),
                    request.getCreatedAt()
            ));
        }

        return new ArrayList<>(friendsById.values());
    }

    private FriendRequest findPendingRequestForReceiver(String authenticatedEmail, Long requestId) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        FriendRequest friendRequest = friendRequestRepository.findByIdAndReceiverIdAndStatus(requestId, currentUser.getId(), FriendRequestStatus.PENDING)
                .orElseThrow(() -> new IllegalArgumentException("Friend request was not found."));

        if (friendRequest.getReceiver().getId() == null || !friendRequest.getReceiver().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Friend request was not found.");
        }

        return friendRequest;
    }

    private void validateSendRequest(AppUser sender, AppUser receiver) {
        if (sender.getId().equals(receiver.getId())) {
            throw new IllegalArgumentException("You cannot send a friend request to yourself.");
        }

        if (isAcceptedBetween(sender.getId(), receiver.getId())) {
            throw new IllegalArgumentException("You are already friends with this user.");
        }

        if (isPendingBetween(sender.getId(), receiver.getId())) {
            throw new IllegalArgumentException("A pending friend request already exists between these users.");
        }
    }

    private boolean isAcceptedBetween(Long firstUserId, Long secondUserId) {
        return friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.ACCEPTED);
    }

    private boolean isPendingBetween(Long firstUserId, Long secondUserId) {
        return friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.PENDING)
                || friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.PENDING);
    }

    private FriendRelationshipStatus relationshipStatus(Long currentUserId, Long otherUserId) {
        if (isAcceptedBetween(currentUserId, otherUserId)) {
            return FriendRelationshipStatus.FRIEND;
        }

        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(currentUserId, otherUserId, FriendRequestStatus.PENDING)) {
            return FriendRelationshipStatus.OUTGOING_PENDING;
        }

        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(otherUserId, currentUserId, FriendRequestStatus.PENDING)) {
            return FriendRelationshipStatus.INCOMING_PENDING;
        }

        return FriendRelationshipStatus.NONE;
    }

    private FriendRequestResponse toFriendRequestResponse(FriendRequest request) {
        return new FriendRequestResponse(
                request.getId(),
                toFriendUserResponse(request.getSender()),
                request.getCreatedAt()
        );
    }

    private FriendUserResponse toFriendUserResponse(AppUser user) {
        return new FriendUserResponse(
                user.getId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.isVerified(),
                user.getProfilePictureUpdatedAt()
        );
    }

    private AppUser findCurrentUser(String authenticatedEmail) {
        return userRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));
    }

    private String normalizeQuery(String query) {
        return query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
    }
}
