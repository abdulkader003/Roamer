package com.sep.settings;

import com.sep.budget.BudgetAlertNotificationService;
import com.sep.settings.dto.FeedbackRequest;
import com.sep.settings.dto.FeedbackResponse;
import com.sep.settings.dto.NotificationSettingsRequest;
import com.sep.settings.dto.PrivacySettingsRequest;
import com.sep.settings.dto.SettingsPreferencesResponse;
import com.sep.settings.dto.UpdateSettingsRequest;
import com.sep.trip.TripReminderService;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettingsServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private UserSettingsRepository settingsRepository;

    @Mock
    private UserFeedbackRepository feedbackRepository;

    @Mock
    private BudgetAlertNotificationService budgetAlertNotificationService;

    @Mock
    private TripReminderService tripReminderService;

    private SettingsService settingsService;

    @BeforeEach
    void setUp() {
        settingsService = new SettingsService(
                userRepository,
                settingsRepository,
                feedbackRepository,
                budgetAlertNotificationService,
                tripReminderService
        );
    }

    @Test
    void getSettingsReturnsExistingSettingsWithoutCreatingDefaults() {
        AppUser user = user("traveler@example.com");
        UserSettings settings = settings(user);
        settings.setTripReminders(false);
        settings.setBudgetAlerts(true);
        settings.setBookingUpdates(true);
        settings.setDefaultCalendarView("weekly");
        settings.setShareTripData(true);
        settings.setAllowAnalytics(false);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(settingsRepository.findByOwnerEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(settings));

        SettingsPreferencesResponse response = settingsService.getSettings("traveler@example.com");

        assertThat(response.notifications().tripReminders()).isFalse();
        assertThat(response.notifications().budgetAlerts()).isTrue();
        assertThat(response.notifications().bookingUpdates()).isTrue();
        assertThat(response.defaultCalendarView()).isEqualTo("weekly");
        assertThat(response.privacy().shareTripData()).isTrue();
        assertThat(response.privacy().allowAnalytics()).isFalse();
        verify(settingsRepository, never()).save(any(UserSettings.class));
    }

    @Test
    void getSettingsCreatesDefaultSettingsWhenMissing() {
        AppUser user = user("traveler@example.com");
        UserSettings savedSettings = settings(user);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(settingsRepository.findByOwnerEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.empty());
        when(settingsRepository.save(any(UserSettings.class))).thenReturn(savedSettings);

        SettingsPreferencesResponse response = settingsService.getSettings("traveler@example.com");

        assertThat(response.notifications().tripReminders()).isTrue();
        assertThat(response.notifications().budgetAlerts()).isTrue();
        assertThat(response.notifications().bookingUpdates()).isFalse();
        assertThat(response.defaultCalendarView()).isEqualTo("monthly");
        assertThat(response.privacy().shareTripData()).isFalse();
        assertThat(response.privacy().allowAnalytics()).isTrue();
        verify(settingsRepository).save(any(UserSettings.class));
    }

    @Test
    void updateSettingsPersistsNormalizedValues() {
        AppUser user = user("traveler@example.com");
        UserSettings settings = settings(user);
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(settingsRepository.findByOwnerEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(settings));
        when(settingsRepository.save(settings)).thenReturn(settings);

        UpdateSettingsRequest request = new UpdateSettingsRequest(
                new NotificationSettingsRequest(false, true, true),
                " WEEKLY ",
                new PrivacySettingsRequest(true, false)
        );

        SettingsPreferencesResponse response = settingsService.updateSettings("traveler@example.com", request);

        assertThat(settings.isTripReminders()).isFalse();
        assertThat(settings.isBudgetAlerts()).isTrue();
        assertThat(settings.isBookingUpdates()).isTrue();
        assertThat(settings.getDefaultCalendarView()).isEqualTo("weekly");
        assertThat(settings.isShareTripData()).isTrue();
        assertThat(settings.isAllowAnalytics()).isFalse();
        assertThat(response.defaultCalendarView()).isEqualTo("weekly");
        verify(settingsRepository).save(settings);
        verify(budgetAlertNotificationService).evaluateForUser(user);
        verifyNoInteractions(tripReminderService);
    }

    @Test
    void updateSettingsEvaluatesTripRemindersWhenTurnedBackOn() {
        AppUser user = user("traveler@example.com");
        UserSettings settings = settings(user);
        settings.setTripReminders(false);
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(settingsRepository.findByOwnerEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(settings));
        when(settingsRepository.save(settings)).thenReturn(settings);

        UpdateSettingsRequest request = new UpdateSettingsRequest(
                new NotificationSettingsRequest(true, true, true),
                "monthly",
                new PrivacySettingsRequest(false, true)
        );

        settingsService.updateSettings("traveler@example.com", request);

        verify(tripReminderService).evaluateForUser(user);
        verify(budgetAlertNotificationService).evaluateForUser(user);
    }

    @Test
    void updateSettingsAcceptsMonthlyCalendarView() {
        AppUser user = user("traveler@example.com");
        UserSettings settings = settings(user);
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(settingsRepository.findByOwnerEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(settings));
        when(settingsRepository.save(settings)).thenReturn(settings);

        UpdateSettingsRequest request = new UpdateSettingsRequest(
                new NotificationSettingsRequest(true, false, false),
                "monthly",
                new PrivacySettingsRequest(false, true)
        );

        SettingsPreferencesResponse response = settingsService.updateSettings("traveler@example.com", request);

        assertThat(settings.getDefaultCalendarView()).isEqualTo("monthly");
        assertThat(response.defaultCalendarView()).isEqualTo("monthly");
        verify(settingsRepository).save(settings);
        verify(budgetAlertNotificationService).evaluateForUser(user);
    }

    @Test
    void updateSettingsRejectsInvalidCalendarViewAndMissingUser() {
        AppUser user = user("traveler@example.com");
        UserSettings settings = settings(user);
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(settingsRepository.findByOwnerEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(settings));

        UpdateSettingsRequest invalidRequest = new UpdateSettingsRequest(
                new NotificationSettingsRequest(true, true, false),
                "yearly",
                new PrivacySettingsRequest(false, true)
        );

        assertThatThrownBy(() -> settingsService.updateSettings("traveler@example.com", invalidRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("monthly or weekly");

        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> settingsService.getSettings("missing@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Authenticated user was not found");
    }

    @Test
    void submitFeedbackSavesFeedbackWithTrimmedTextAndSubmittedTimestampFallback() {
        AppUser user = user("traveler@example.com");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(feedbackRepository.save(any(UserFeedback.class))).thenAnswer(invocation -> {
            UserFeedback feedback = invocation.getArgument(0);
            feedback.setCreatedAt(Instant.parse("2026-07-14T10:00:00Z"));
            return feedback;
        });

        FeedbackRequest request = new FeedbackRequest(5, " ✈️ ", " Great app ", null);

        FeedbackResponse response = settingsService.submitFeedback("traveler@example.com", request);

        assertThat(response.rating()).isEqualTo(5);
        assertThat(response.emoji()).isEqualTo("✈️");
        assertThat(response.message()).isEqualTo("Great app");
        assertThat(response.submittedAt()).isNotNull();
        verify(feedbackRepository).save(any(UserFeedback.class));
    }

    @Test
    void submitFeedbackAllowsExplicitSubmittedTimestampAndRejectsMissingUser() {
        AppUser user = user("traveler@example.com");
        Instant submittedAt = Instant.parse("2026-07-14T09:15:00Z");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(feedbackRepository.save(any(UserFeedback.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FeedbackRequest request = new FeedbackRequest(4, null, null, submittedAt);
        FeedbackResponse response = settingsService.submitFeedback("traveler@example.com", request);

        assertThat(response.submittedAt()).isEqualTo(submittedAt);
        verify(feedbackRepository).save(any(UserFeedback.class));

        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> settingsService.submitFeedback("missing@example.com", request))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private AppUser user(String email) {
        AppUser user = new AppUser();
        user.setEmail(email);
        return user;
    }

    private UserSettings settings(AppUser owner) {
        UserSettings settings = new UserSettings();
        settings.setOwner(owner);
        return settings;
    }

}
