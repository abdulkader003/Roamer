package com.sep.trip;

import com.sep.auth.dto.MessageResponse;
import com.sep.friend.FriendRequestRepository;
import com.sep.friend.FriendRequestStatus;
import com.sep.trip.dto.InviteTripFriendRequest;
import com.sep.trip.dto.TripParticipantResponse;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripInvitationServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripInvitationRepository tripInvitationRepository;

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private FriendRequestRepository friendRequestRepository;

    @Mock
    private TripNotificationWebSocketPublisher tripNotificationWebSocketPublisher;

    @Mock
    private TripRealtimeWebSocketPublisher tripRealtimeWebSocketPublisher;

    private TripInvitationService tripInvitationService;
    private AppUser owner;
    private AppUser invitedUser;
    private Trip trip;

    @BeforeEach
    void setUp() {
        tripInvitationService = new TripInvitationService(
                tripRepository,
                tripInvitationRepository,
                appUserRepository,
                friendRequestRepository,
                tripNotificationWebSocketPublisher,
                tripRealtimeWebSocketPublisher
        );

        owner = user(7L, "owner@example.com", "owner");
        invitedUser = user(9L, "friend@example.com", "friend");
        trip = new Trip();
        trip.setId(11L);
        trip.setName("Summer in Rome");
        trip.setDestination("Rome");
        trip.setStartDate(LocalDate.of(2026, 7, 15));
        trip.setEndDate(LocalDate.of(2026, 7, 22));
        trip.setBudget(new BigDecimal("2400.00"));
        trip.setStatus(TripStatus.UPCOMING);
        trip.setOwner(owner);
    }

    @Test
    void inviteFriendCreatesPendingInvitationForAcceptedFriend() {
        when(appUserRepository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        when(appUserRepository.findById(9L)).thenReturn(Optional.of(invitedUser));
        when(tripRepository.findByIdAndOwnerId(11L, 7L)).thenReturn(Optional.of(trip));
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(7L, 9L, FriendRequestStatus.ACCEPTED)).thenReturn(true);
        when(tripInvitationRepository.existsByTripIdAndInvitedUserIdAndStatus(11L, 9L, TripInvitationStatus.PENDING)).thenReturn(false);
        when(tripInvitationRepository.existsByTripIdAndInvitedUserIdAndStatus(11L, 9L, TripInvitationStatus.ACCEPTED)).thenReturn(false);
        when(tripInvitationRepository.save(any(TripInvitation.class))).thenAnswer(invocation -> {
            TripInvitation invitation = invocation.getArgument(0);
            invitation.setId(21L);
            invitation.setCreatedAt(java.time.OffsetDateTime.parse("2026-06-20T18:00:00Z"));
            return invitation;
        });

        var response = tripInvitationService.inviteFriend("owner@example.com", 11L, new InviteTripFriendRequest(9L));

        assertThat(response.id()).isEqualTo(21L);
        assertThat(response.trip().id()).isEqualTo(11L);
        assertThat(response.status()).isEqualTo(TripInvitationStatus.PENDING);
        verify(tripInvitationRepository).save(any(TripInvitation.class));
        verify(tripNotificationWebSocketPublisher).publishTripInvitationCreated(any(TripInvitation.class));
    }

    @Test
    void inviteFriendRejectsNonFriends() {
        when(appUserRepository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        when(appUserRepository.findById(9L)).thenReturn(Optional.of(invitedUser));
        when(tripRepository.findByIdAndOwnerId(11L, 7L)).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> tripInvitationService.inviteFriend("owner@example.com", 11L, new InviteTripFriendRequest(9L)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("You can only invite accepted friends to this trip.");
    }

    @Test
    void inviteFriendRejectsDuplicatePendingInvitations() {
        when(appUserRepository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        when(appUserRepository.findById(9L)).thenReturn(Optional.of(invitedUser));
        when(tripRepository.findByIdAndOwnerId(11L, 7L)).thenReturn(Optional.of(trip));
        when(friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(7L, 9L, FriendRequestStatus.ACCEPTED)).thenReturn(true);
        when(tripInvitationRepository.existsByTripIdAndInvitedUserIdAndStatus(11L, 9L, TripInvitationStatus.PENDING)).thenReturn(true);

        assertThatThrownBy(() -> tripInvitationService.inviteFriend("owner@example.com", 11L, new InviteTripFriendRequest(9L)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("This user already has a pending invitation for this trip.");

        verify(tripInvitationRepository, never()).save(any(TripInvitation.class));
    }

    @Test
    void listIncomingInvitationsReturnsPendingRequests() {
        TripInvitation invitation = invitation(21L, invitedUser, owner, TripInvitationStatus.PENDING);
        when(appUserRepository.findByEmailIgnoreCase("friend@example.com")).thenReturn(Optional.of(invitedUser));
        when(tripInvitationRepository.findAllByInvitedUserIdAndStatusOrderByCreatedAtDesc(9L, TripInvitationStatus.PENDING))
                .thenReturn(List.of(invitation));

        var response = tripInvitationService.listIncomingInvitations("friend@example.com");

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().trip().name()).isEqualTo("Summer in Rome");
        assertThat(response.getFirst().invitedBy().username()).isEqualTo("owner");
        assertThat(response.getFirst().invitedUser().username()).isEqualTo("friend");
    }

    @Test
    void listSentInvitationsReturnsInvitationsCreatedByCurrentUser() {
        TripInvitation invitation = invitation(21L, invitedUser, owner, TripInvitationStatus.PENDING);
        when(appUserRepository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        when(tripInvitationRepository.findAllByInvitedByIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(invitation));

        var response = tripInvitationService.listSentInvitations("owner@example.com");

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().invitedBy().username()).isEqualTo("owner");
        assertThat(response.getFirst().invitedUser().username()).isEqualTo("friend");
    }

    @Test
    void listParticipantsReturnsOwnerAndAcceptedInvitees() {
        TripInvitation accepted = invitation(21L, invitedUser, owner, TripInvitationStatus.ACCEPTED);
        when(appUserRepository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        when(tripRepository.findAccessibleByIdAndUserId(11L, 7L)).thenReturn(Optional.of(trip));
        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of(accepted));

        List<TripParticipantResponse> participants = tripInvitationService.listParticipants("owner@example.com", 11L);

        assertThat(participants).hasSize(2);
        assertThat(participants.getFirst().user().username()).isEqualTo("owner");
        assertThat(participants.get(1).user().username()).isEqualTo("friend");
    }

    @Test
    void cancelInvitationDeletesPendingInvitationOwnedByCurrentUser() {
        TripInvitation pending = invitation(21L, invitedUser, owner, TripInvitationStatus.PENDING);
        when(appUserRepository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        when(tripInvitationRepository.findByIdAndInvitedByIdAndStatus(21L, 7L, TripInvitationStatus.PENDING))
                .thenReturn(Optional.of(pending));

        MessageResponse response = tripInvitationService.cancelInvitation("owner@example.com", 21L);

        assertThat(response.message()).isEqualTo("Trip invitation cancelled.");
        verify(tripInvitationRepository).delete(pending);
    }

    @Test
    void acceptInvitationMarksTheInvitationAsAccepted() {
        TripInvitation invitation = invitation(21L, invitedUser, owner, TripInvitationStatus.PENDING);
        when(appUserRepository.findByEmailIgnoreCase("friend@example.com")).thenReturn(Optional.of(invitedUser));
        when(tripInvitationRepository.findByIdAndInvitedUserIdAndStatus(21L, 9L, TripInvitationStatus.PENDING))
                .thenReturn(Optional.of(invitation));
        when(tripInvitationRepository.save(invitation)).thenReturn(invitation);

        MessageResponse response = tripInvitationService.acceptInvitation("friend@example.com", 21L);

        assertThat(response.message()).isEqualTo("Trip invitation accepted.");
        assertThat(invitation.getStatus()).isEqualTo(TripInvitationStatus.ACCEPTED);
        verify(tripNotificationWebSocketPublisher).publishTripInvitationAccepted(invitation);
        ArgumentCaptor<Collection<AppUser>> recipientsCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(tripRealtimeWebSocketPublisher).publishTripParticipantJoined(eq(trip), eq(invitedUser), recipientsCaptor.capture());
        assertThat(recipientsCaptor.getValue()).extracting(AppUser::getEmail).containsExactly("owner@example.com");
        verify(tripRealtimeWebSocketPublisher).publishTripParticipantJoinedTopic(eq(trip), eq(invitedUser));
    }

    @Test
    void declineInvitationRejectsRequestsBelongingToOtherUsers() {
        TripInvitation invitation = invitation(21L, invitedUser, owner, TripInvitationStatus.PENDING);
        AppUser otherUser = user(12L, "other@example.com", "other");
        when(appUserRepository.findByEmailIgnoreCase("other@example.com")).thenReturn(Optional.of(otherUser));
        when(tripInvitationRepository.findByIdAndInvitedUserIdAndStatus(21L, 12L, TripInvitationStatus.PENDING))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripInvitationService.declineInvitation("other@example.com", 21L))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void declineInvitationMarksTheInvitationAsDeclined() {
        TripInvitation invitation = invitation(21L, invitedUser, owner, TripInvitationStatus.PENDING);
        when(appUserRepository.findByEmailIgnoreCase("friend@example.com")).thenReturn(Optional.of(invitedUser));
        when(tripInvitationRepository.findByIdAndInvitedUserIdAndStatus(21L, 9L, TripInvitationStatus.PENDING))
                .thenReturn(Optional.of(invitation));
        when(tripInvitationRepository.save(invitation)).thenReturn(invitation);

        MessageResponse response = tripInvitationService.declineInvitation("friend@example.com", 21L);

        assertThat(response.message()).isEqualTo("Trip invitation declined.");
        assertThat(invitation.getStatus()).isEqualTo(TripInvitationStatus.DECLINED);
        verify(tripNotificationWebSocketPublisher).publishTripInvitationDeclined(invitation);
    }

    private AppUser user(Long id, String email, String username) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setUsername(username);
        return user;
    }

    private TripInvitation invitation(Long id, AppUser invitedUser, AppUser invitedBy, TripInvitationStatus status) {
        TripInvitation invitation = new TripInvitation();
        invitation.setId(id);
        invitation.setTrip(trip);
        invitation.setInvitedUser(invitedUser);
        invitation.setInvitedBy(invitedBy);
        invitation.setStatus(status);
        invitation.setCreatedAt(java.time.OffsetDateTime.parse("2026-06-20T18:00:00Z"));
        return invitation;
    }
}
