package com.sep.profile;

import com.sep.profile.dto.ProfileResponse;
import com.sep.profile.dto.UpdateProfileRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.Map;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileControllerTest {

    @Mock
    private ProfileService profileService;

    @Mock
    private Authentication authentication;

    private ProfileController profileController;

    @BeforeEach
    void setUp() {
        profileController = new ProfileController(profileService);
    }

    @Test
    void updateProfileReturnsSavedAchievements() {
        UpdateProfileRequest request = new UpdateProfileRequest(
                "traveler",
                "Ada",
                "Lovelace",
                "+49 123456",
                "P1",
                List.of("BEACH_LOVER", "WORLD_TRAVELER"),
                "BER"
        );
        ProfileResponse savedProfile = new ProfileResponse(
                7L,
                "traveler@example.com",
                "traveler",
                "Ada",
                "Lovelace",
                "+49 123456",
                "P1",
                List.of("BEACH_LOVER", "WORLD_TRAVELER"),
                "BER",
                true,
                false,
                null
        );

        when(authentication.getName()).thenReturn("traveler@example.com");
        when(profileService.updateProfile("traveler@example.com", request)).thenReturn(savedProfile);

        ResponseEntity<ProfileResponse> response = profileController.updateProfile(authentication, request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().travelAchievements()).containsExactly("BEACH_LOVER", "WORLD_TRAVELER");
        verify(profileService).updateProfile("traveler@example.com", request);
    }

    @Test
    void illegalArgumentsBecomeClientSafeBadRequests() {
        ResponseEntity<Map<String, String>> response =
                profileController.handleIllegalArgument(new IllegalArgumentException("Username is already taken."));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("message", "Username is already taken.");
    }
}
