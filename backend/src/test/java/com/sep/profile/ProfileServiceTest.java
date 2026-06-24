package com.sep.profile;

import com.sep.profile.dto.ChangePasswordRequest;
import com.sep.profile.dto.DeleteAccountRequest;
import com.sep.profile.dto.ProfileResponse;
import com.sep.profile.dto.UpdateProfileRequest;
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

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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

    private ProfileService profileService;
    private AppUser user;

    @BeforeEach
    void setUp() {
        profileService = new ProfileService(
                userRepository,
                passwordEncoder,
                tripRepository,
                tripPlanningRepository
        );

        user = new AppUser();
        user.setId(7L);
        user.setEmail("traveler@example.com");
        user.setUsername("traveler");
        user.setPasswordHash("old-hash");
        user.setVerified(true);
    }

    @Test
    void getProfileReturnsOnlyCurrentUserDataWithoutPictureBytes() {
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setPassportNumber("X1234567");
        user.setTravelAchievements("BEACH_LOVER,FOOD_EXPLORER");
        user.setProfilePicture("image".getBytes(StandardCharsets.UTF_8));
        user.setProfilePictureContentType("image/png");

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        ProfileResponse response = profileService.getProfile("traveler@example.com");

        assertThat(response.email()).isEqualTo("traveler@example.com");
        assertThat(response.username()).isEqualTo("traveler");
        assertThat(response.firstName()).isEqualTo("Ada");
        assertThat(response.passportNumber()).isEqualTo("X1234567");
        assertThat(response.travelAchievements()).containsExactly("BEACH_LOVER", "FOOD_EXPLORER");
        assertThat(response.hasProfilePicture()).isTrue();
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
    void updateProfileLeavesPassportNumberUntouchedWhenFormOmitsIt() {
        user.setPassportNumber("X1234567");

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest(
                "traveler",
                "Ada",
                "Lovelace",
                "+49 123456",
                "",
                List.of("WORLD_TRAVELER"),
                "ber"
        );

        ProfileResponse response = profileService.updateProfile("traveler@example.com", request);

        assertThat(user.getPassportNumber()).isEqualTo("X1234567");
        assertThat(response.passportNumber()).isEqualTo("X1234567");
        assertThat(response.travelAchievements()).containsExactly("WORLD_TRAVELER");
        verify(userRepository).save(user);
    }

    @Test
    void uploadProfilePictureStoresOnlyAllowedImageTypes() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.png",
                "image/png",
                "png-data".getBytes(StandardCharsets.UTF_8)
        );

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProfileResponse response = profileService.uploadProfilePicture("traveler@example.com", file);

        assertThat(response.hasProfilePicture()).isTrue();
        assertThat(user.getProfilePictureContentType()).isEqualTo("image/png");
        assertThat(user.getProfilePicture()).containsExactly("png-data".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void uploadProfilePictureRejectsNonImages() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "notes.txt",
                "text/plain",
                "hello".getBytes(StandardCharsets.UTF_8)
        );

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> profileService.uploadProfilePicture("traveler@example.com", file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Only JPG, PNG, WebP, or GIF images are allowed.");

        verify(userRepository, never()).save(any(AppUser.class));
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
    void deleteCurrentAccountDeletesRelatedRowsBeforeUser() {
        DeleteAccountRequest request = new DeleteAccountRequest("old-password");

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);

        profileService.deleteCurrentAccount("traveler@example.com", request);

        verify(tripPlanningRepository).deleteAllByUserId(7L);
        verify(tripRepository).deleteAllByOwnerId(7L);
        verify(userRepository).delete(user);
    }
}
