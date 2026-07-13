package com.sep.profile;

import com.sep.profile.dto.ChangePasswordRequest;
import com.sep.profile.dto.DeleteAccountRequest;
import com.sep.profile.dto.ProfileResponse;
import com.sep.profile.dto.UpdateProfileRequest;
import com.sep.settings.UserFeedbackRepository;
import com.sep.settings.UserSettingsRepository;
import com.sep.trip.TripRepository;
import com.sep.tripplanning.TripPlanningRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class ProfileService {

    private static final long MAX_PROFILE_IMAGE_BYTES = 2L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );
    private static final List<String> ALLOWED_ACHIEVEMENTS = List.of(
            "BEACH_LOVER",
            "MOUNTAIN_EXPLORER",
            "FREQUENT_FLYER",
            "WORLD_TRAVELER",
            "CULTURE_SEEKER",
            "FOOD_EXPLORER",
            "BACKPACKER",
            "RELAXATION_TRAVELER",
            "TRAVEL_PHOTOGRAPHER",
            "NATURE_EXPLORER"
    );

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TripRepository tripRepository;
    private final TripPlanningRepository tripPlanningRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final UserFeedbackRepository userFeedbackRepository;

    public ProfileService(
            AppUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            TripRepository tripRepository,
            TripPlanningRepository tripPlanningRepository,
            UserSettingsRepository userSettingsRepository,
            UserFeedbackRepository userFeedbackRepository
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tripRepository = tripRepository;
        this.tripPlanningRepository = tripPlanningRepository;
        this.userSettingsRepository = userSettingsRepository;
        this.userFeedbackRepository = userFeedbackRepository;
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(String authenticatedEmail) {
        return toResponse(findCurrentUser(authenticatedEmail));
    }

    @Transactional
    public ProfileResponse updateProfile(String authenticatedEmail, UpdateProfileRequest request) {
        AppUser user = findCurrentUser(authenticatedEmail);
        String username = request.username().trim();

        userRepository.findByUsernameIgnoreCase(username)
                .filter(existingUser -> !existingUser.getId().equals(user.getId()))
                .ifPresent(existingUser -> {
                    throw new IllegalArgumentException("Username is already taken.");
                });

        user.setUsername(username);
        user.setFirstName(cleanOptionalText(request.firstName()));
        user.setLastName(cleanOptionalText(request.lastName()));
        user.setPhoneNumber(cleanOptionalText(request.phoneNumber()));
        if (StringUtils.hasText(request.passportNumber())) {
            user.setPassportNumber(cleanOptionalText(request.passportNumber()));
        }
        user.setTravelAchievements(joinAchievements(normalizeAchievements(request.travelAchievements())));
        user.setHomeAirport(normalizeAirport(request.homeAirport()));

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public ProfileResponse uploadProfilePicture(String authenticatedEmail, MultipartFile file) {
        AppUser user = findCurrentUser(authenticatedEmail);
        validateProfilePicture(file);

        try {
            user.setProfilePicture(file.getBytes());
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read the uploaded image.");
        }

        user.setProfilePictureContentType(file.getContentType().toLowerCase(Locale.ROOT));
        user.setProfilePictureUpdatedAt(LocalDateTime.now());

        return toResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public Optional<ProfilePictureData> getProfilePicture(String authenticatedEmail) {
        AppUser user = findCurrentUser(authenticatedEmail);

        if (user.getProfilePicture() == null || user.getProfilePicture().length == 0) {
            return Optional.empty();
        }

        return Optional.of(new ProfilePictureData(
                user.getProfilePicture(),
                user.getProfilePictureContentType(),
                user.getProfilePictureUpdatedAt()
        ));
    }

    @Transactional
    public ProfileResponse deleteProfilePicture(String authenticatedEmail) {
        AppUser user = findCurrentUser(authenticatedEmail);
        user.setProfilePicture(null);
        user.setProfilePictureContentType(null);
        user.setProfilePictureUpdatedAt(null);

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void changePassword(String authenticatedEmail, ChangePasswordRequest request) {
        AppUser user = findCurrentUser(authenticatedEmail);

        assertCurrentPassword(user, request.currentPassword());

        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new IllegalArgumentException("New passwords do not match.");
        }

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Choose a new password that is different from your current password.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    @Transactional
    public void deleteCurrentAccount(String authenticatedEmail, DeleteAccountRequest request) {
        AppUser user = findCurrentUser(authenticatedEmail);
        assertCurrentPassword(user, request.currentPassword());

        // Remove rows that reference the user before deleting the account itself.
        userFeedbackRepository.deleteAllByOwnerId(user.getId());
        userSettingsRepository.deleteByOwnerId(user.getId());
        tripPlanningRepository.deleteAllByUserId(user.getId());
        tripRepository.deleteAllByOwnerId(user.getId());
        userRepository.delete(user);
        userRepository.flush();
    }

    private AppUser findCurrentUser(String authenticatedEmail) {
        return userRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));
    }

    private void assertCurrentPassword(AppUser user, String currentPassword) {
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }
    }

    private void validateProfilePicture(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose an image file to upload.");
        }

        if (file.getSize() > MAX_PROFILE_IMAGE_BYTES) {
            throw new IllegalArgumentException("Profile picture must be 2 MB or smaller.");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Only JPG, PNG, WebP, or GIF images are allowed.");
        }
    }

    private String cleanOptionalText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        return value.trim();
    }

    private String normalizeAirport(String homeAirport) {
        String cleaned = cleanOptionalText(homeAirport);
        return cleaned == null ? null : cleaned.toUpperCase(Locale.ROOT);
    }

    private List<String> normalizeAchievements(List<String> achievements) {
        if (achievements == null || achievements.isEmpty()) {
            return List.of();
        }

        Set<String> allowed = new LinkedHashSet<>(ALLOWED_ACHIEVEMENTS);
        return achievements.stream()
                .filter(StringUtils::hasText)
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .filter(allowed::contains)
                .distinct()
                .toList();
    }

    private String joinAchievements(List<String> achievements) {
        if (achievements.isEmpty()) {
            return null;
        }

        return String.join(",", achievements);
    }

    private List<String> splitAchievements(String achievements) {
        if (!StringUtils.hasText(achievements)) {
            return List.of();
        }

        Set<String> allowed = new LinkedHashSet<>(ALLOWED_ACHIEVEMENTS);
        return Arrays.stream(achievements.split(","))
                .map(String::trim)
                .map(value -> value.toUpperCase(Locale.ROOT))
                .filter(allowed::contains)
                .distinct()
                .toList();
    }

    private ProfileResponse toResponse(AppUser user) {
        boolean hasProfilePicture = user.getProfilePicture() != null && user.getProfilePicture().length > 0;

        return new ProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhoneNumber(),
                user.getPassportNumber(),
                splitAchievements(user.getTravelAchievements()),
                user.getHomeAirport(),
                user.isVerified(),
                hasProfilePicture,
                user.getProfilePictureUpdatedAt()
        );
    }

    public record ProfilePictureData(byte[] bytes, String contentType, LocalDateTime updatedAt) {
    }
}
