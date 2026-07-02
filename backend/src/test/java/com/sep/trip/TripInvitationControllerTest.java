package com.sep.trip;

import com.sep.auth.dto.MessageResponse;
import com.sep.trip.dto.InviteTripFriendRequest;
import com.sep.trip.dto.TripInvitationResponse;
import com.sep.trip.dto.TripParticipantResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripInvitationControllerTest {

    @Mock
    private TripInvitationService tripInvitationService;

    @Mock
    private Authentication authentication;

    private TripInvitationController tripInvitationController;

    @BeforeEach
    void setUp() {
        tripInvitationController = new TripInvitationController(tripInvitationService);
    }

    @Test
    void inviteFriendUsesAuthenticatedEmailTripIdAndRequest() {
        InviteTripFriendRequest request = new InviteTripFriendRequest(9L);
        TripInvitationResponse response = invitationResponse();
        when(authentication.getName()).thenReturn("owner@example.com");
        when(tripInvitationService.inviteFriend("owner@example.com", 11L, request)).thenReturn(response);

        ResponseEntity<TripInvitationResponse> actual = tripInvitationController.inviteFriend(authentication, 11L, request);

        assertThat(actual.getBody()).isEqualTo(response);
        verify(tripInvitationService).inviteFriend("owner@example.com", 11L, request);
    }

    @Test
    void listIncomingInvitationsUsesAuthenticatedEmail() {
        TripInvitationResponse response = invitationResponse();
        when(authentication.getName()).thenReturn("friend@example.com");
        when(tripInvitationService.listIncomingInvitations("friend@example.com")).thenReturn(List.of(response));

        List<TripInvitationResponse> actual = tripInvitationController.listIncomingInvitations(authentication);

        assertThat(actual).containsExactly(response);
        verify(tripInvitationService).listIncomingInvitations("friend@example.com");
    }

    @Test
    void acceptInvitationUsesAuthenticatedEmailAndInvitationId() {
        when(authentication.getName()).thenReturn("friend@example.com");
        MessageResponse message = new MessageResponse("Trip invitation accepted.");
        when(tripInvitationService.acceptInvitation("friend@example.com", 21L)).thenReturn(message);

        ResponseEntity<MessageResponse> actual = tripInvitationController.acceptInvitation(authentication, 21L);

        assertThat(actual.getBody()).isEqualTo(message);
        verify(tripInvitationService).acceptInvitation("friend@example.com", 21L);
    }

    @Test
    void declineInvitationUsesAuthenticatedEmailAndInvitationId() {
        when(authentication.getName()).thenReturn("friend@example.com");
        MessageResponse message = new MessageResponse("Trip invitation declined.");
        when(tripInvitationService.declineInvitation("friend@example.com", 21L)).thenReturn(message);

        ResponseEntity<MessageResponse> actual = tripInvitationController.declineInvitation(authentication, 21L);

        assertThat(actual.getBody()).isEqualTo(message);
        verify(tripInvitationService).declineInvitation("friend@example.com", 21L);
    }

    @Test
    void listSentInvitationsUsesAuthenticatedEmail() {
        TripInvitationResponse response = invitationResponse();
        when(authentication.getName()).thenReturn("owner@example.com");
        when(tripInvitationService.listSentInvitations("owner@example.com")).thenReturn(List.of(response));

        List<TripInvitationResponse> actual = tripInvitationController.listSentInvitations(authentication);

        assertThat(actual).containsExactly(response);
        verify(tripInvitationService).listSentInvitations("owner@example.com");
    }

    @Test
    void listParticipantsUsesAuthenticatedEmailAndTripId() {
        TripParticipantResponse participant = new TripParticipantResponse(
                new com.sep.friend.dto.FriendUserResponse(
                        7L,
                        "owner",
                        "Ada",
                        "Lovelace",
                        "owner@example.com",
                        true,
                        null
                ),
                TripAccessRole.OWNER
        );
        when(authentication.getName()).thenReturn("owner@example.com");
        when(tripInvitationService.listParticipants("owner@example.com", 11L)).thenReturn(List.of(participant));

        ResponseEntity<List<TripParticipantResponse>> actual = tripInvitationController.listParticipants(authentication, 11L);

        assertThat(actual.getBody()).containsExactly(participant);
        verify(tripInvitationService).listParticipants("owner@example.com", 11L);
    }

    @Test
    void cancelInvitationUsesAuthenticatedEmailAndInvitationId() {
        when(authentication.getName()).thenReturn("owner@example.com");
        MessageResponse message = new MessageResponse("Trip invitation cancelled.");
        when(tripInvitationService.cancelInvitation("owner@example.com", 21L)).thenReturn(message);

        ResponseEntity<MessageResponse> actual = tripInvitationController.cancelInvitation(authentication, 21L);

        assertThat(actual.getBody()).isEqualTo(message);
        verify(tripInvitationService).cancelInvitation("owner@example.com", 21L);
    }

    private TripInvitationResponse invitationResponse() {
        return new TripInvitationResponse(
                21L,
                new com.sep.trip.dto.TripInvitationTripSummaryResponse(
                        11L,
                        "Summer in Rome",
                        "Rome",
                        java.time.LocalDate.of(2026, 7, 15),
                        java.time.LocalDate.of(2026, 7, 22),
                        new java.math.BigDecimal("2400.00"),
                        TripStatus.UPCOMING
                ),
                new com.sep.friend.dto.FriendUserResponse(
                        7L,
                        "owner",
                        "Ada",
                        "Lovelace",
                        "owner@example.com",
                        true,
                        null
                ),
                new com.sep.friend.dto.FriendUserResponse(
                        9L,
                        "friend",
                        "Grace",
                        "Hopper",
                        "friend@example.com",
                        true,
                        null
                ),
                TripInvitationStatus.PENDING,
                OffsetDateTime.parse("2026-06-20T18:00:00Z")
        );
    }
}
