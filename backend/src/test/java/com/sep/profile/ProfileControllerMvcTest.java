package com.sep.profile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.auth.dto.MessageResponse;
import com.sep.profile.ProfileService.ProfilePictureData;
import com.sep.profile.dto.ChangePasswordRequest;
import com.sep.profile.dto.DeleteAccountRequest;
import com.sep.profile.dto.ProfileResponse;
import com.sep.profile.dto.UpdateProfileRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ProfileControllerMvcTest {

    @Mock
    private ProfileService profileService;

    @Mock
    private Authentication authentication;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ProfileController(profileService)).build();
    }

    @Test
    void getProfileReturnsSavedProfile() throws Exception {
        ProfileResponse response = profileResponse();
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(profileService.getProfile("traveler@example.com")).thenReturn(response);

        mockMvc.perform(get("/api/profile").principal(authentication))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("traveler"))
                .andExpect(jsonPath("$.travelAchievements[0]").value("BEACH_LOVER"));

        verify(profileService).getProfile("traveler@example.com");
    }

    @Test
    void updateProfileReturnsUpdatedBody() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("traveler", "Ada", "Lovelace", "+49 123456", "P1", List.of("BEACH_LOVER"), "BER");
        ProfileResponse response = profileResponse();
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(profileService.updateProfile("traveler@example.com", request)).thenReturn(response);

        mockMvc.perform(put("/api/profile")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("traveler@example.com"))
                .andExpect(jsonPath("$.travelAchievements[0]").value("BEACH_LOVER"));

        verify(profileService).updateProfile("traveler@example.com", request);
    }

    @Test
    void updateProfileRejectsInvalidBodyBeforeServiceCall() throws Exception {
        mockMvc.perform(put("/api/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"","firstName":"Ada"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());

        verifyNoInteractions(profileService);
    }

    @Test
    void uploadProfilePictureReturnsSavedProfile() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", "png-data".getBytes());
        ProfileResponse response = profileResponse();
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(profileService.uploadProfilePicture("traveler@example.com", file)).thenReturn(response);

        mockMvc.perform(multipart("/api/profile/picture")
                        .file(file)
                        .principal(authentication))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasProfilePicture").value(true));

        verify(profileService).uploadProfilePicture("traveler@example.com", file);
    }

    @Test
    void deleteProfilePictureReturnsSavedProfile() throws Exception {
        ProfileResponse response = profileResponse();
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(profileService.deleteProfilePicture("traveler@example.com")).thenReturn(response);

        mockMvc.perform(delete("/api/profile/picture").principal(authentication))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("traveler"));

        verify(profileService).deleteProfilePicture("traveler@example.com");
    }

    @Test
    void getProfileRejectsMissingAuthentication() throws Exception {
        mockMvc.perform(get("/api/profile"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication is required."));

        verifyNoInteractions(profileService);
    }

    @Test
    void getProfileRejectsNullAuthenticatedName() throws Exception {
        when(authentication.getName()).thenReturn(null);

        mockMvc.perform(get("/api/profile").principal(authentication))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication is required."));

        verifyNoInteractions(profileService);
    }

    @Test
    void getPictureReturnsNotFoundWhenMissing() throws Exception {
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(profileService.getProfilePicture("traveler@example.com")).thenReturn(java.util.Optional.empty());

        mockMvc.perform(get("/api/profile/picture").principal(authentication))
                .andExpect(status().isNotFound());

        verify(profileService).getProfilePicture("traveler@example.com");
    }

    @Test
    void getPictureReturnsBinaryResponseWhenPresent() throws Exception {
        when(authentication.getName()).thenReturn("traveler@example.com");
        when(profileService.getProfilePicture("traveler@example.com")).thenReturn(java.util.Optional.of(
                new ProfilePictureData("image".getBytes(), "image/png", LocalDateTime.of(2026, 7, 14, 12, 0))
        ));

        mockMvc.perform(get("/api/profile/picture").principal(authentication))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_PNG))
                .andExpect(content().bytes("image".getBytes()));

        verify(profileService).getProfilePicture("traveler@example.com");
    }

    @Test
    void changePasswordReturnsSuccessMessage() throws Exception {
        ChangePasswordRequest request = new ChangePasswordRequest("old", "new-password", "new-password");
        when(authentication.getName()).thenReturn("traveler@example.com");

        mockMvc.perform(put("/api/profile/password")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password changed successfully."));

        verify(profileService).changePassword("traveler@example.com", request);
    }

    @Test
    void deleteAccountUsesAuthenticatedUserAndReturnsMessage() throws Exception {
        DeleteAccountRequest request = new DeleteAccountRequest("old-password");
        when(authentication.getName()).thenReturn("traveler@example.com");

        mockMvc.perform(delete("/api/profile")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Account deleted successfully."));

        verify(profileService).deleteCurrentAccount("traveler@example.com", request);
    }

    @Test
    void deleteAccountCanUseLegacyEndpointToo() throws Exception {
        DeleteAccountRequest request = new DeleteAccountRequest("old-password");
        when(authentication.getName()).thenReturn("traveler@example.com");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/profile/delete-account")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Account deleted successfully."));

        verify(profileService).deleteCurrentAccount("traveler@example.com", request);
    }

    @Test
    void responseStatusHandlerUsesFallbackMessageWhenReasonMissing() {
        ResponseEntity<java.util.Map<String, String>> response = new ProfileController(profileService)
                .handleResponseStatus(new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND));

        assertThat(response.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("message", "Request failed.");
    }

    @Test
    void dataIntegrityViolationAndUnexpectedExceptionHandlersReturnExpectedResponses() {
        ProfileController controller = new ProfileController(profileService);

        assertThat(controller.handleDataIntegrityViolation(new DataIntegrityViolationException("boom")))
                .extracting(ResponseEntity::getStatusCode)
                .isEqualTo(org.springframework.http.HttpStatus.CONFLICT);

        assertThat(controller.handleUnexpectedException(new RuntimeException("boom")))
                .extracting(ResponseEntity::getStatusCode)
                .isEqualTo(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ProfileResponse profileResponse() {
        return new ProfileResponse(
                7L,
                "traveler@example.com",
                "traveler",
                "Ada",
                "Lovelace",
                "+49 123456",
                "X1234567",
                List.of("BEACH_LOVER"),
                "BER",
                true,
                true,
                LocalDateTime.of(2026, 7, 14, 12, 0)
        );
    }
}
