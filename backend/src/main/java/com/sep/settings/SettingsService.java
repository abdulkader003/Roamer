package com.sep.settings;

import com.sep.budget.BudgetAlertNotificationService;
import com.sep.settings.dto.FeedbackRequest;
import com.sep.settings.dto.FeedbackResponse;
import com.sep.settings.dto.NotificationSettingsResponse;
import com.sep.settings.dto.PrivacySettingsResponse;
import com.sep.settings.dto.SettingsPreferencesResponse;
import com.sep.settings.dto.UpdateSettingsRequest;
import com.sep.trip.TripReminderService;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Locale;

@Service
public class SettingsService {

    private final AppUserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final UserFeedbackRepository feedbackRepository;
    private final BudgetAlertNotificationService budgetAlertNotificationService;
    private final TripReminderService tripReminderService;

    public SettingsService(
            AppUserRepository userRepository,
            UserSettingsRepository settingsRepository,
            UserFeedbackRepository feedbackRepository,
            BudgetAlertNotificationService budgetAlertNotificationService,
            TripReminderService tripReminderService
    ) {
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.feedbackRepository = feedbackRepository;
        this.budgetAlertNotificationService = budgetAlertNotificationService;
        this.tripReminderService = tripReminderService;
    }

    @Transactional
    public SettingsPreferencesResponse getSettings(String authenticatedEmail) {
        AppUser user = findCurrentUser(authenticatedEmail);
        return toResponse(findOrCreateSettings(user));
    }

    @Transactional
    public SettingsPreferencesResponse updateSettings(String authenticatedEmail, UpdateSettingsRequest request) {
        AppUser user = findCurrentUser(authenticatedEmail);
        UserSettings settings = findOrCreateSettings(user);
        boolean wasTripRemindersEnabled = settings.isTripReminders();

        settings.setTripReminders(request.notifications().tripReminders());
        settings.setBudgetAlerts(request.notifications().budgetAlerts());
        settings.setBookingUpdates(request.notifications().bookingUpdates());
        settings.setDefaultCalendarView(normalizeCalendarView(request.defaultCalendarView()));
        settings.setShareTripData(request.privacy().shareTripData());
        settings.setAllowAnalytics(request.privacy().allowAnalytics());

        UserSettings savedSettings = settingsRepository.save(settings);
        budgetAlertNotificationService.evaluateForUser(user);
        if (!wasTripRemindersEnabled && savedSettings.isTripReminders()) {
            tripReminderService.evaluateForUser(user);
        }
        return toResponse(savedSettings);
    }

    @Transactional
    public FeedbackResponse submitFeedback(String authenticatedEmail, FeedbackRequest request) {
        UserFeedback feedback = new UserFeedback();
        feedback.setOwner(findCurrentUser(authenticatedEmail));
        feedback.setRating(request.rating());
        feedback.setEmoji(cleanOptionalText(request.emoji()));
        feedback.setMessage(cleanOptionalText(request.message()));
        feedback.setSubmittedAt(request.submittedAt() == null ? Instant.now() : request.submittedAt());

        return toResponse(feedbackRepository.save(feedback));
    }

    private UserSettings findOrCreateSettings(AppUser user) {
        return settingsRepository.findByOwnerEmailIgnoreCase(user.getEmail())
                .orElseGet(() -> {
                    UserSettings settings = new UserSettings();
                    settings.setOwner(user);
                    return settingsRepository.save(settings);
                });
    }

    private AppUser findCurrentUser(String authenticatedEmail) {
        return userRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));
    }

    private String normalizeCalendarView(String calendarView) {
        String normalized = calendarView.trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals("monthly") && !normalized.equals("weekly")) {
            throw new IllegalArgumentException("Default calendar view must be monthly or weekly.");
        }

        return normalized;
    }

    private String cleanOptionalText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        return value.trim();
    }

    private SettingsPreferencesResponse toResponse(UserSettings settings) {
        return new SettingsPreferencesResponse(
                new NotificationSettingsResponse(
                        settings.isTripReminders(),
                        settings.isBudgetAlerts(),
                        settings.isBookingUpdates()
                ),
                settings.getDefaultCalendarView(),
                new PrivacySettingsResponse(
                        settings.isShareTripData(),
                        settings.isAllowAnalytics()
                )
        );
    }

    private FeedbackResponse toResponse(UserFeedback feedback) {
        return new FeedbackResponse(
                feedback.getId(),
                feedback.getRating(),
                feedback.getEmoji(),
                feedback.getMessage(),
                feedback.getSubmittedAt()
        );
    }
}
