package com.sep.trip;

import com.sep.auth.dto.MessageResponse;
import com.sep.friend.FriendRequestRepository;
import com.sep.friend.FriendRequestStatus;
import com.sep.friend.dto.FriendUserResponse;
import com.sep.trip.dto.InviteTripFriendRequest;
import com.sep.trip.dto.TripInvitationResponse;
import com.sep.trip.dto.TripInvitationTripSummaryResponse;
import com.sep.trip.dto.TripParticipantResponse;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class TripInvitationService {

    private final TripRepository tripRepository;
    private final TripInvitationRepository tripInvitationRepository;
    private final AppUserRepository appUserRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final TripNotificationWebSocketPublisher tripNotificationWebSocketPublisher;
    private final TripRealtimeWebSocketPublisher tripRealtimeWebSocketPublisher;

    public TripInvitationService(
            TripRepository tripRepository,
            TripInvitationRepository tripInvitationRepository,
            AppUserRepository appUserRepository,
            FriendRequestRepository friendRequestRepository,
            TripNotificationWebSocketPublisher tripNotificationWebSocketPublisher,
            TripRealtimeWebSocketPublisher tripRealtimeWebSocketPublisher
    ) {
        this.tripRepository = tripRepository;
        this.tripInvitationRepository = tripInvitationRepository;
        this.appUserRepository = appUserRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.tripNotificationWebSocketPublisher = tripNotificationWebSocketPublisher;
        this.tripRealtimeWebSocketPublisher = tripRealtimeWebSocketPublisher;
    }

    @Transactional
    public TripInvitationResponse inviteFriend(String authenticatedEmail, Long tripId, InviteTripFriendRequest request) {
        AppUser inviter = findCurrentUser(authenticatedEmail);
        Trip trip = findOwnedTrip(tripId, inviter);
        AppUser invitedUser = findUser(request.invitedUserId());

        validateInvitation(inviter, trip, invitedUser);

        TripInvitation invitation = new TripInvitation();
        invitation.setTrip(trip);
        invitation.setInvitedBy(inviter);
        invitation.setInvitedUser(invitedUser);
        invitation.setStatus(TripInvitationStatus.PENDING);

        TripInvitation savedInvitation = tripInvitationRepository.save(invitation);
        tripNotificationWebSocketPublisher.publishTripInvitationCreated(savedInvitation);
        return toResponse(savedInvitation);
    }

    @Transactional(readOnly = true)
    public List<TripInvitationResponse> listIncomingInvitations(String authenticatedEmail) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        return tripInvitationRepository.findAllByInvitedUserIdAndStatusOrderByCreatedAtDesc(
                        currentUser.getId(),
                        TripInvitationStatus.PENDING
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TripInvitationResponse> listSentInvitations(String authenticatedEmail) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        return tripInvitationRepository.findAllByInvitedByIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TripParticipantResponse> listParticipants(String authenticatedEmail, Long tripId) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        Trip trip = findAccessibleTrip(tripId, currentUser);

        List<TripParticipantResponse> participants = new java.util.ArrayList<>();
        participants.add(new TripParticipantResponse(toFriendUserResponse(trip.getOwner()), TripAccessRole.OWNER));

        participants.addAll(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(
                        trip.getId(),
                        TripInvitationStatus.ACCEPTED
                )
                .stream()
                .map(invitation -> new TripParticipantResponse(
                        toFriendUserResponse(invitation.getInvitedUser()),
                        TripAccessRole.PARTICIPANT
                ))
                .toList());

        return participants;
    }

    @Transactional
    public MessageResponse acceptInvitation(String authenticatedEmail, Long invitationId) {
        TripInvitation invitation = findPendingInvitationForCurrentUser(authenticatedEmail, invitationId);
        invitation.setStatus(TripInvitationStatus.ACCEPTED);
        TripInvitation savedInvitation = tripInvitationRepository.save(invitation);
        tripNotificationWebSocketPublisher.publishTripInvitationAccepted(savedInvitation);
        tripRealtimeWebSocketPublisher.publishTripParticipantJoined(
                savedInvitation.getTrip(),
                savedInvitation.getInvitedUser(),
                tripUpdateRecipients(savedInvitation.getTrip(), savedInvitation.getInvitedUser().getId(), false)
        );
        return new MessageResponse("Trip invitation accepted.");
    }

    @Transactional
    public MessageResponse declineInvitation(String authenticatedEmail, Long invitationId) {
        TripInvitation invitation = findPendingInvitationForCurrentUser(authenticatedEmail, invitationId);
        invitation.setStatus(TripInvitationStatus.DECLINED);
        TripInvitation savedInvitation = tripInvitationRepository.save(invitation);
        tripNotificationWebSocketPublisher.publishTripInvitationDeclined(savedInvitation);
        return new MessageResponse("Trip invitation declined.");
    }

    @Transactional
    public MessageResponse cancelInvitation(String authenticatedEmail, Long invitationId) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        TripInvitation invitation = tripInvitationRepository.findByIdAndInvitedByIdAndStatus(
                        invitationId,
                        currentUser.getId(),
                        TripInvitationStatus.PENDING
                )
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip invitation was not found."));

        tripInvitationRepository.delete(invitation);
        return new MessageResponse("Trip invitation cancelled.");
    }

    private void validateInvitation(AppUser inviter, Trip trip, AppUser invitedUser) {
        if (!trip.getOwner().getId().equals(inviter.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the trip owner can invite friends.");
        }

        if (inviter.getId().equals(invitedUser.getId())) {
            throw new IllegalArgumentException("You cannot invite yourself to this trip.");
        }

        if (!isAcceptedFriend(inviter.getId(), invitedUser.getId())) {
            throw new IllegalArgumentException("You can only invite accepted friends to this trip.");
        }

        if (tripInvitationRepository.existsByTripIdAndInvitedUserIdAndStatus(trip.getId(), invitedUser.getId(), TripInvitationStatus.PENDING)) {
            throw new IllegalArgumentException("This user already has a pending invitation for this trip.");
        }

        if (tripInvitationRepository.existsByTripIdAndInvitedUserIdAndStatus(trip.getId(), invitedUser.getId(), TripInvitationStatus.ACCEPTED)) {
            throw new IllegalArgumentException("This user is already a participant on this trip.");
        }
    }

    private boolean isAcceptedFriend(Long firstUserId, Long secondUserId) {
        return friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.ACCEPTED);
    }

    private TripInvitation findPendingInvitationForCurrentUser(String authenticatedEmail, Long invitationId) {
        AppUser currentUser = findCurrentUser(authenticatedEmail);
        return tripInvitationRepository.findByIdAndInvitedUserIdAndStatus(invitationId, currentUser.getId(), TripInvitationStatus.PENDING)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip invitation was not found."));
    }

    private Trip findOwnedTrip(Long tripId, AppUser owner) {
        return tripRepository.findByIdAndOwnerId(tripId, owner.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip was not found."));
    }

    private AppUser findCurrentUser(String authenticatedEmail) {
        return appUserRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));
    }

    private AppUser findUser(Long userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User was not found."));
    }

    private TripInvitationResponse toResponse(TripInvitation invitation) {
        return new TripInvitationResponse(
                invitation.getId(),
                new TripInvitationTripSummaryResponse(
                        invitation.getTrip().getId(),
                        invitation.getTrip().getName(),
                        invitation.getTrip().getDestination(),
                        invitation.getTrip().getStartDate(),
                        invitation.getTrip().getEndDate(),
                        invitation.getTrip().getBudget(),
                        invitation.getTrip().getStatus()
                ),
                new FriendUserResponse(
                        invitation.getInvitedBy().getId(),
                        invitation.getInvitedBy().getUsername(),
                        invitation.getInvitedBy().getFirstName(),
                        invitation.getInvitedBy().getLastName(),
                        invitation.getInvitedBy().getEmail(),
                        invitation.getInvitedBy().isVerified(),
                        invitation.getInvitedBy().getProfilePictureUpdatedAt()
                ),
                toFriendUserResponse(invitation.getInvitedUser()),
                invitation.getStatus(),
                invitation.getCreatedAt()
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

    private Trip findAccessibleTrip(Long tripId, AppUser user) {
        return tripRepository.findAccessibleByIdAndUserId(tripId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip was not found."));
    }

    private List<AppUser> tripUpdateRecipients(Trip trip, Long actorId, boolean includeOwner) {
        var recipients = new java.util.LinkedHashMap<Long, AppUser>();

        if (includeOwner && !trip.getOwner().getId().equals(actorId)) {
            recipients.put(trip.getOwner().getId(), trip.getOwner());
        }

        tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(trip.getId(), TripInvitationStatus.ACCEPTED)
                .stream()
                .map(TripInvitation::getInvitedUser)
                .filter(user -> user.getId() != null && !user.getId().equals(actorId))
                .forEach(user -> recipients.putIfAbsent(user.getId(), user));

        return new java.util.ArrayList<>(recipients.values());
    }
}
