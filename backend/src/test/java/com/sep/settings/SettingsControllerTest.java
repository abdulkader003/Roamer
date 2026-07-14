package com.sep.settings;

import com.sep.settings.dto.FeedbackResponse;
import com.sep.settings.dto.NotificationSettingsResponse;
import com.sep.settings.dto.PrivacySettingsResponse;
import com.sep.settings.dto.SettingsPreferencesResponse;
import com.sep.settings.dto.UpdateSettingsRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SettingsControllerTest {

    @Mock
    private SettingsService settingsService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SettingsController(settingsService)).build();
    }

    @Test
    void getSettingsReturnsPreferences() throws Exception {
        when(settingsService.getSettings("traveler@example.com")).thenReturn(
                new SettingsPreferencesResponse(
                        new NotificationSettingsResponse(true, false, true),
                        "monthly",
                        new PrivacySettingsResponse(false, true)
                )
        );

        mockMvc.perform(get("/api/settings")
                        .principal(new UsernamePasswordAuthenticationToken("traveler@example.com", "N/A")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.tripReminders").value(true))
                .andExpect(jsonPath("$.notifications.budgetAlerts").value(false))
                .andExpect(jsonPath("$.notifications.bookingUpdates").value(true))
                .andExpect(jsonPath("$.defaultCalendarView").value("monthly"))
                .andExpect(jsonPath("$.privacy.shareTripData").value(false))
                .andExpect(jsonPath("$.privacy.allowAnalytics").value(true));

        verify(settingsService).getSettings("traveler@example.com");
    }

    @Test
    void updateSettingsReturnsUpdatedPreferences() throws Exception {
        when(settingsService.updateSettings(any(), any(UpdateSettingsRequest.class))).thenReturn(
                new SettingsPreferencesResponse(
                        new NotificationSettingsResponse(false, true, true),
                        "weekly",
                        new PrivacySettingsResponse(true, false)
                )
        );

        mockMvc.perform(put("/api/settings")
                        .principal(new UsernamePasswordAuthenticationToken("traveler@example.com", "N/A"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "notifications": {
                                    "tripReminders": false,
                                    "budgetAlerts": true,
                                    "bookingUpdates": true
                                  },
                                  "defaultCalendarView": "weekly",
                                  "privacy": {
                                    "shareTripData": true,
                                    "allowAnalytics": false
                                  }
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.tripReminders").value(false))
                .andExpect(jsonPath("$.defaultCalendarView").value("weekly"))
                .andExpect(jsonPath("$.privacy.shareTripData").value(true));

        verify(settingsService).updateSettings(any(), any(UpdateSettingsRequest.class));
    }

    @Test
    void submitFeedbackReturnsSavedFeedback() throws Exception {
        when(settingsService.submitFeedback(any(), any())).thenReturn(
                new FeedbackResponse(99L, 5, "✈️", "Great app", Instant.parse("2026-07-14T10:00:00Z"))
        );

        mockMvc.perform(post("/api/feedback")
                        .principal(new UsernamePasswordAuthenticationToken("traveler@example.com", "N/A"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "rating": 5,
                                  "emoji": "✈️",
                                  "message": "Great app",
                                  "submittedAt": "2026-07-14T10:00:00Z"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(99L))
                .andExpect(jsonPath("$.rating").value(5))
                .andExpect(jsonPath("$.message").value("Great app"));

        verify(settingsService).submitFeedback(any(), any());
    }

    @Test
    void invalidUpdateBodyReturnsValidationMessage() throws Exception {
        when(settingsService.updateSettings(any(), any(UpdateSettingsRequest.class)))
                .thenThrow(new IllegalArgumentException("Default calendar view must be monthly or weekly."));

        mockMvc.perform(put("/api/settings")
                        .principal(new UsernamePasswordAuthenticationToken("traveler@example.com", "N/A"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "notifications": {
                                    "tripReminders": true,
                                    "budgetAlerts": true,
                                    "bookingUpdates": false
                                  },
                                  "defaultCalendarView": "yearly",
                                  "privacy": {
                                    "shareTripData": false,
                                    "allowAnalytics": true
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Default calendar view must be monthly or weekly."));

        verify(settingsService).updateSettings(any(), any(UpdateSettingsRequest.class));
    }

    @Test
    void invalidRequestBodyReturnsValidationMessageFromBeanValidation() throws Exception {
        mockMvc.perform(put("/api/settings")
                        .principal(new UsernamePasswordAuthenticationToken("traveler@example.com", "N/A"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "notifications": {
                                    "tripReminders": true,
                                    "budgetAlerts": true,
                                    "bookingUpdates": false
                                  },
                                  "defaultCalendarView": " ",
                                  "privacy": {
                                    "shareTripData": false,
                                    "allowAnalytics": true
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("must not be blank"));

        verifyNoInteractions(settingsService);
    }

    @Test
    void missingAuthenticationReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication is required."));
        verifyNoInteractions(settingsService);
    }

    @Test
    void controllerUsesRequestStatusFallbackWhenReasonIsMissing() {
        var response = new SettingsController(settingsService)
                .handleResponseStatus(new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED));

        org.assertj.core.api.Assertions.assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        org.assertj.core.api.Assertions.assertThat(response.getBody()).containsEntry("message", "Request failed.");
    }

    @Test
    void controllerRejectsAuthenticationWithoutAName() {
        Authentication authentication = org.mockito.Mockito.mock(Authentication.class);
        when(authentication.getName()).thenReturn(null);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new SettingsController(settingsService).getSettings(authentication))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("Authentication is required.");
    }
}
