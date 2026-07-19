package com.sep.profile;

import com.sep.profile.dto.ChangePasswordRequest;
import com.sep.profile.dto.DeleteAccountRequest;
import com.sep.profile.dto.ProfileResponse;
import com.sep.profile.dto.UpdateProfileRequest;
import com.sep.budget.BudgetAlertNotificationRepository;
import com.sep.budget.BudgetAlertNotificationService;
import com.sep.budget.ExpenseRepository;
import com.sep.event.CalendarEventRepository;
import com.sep.settings.UserFeedbackRepository;
import com.sep.settings.UserSettingsRepository;
import com.sep.trip.Trip;
import com.sep.trip.TripInvitation;
import com.sep.trip.TripInvitationRepository;
import com.sep.trip.TripReminderNotificationRepository;
import com.sep.trip.TripUpdateNotificationRepository;
import com.sep.trip.TripRepository;
import com.sep.tripplanning.TripPlanningRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripPlanningRepository tripPlanningRepository;

    @Mock
    private UserSettingsRepository userSettingsRepository;

    @Mock
    private UserFeedbackRepository userFeedbackRepository;

    @Mock
    private TripReminderNotificationRepository tripReminderNotificationRepository;

    @Mock
    private TripUpdateNotificationRepository tripUpdateNotificationRepository;

    @Mock
    private BudgetAlertNotificationRepository budgetAlertNotificationRepository;

    @Mock
    private CalendarEventRepository calendarEventRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private TripInvitationRepository tripInvitationRepository;

    @Mock
    private BudgetAlertNotificationService budgetAlertNotificationService;

    private ProfileService profileService;
    private AppUser user;

    @BeforeEach
    void setUp() {
        profileService = new ProfileService(
                userRepository,
                passwordEncoder,
                tripRepository,
                tripPlanningRepository,
                userSettingsRepository,
                userFeedbackRepository,
                tripReminderNotificationRepository,
                tripUpdateNotificationRepository,
                budgetAlertNotificationRepository,
                calendarEventRepository,
                expenseRepository,
                tripInvitationRepository,
                budgetAlertNotificationService
        );

        user = new AppUser();
        user.setId(7L);
        user.setEmail("traveler@example.com");
        user.setUsername("traveler");
        user.setPasswordHash("old-hash");
        user.setVerified(true);
    }

    @Test
    void getProfileReturnsMappedDataAndPictureState() {
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setPhoneNumber("+49 123456");
        user.setPassportNumber("X1234567");
        user.setTravelAchievements("BEACH_LOVER,FOOD_EXPLORER");
        user.setHomeAirport("BER");
        user.setProfilePicture("image".getBytes(StandardCharsets.UTF_8));
        user.setProfilePictureContentType("image/png");
        user.setProfilePictureUpdatedAt(LocalDateTime.of(2026, 7, 14, 12, 0));

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        ProfileResponse response = profileService.getProfile("traveler@example.com");

        assertThat(response.id()).isEqualTo(7L);
        assertThat(response.email()).isEqualTo("traveler@example.com");
        assertThat(response.username()).isEqualTo("traveler");
        assertThat(response.firstName()).isEqualTo("Ada");
        assertThat(response.lastName()).isEqualTo("Lovelace");
        assertThat(response.phoneNumber()).isEqualTo("+49 123456");
        assertThat(response.passportNumber()).isEqualTo("X1234567");
        assertThat(response.travelAchievements()).containsExactly("BEACH_LOVER", "FOOD_EXPLORER");
        assertThat(response.homeAirport()).isEqualTo("BER");
        assertThat(response.verified()).isTrue();
        assertThat(response.hasProfilePicture()).isTrue();
        assertThat(response.profilePictureUpdatedAt()).isEqualTo(LocalDateTime.of(2026, 7, 14, 12, 0));
    }

    @Test
    void getProfileReturnsDefaultFallbacksWhenOptionalFieldsAreMissing() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        ProfileResponse response = profileService.getProfile("traveler@example.com");

        assertThat(response.firstName()).isNull();
        assertThat(response.lastName()).isNull();
        assertThat(response.phoneNumber()).isNull();
        assertThat(response.passportNumber()).isNull();
        assertThat(response.travelAchievements()).isEmpty();
        assertThat(response.homeAirport()).isNull();
        assertThat(response.hasProfilePicture()).isFalse();
        assertThat(response.profilePictureUpdatedAt()).isNull();
    }

    @Test
    void getProfileReturnsFalseWhenStoredPictureBytesAreEmpty() {
        user.setProfilePicture(new byte[0]);
        user.setProfilePictureContentType("image/png");
        user.setProfilePictureUpdatedAt(LocalDateTime.of(2026, 7, 14, 12, 0));

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        ProfileResponse response = profileService.getProfile("traveler@example.com");

        assertThat(response.hasProfilePicture()).isFalse();
        assertThat(response.profilePictureUpdatedAt()).isEqualTo(LocalDateTime.of(2026, 7, 14, 12, 0));
    }

    @Test
    void getProfileRejectsMissingCurrentUser() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> profileService.getProfile("traveler@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Authenticated user was not found.");
    }

    @Test
    void updateProfileRejectsUsernameOwnedByAnotherUser() {
        AppUser otherUser = new AppUser();
        otherUser.setId(99L);
        otherUser.setUsername("taken");

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("taken")).thenReturn(Optional.of(otherUser));

        UpdateProfileRequest request = new UpdateProfileRequest("taken", "Ada", "", "", "", List.of(), "");

        assertThatThrownBy(() -> profileService.updateProfile("traveler@example.com", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Username is already taken.");

        verify(userRepository, never()).save(any(AppUser.class));
    }

    @Test
    void updateProfileTrimsOptionalFieldsNormalizesAirportAndDeduplicatesAchievements() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest(
                "traveler",
                "  Ada  ",
                "  Lovelace  ",
                "  +49 123456  ",
                "",
                List.of(" beach_lover ", "FOOD_EXPLORER", "unknown", "beach_lover", " "),
                " ber "
        );

        ProfileResponse response = profileService.updateProfile("traveler@example.com", request);

        assertThat(user.getUsername()).isEqualTo("traveler");
        assertThat(user.getFirstName()).isEqualTo("Ada");
        assertThat(user.getLastName()).isEqualTo("Lovelace");
        assertThat(user.getPhoneNumber()).isEqualTo("+49 123456");
        assertThat(user.getPassportNumber()).isNull();
        assertThat(user.getTravelAchievements()).isEqualTo("BEACH_LOVER,FOOD_EXPLORER");
        assertThat(user.getHomeAirport()).isEqualTo("BER");
        assertThat(response.travelAchievements()).containsExactly("BEACH_LOVER", "FOOD_EXPLORER");
        assertThat(response.homeAirport()).isEqualTo("BER");
        verify(userRepository).save(user);
    }

    @Test
    void updateProfileAllowsCurrentUserToKeepTheirUsernameAndPassportWhenOmitted() {
        user.setPassportNumber("X1234567");

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest(
                "traveler",
                null,
                null,
                null,
                null,
                List.of(),
                null
        );

        ProfileResponse response = profileService.updateProfile("traveler@example.com", request);

        assertThat(user.getFirstName()).isNull();
        assertThat(user.getLastName()).isNull();
        assertThat(user.getPhoneNumber()).isNull();
        assertThat(user.getPassportNumber()).isEqualTo("X1234567");
        assertThat(user.getTravelAchievements()).isNull();
        assertThat(user.getHomeAirport()).isNull();
        assertThat(response.passportNumber()).isEqualTo("X1234567");
        assertThat(response.travelAchievements()).isEmpty();
        verify(userRepository).save(user);
    }

    @Test
    void updateProfileTreatsNullAchievementsAsEmptyList() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest(
                "traveler",
                "Ada",
                null,
                null,
                null,
                null,
                null
        );

        ProfileResponse response = profileService.updateProfile("traveler@example.com", request);

        assertThat(user.getTravelAchievements()).isNull();
        assertThat(response.travelAchievements()).isEmpty();
        verify(userRepository).save(user);
    }

    @Test
    void updateProfileRejectsMissingCurrentUser() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.empty());

        UpdateProfileRequest request = new UpdateProfileRequest("traveler", null, null, null, null, List.of(), null);

        assertThatThrownBy(() -> profileService.updateProfile("traveler@example.com", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Authenticated user was not found.");
    }

    @Test
    void updateProfileSavesPassportNumberAndAchievements() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest(
                "traveler",
                "Ada",
                "Lovelace",
                "+49 123456",
                "P1",
                List.of("BEACH_LOVER", "FOOD_EXPLORER"),
                "ber"
        );

        ProfileResponse response = profileService.updateProfile("traveler@example.com", request);

        assertThat(user.getPhoneNumber()).isEqualTo("+49 123456");
        assertThat(user.getPassportNumber()).isEqualTo("P1");
        assertThat(user.getTravelAchievements()).isEqualTo("BEACH_LOVER,FOOD_EXPLORER");
        assertThat(response.passportNumber()).isEqualTo("P1");
        assertThat(response.travelAchievements()).containsExactly("BEACH_LOVER", "FOOD_EXPLORER");
        verify(userRepository).save(user);
    }

    @Test
    void uploadProfilePictureRejectsInvalidInputs() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> profileService.uploadProfilePicture("traveler@example.com", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Choose an image file to upload.");

        MockMultipartFile empty = new MockMultipartFile("file", "avatar.png", "image/png", new byte[0]);
        assertThatThrownBy(() -> profileService.uploadProfilePicture("traveler@example.com", empty))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Choose an image file to upload.");

        MockMultipartFile oversized = new MockMultipartFile("file", "avatar.png", "image/png", new byte[2 * 1024 * 1024 + 1]);
        assertThatThrownBy(() -> profileService.uploadProfilePicture("traveler@example.com", oversized))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Profile picture must be 2 MB or smaller.");

        MockMultipartFile invalidType = new MockMultipartFile("file", "notes.txt", "text/plain", "hello".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> profileService.uploadProfilePicture("traveler@example.com", invalidType))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Only JPG, PNG, WebP, or GIF images are allowed.");

        MockMultipartFile blankType = new MockMultipartFile("file", "avatar.png", null, "hello".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> profileService.uploadProfilePicture("traveler@example.com", blankType))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Only JPG, PNG, WebP, or GIF images are allowed.");
    }

    @Test
    void uploadProfilePictureStoresAndReplacesImage() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MockMultipartFile first = new MockMultipartFile("file", "avatar.png", "image/png", "first".getBytes(StandardCharsets.UTF_8));
        ProfileResponse firstResponse = profileService.uploadProfilePicture("traveler@example.com", first);

        assertThat(firstResponse.hasProfilePicture()).isTrue();
        assertThat(user.getProfilePicture()).containsExactly("first".getBytes(StandardCharsets.UTF_8));
        assertThat(user.getProfilePictureContentType()).isEqualTo("image/png");
        assertThat(user.getProfilePictureUpdatedAt()).isNotNull();

        LocalDateTime firstUpdatedAt = user.getProfilePictureUpdatedAt();

        MockMultipartFile second = new MockMultipartFile("file", "avatar.webp", "image/webp", "second".getBytes(StandardCharsets.UTF_8));
        ProfileResponse secondResponse = profileService.uploadProfilePicture("traveler@example.com", second);

        assertThat(secondResponse.hasProfilePicture()).isTrue();
        assertThat(user.getProfilePicture()).containsExactly("second".getBytes(StandardCharsets.UTF_8));
        assertThat(user.getProfilePictureContentType()).isEqualTo("image/webp");
        assertThat(user.getProfilePictureUpdatedAt()).isNotNull();
        assertThat(user.getProfilePictureUpdatedAt()).isNotEqualTo(firstUpdatedAt);
        verify(userRepository, times(2)).save(user);
    }

    @Test
    void uploadProfilePictureRejectsUnreadableImageData() throws Exception {
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(4L);
        when(file.getContentType()).thenReturn("image/png");
        when(file.getBytes()).thenThrow(new IOException("boom"));

        assertThatThrownBy(() -> profileService.uploadProfilePicture("traveler@example.com", file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Could not read the uploaded image.");
    }

    @Test
    void getProfilePictureReturnsEmptyAndThenStoredData() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        assertThat(profileService.getProfilePicture("traveler@example.com")).isEmpty();

        user.setProfilePicture("image".getBytes(StandardCharsets.UTF_8));
        user.setProfilePictureContentType("image/png");
        user.setProfilePictureUpdatedAt(LocalDateTime.of(2026, 7, 14, 12, 0));

        assertThat(profileService.getProfilePicture("traveler@example.com")).hasValueSatisfying(data -> {
            assertThat(data.bytes()).containsExactly("image".getBytes(StandardCharsets.UTF_8));
            assertThat(data.contentType()).isEqualTo("image/png");
            assertThat(data.updatedAt()).isEqualTo(LocalDateTime.of(2026, 7, 14, 12, 0));
        });
    }

    @Test
    void getProfilePictureReturnsEmptyWhenStoredBytesAreEmpty() {
        user.setProfilePicture(new byte[0]);
        user.setProfilePictureContentType("image/png");
        user.setProfilePictureUpdatedAt(LocalDateTime.of(2026, 7, 14, 12, 0));

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        assertThat(profileService.getProfilePicture("traveler@example.com")).isEmpty();
    }

    @Test
    void deleteProfilePictureClearsStoredImage() {
        user.setProfilePicture("image".getBytes(StandardCharsets.UTF_8));
        user.setProfilePictureContentType("image/png");
        user.setProfilePictureUpdatedAt(LocalDateTime.of(2026, 7, 14, 12, 0));

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProfileResponse response = profileService.deleteProfilePicture("traveler@example.com");

        assertThat(user.getProfilePicture()).isNull();
        assertThat(user.getProfilePictureContentType()).isNull();
        assertThat(user.getProfilePictureUpdatedAt()).isNull();
        assertThat(response.hasProfilePicture()).isFalse();
        verify(userRepository).save(user);
    }

    @Test
    void changePasswordRequiresCurrentPasswordAndMatchingConfirmation() {
        ChangePasswordRequest request = new ChangePasswordRequest(
                "old-password",
                "new-password",
                "new-password"
        );

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);
        when(passwordEncoder.matches("new-password", "old-hash")).thenReturn(false);
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");

        profileService.changePassword("traveler@example.com", request);

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        verify(userRepository).save(user);
    }

    @Test
    void changePasswordRejectsBadInputs() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        lenient().when(passwordEncoder.matches("wrong", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> profileService.changePassword("traveler@example.com", new ChangePasswordRequest("wrong", "new-password", "new-password")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Current password is incorrect.");

        lenient().when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);
        assertThatThrownBy(() -> profileService.changePassword("traveler@example.com", new ChangePasswordRequest("old-password", "new-password", "different")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("New passwords do not match.");

        lenient().when(passwordEncoder.matches("new-password", "old-hash")).thenReturn(true);
        assertThatThrownBy(() -> profileService.changePassword("traveler@example.com", new ChangePasswordRequest("old-password", "old-password", "old-password")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Choose a new password that is different from your current password.");
    }

    @Test
    void deleteCurrentAccountRejectsBadPasswordAndDeletesRelatedRows() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> profileService.deleteCurrentAccount("traveler@example.com", new DeleteAccountRequest("wrong-password")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Current password is incorrect.");

        when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);
        Trip ownedTrip = new Trip();
        ownedTrip.setId(44L);
        AppUser invitedUser = new AppUser();
        invitedUser.setId(12L);
        invitedUser.setEmail("friend@example.com");
        TripInvitation invitation = new TripInvitation();
        invitation.setInvitedUser(invitedUser);
        when(tripRepository.findAllByOwnerIdOrderByStartDateAsc(7L)).thenReturn(List.of(ownedTrip));
        when(tripInvitationRepository.findAllByInvitedByIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(invitation));

        profileService.deleteCurrentAccount("traveler@example.com", new DeleteAccountRequest("old-password"));

        verify(userFeedbackRepository).deleteAllByOwnerId(7L);
        verify(tripReminderNotificationRepository).deleteAllByRecipientId(7L);
        verify(tripReminderNotificationRepository).deleteAllByTripOwnerId(7L);
        verify(tripUpdateNotificationRepository).deleteAllByRecipientId(7L);
        verify(tripUpdateNotificationRepository).deleteAllByTripOwnerId(7L);
        verify(budgetAlertNotificationRepository).deleteAllByRecipientId(7L);
        verify(calendarEventRepository).deleteByTripIdIn(List.of(44L));
        verify(expenseRepository).deleteAllByTripIdIn(List.of(44L));
        verify(tripInvitationRepository).deleteAllByTripIdIn(List.of(44L));
        verify(tripInvitationRepository).deleteAllByInvitedUserId(7L);
        verify(tripInvitationRepository).deleteAllByInvitedById(7L);
        verify(userSettingsRepository).deleteByOwnerId(7L);
        verify(tripPlanningRepository).deleteAllByUserId(7L);
        verify(tripRepository).deleteAllByOwnerId(7L);
        verify(userRepository).delete(user);
        verify(userRepository).flush();
        verify(budgetAlertNotificationService).evaluateForUser(invitedUser);
    }
}
