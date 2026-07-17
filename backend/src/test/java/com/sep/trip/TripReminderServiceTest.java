package com.sep.trip;

import com.sep.settings.UserSettings;
import com.sep.settings.UserSettingsRepository;
import com.sep.user.AppUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripReminderServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripInvitationRepository tripInvitationRepository;

    @Mock
    private UserSettingsRepository userSettingsRepository;

    @Mock
    private TripReminderNotificationRepository reminderRepository;

    @Mock
    private TripReminderNotificationWebSocketPublisher webSocketPublisher;

    private TripReminderService service;
    private AppUser owner;

    @BeforeEach
    void setUp() {
        service = new TripReminderService(
                tripRepository,
                tripInvitationRepository,
                userSettingsRepository,
                reminderRepository,
                webSocketPublisher,
                Clock.fixed(Instant.parse("2026-07-15T08:00:00Z"), ZoneOffset.UTC)
        );

        owner = user(7L, "owner@example.com");
    }

    @Test
    void createsReminderForTripStartingExactlyTenDaysFromToday() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(tripRepository.findAllByStatusAndStartDate(TripStatus.UPCOMING, LocalDate.of(2026, 7, 25)))
                .thenReturn(List.of(trip));
        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 15)))
                .thenReturn(false);
        when(reminderRepository.saveAndFlush(any(TripReminderNotification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.createDailyTripReminders();

        ArgumentCaptor<TripReminderNotification> reminderCaptor = ArgumentCaptor.forClass(TripReminderNotification.class);
        verify(reminderRepository).saveAndFlush(reminderCaptor.capture());
        assertThat(reminderCaptor.getValue().getTrip()).isEqualTo(trip);
        assertThat(reminderCaptor.getValue().getRecipient()).isEqualTo(owner);
        assertThat(reminderCaptor.getValue().getReminderDate()).isEqualTo(LocalDate.of(2026, 7, 15));
        verify(webSocketPublisher).publishTripReminder(reminderCaptor.getValue());
    }

    @Test
    void createsReminderWhenTripIsCreatedAfterDailySchedulerAlreadyRan() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 15)))
                .thenReturn(false);
        when(reminderRepository.saveAndFlush(any(TripReminderNotification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.evaluateTripForToday(trip);

        ArgumentCaptor<TripReminderNotification> reminderCaptor = ArgumentCaptor.forClass(TripReminderNotification.class);
        verify(reminderRepository).saveAndFlush(reminderCaptor.capture());
        assertThat(reminderCaptor.getValue().getTrip()).isEqualTo(trip);
        assertThat(reminderCaptor.getValue().getRecipient()).isEqualTo(owner);
        assertThat(reminderCaptor.getValue().getReminderDate()).isEqualTo(LocalDate.of(2026, 7, 15));
    }

    @Test
    void createsReminderWhenTripIsUpdatedToBecomeExactlyTenDaysAway() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 15)))
                .thenReturn(false);
        when(reminderRepository.saveAndFlush(any(TripReminderNotification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.evaluateTripForToday(trip);

        verify(reminderRepository).saveAndFlush(any(TripReminderNotification.class));
        verify(webSocketPublisher).publishTripReminder(any(TripReminderNotification.class));
    }

    @Test
    void skipsUserWhenTripRemindersAreDisabled() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));
        UserSettings settings = new UserSettings();
        settings.setOwner(owner);
        settings.setTripReminders(false);

        when(tripRepository.findAllByStatusAndStartDate(TripStatus.UPCOMING, LocalDate.of(2026, 7, 25)))
                .thenReturn(List.of(trip));
        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.of(settings));

        service.createDailyTripReminders();

        verify(reminderRepository, never()).saveAndFlush(any());
        verify(webSocketPublisher, never()).publishTripReminder(any());
    }

    @Test
    void createsReminderAfterTripRemindersAreReEnabled() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip));
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 15)))
                .thenReturn(false);
        when(reminderRepository.saveAndFlush(any(TripReminderNotification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.evaluateForUser(owner);

        verify(reminderRepository).saveAndFlush(any(TripReminderNotification.class));
        verify(webSocketPublisher).publishTripReminder(any(TripReminderNotification.class));
    }

    @Test
    void createsReminderForAcceptedParticipant() {
        AppUser participant = user(9L, "friend@example.com");
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(userSettingsRepository.findByOwnerId(9L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 9L, LocalDate.of(2026, 7, 15)))
                .thenReturn(false);
        when(reminderRepository.saveAndFlush(any(TripReminderNotification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.evaluateTripForRecipientToday(trip, participant);

        ArgumentCaptor<TripReminderNotification> reminderCaptor = ArgumentCaptor.forClass(TripReminderNotification.class);
        verify(reminderRepository).saveAndFlush(reminderCaptor.capture());
        assertThat(reminderCaptor.getValue().getRecipient()).isEqualTo(participant);
    }

    @Test
    void doesNotCreateDuplicateReminderForSameTripRecipientAndDay() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(tripRepository.findAllByStatusAndStartDate(TripStatus.UPCOMING, LocalDate.of(2026, 7, 25)))
                .thenReturn(List.of(trip));
        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 15)))
                .thenReturn(true);

        service.createDailyTripReminders();

        verify(reminderRepository, never()).saveAndFlush(any());
        verify(webSocketPublisher, never()).publishTripReminder(any());
    }

    @Test
    void duplicateProtectionAppliesWhenImmediateEvaluationRunsAfterScheduler() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(tripRepository.findAllByStatusAndStartDate(TripStatus.UPCOMING, LocalDate.of(2026, 7, 25)))
                .thenReturn(List.of(trip));
        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 15)))
                .thenReturn(false, true);
        when(reminderRepository.saveAndFlush(any(TripReminderNotification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.createDailyTripReminders();
        service.evaluateTripForToday(trip);

        verify(reminderRepository, times(1)).saveAndFlush(any(TripReminderNotification.class));
    }

    @Test
    void removesStaleReminderWhenTripDateMovesFartherAway() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 30));

        service.refreshTripForToday(trip);

        verify(reminderRepository).deleteAllByTripId(11L);
        verify(reminderRepository, never()).saveAndFlush(any());
        verify(webSocketPublisher, never()).publishTripReminder(any());
    }

    @Test
    void removesStaleReminderWhenTripDateMovesCloserThanTenDays() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 20));

        service.refreshTripForToday(trip);

        verify(reminderRepository).deleteAllByTripId(11L);
        verify(reminderRepository, never()).saveAndFlush(any());
        verify(webSocketPublisher, never()).publishTripReminder(any());
    }

    @Test
    void removesStaleReminderWhenTripStatusChangesFromUpcoming() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));
        trip.setStatus(TripStatus.PLANNING);

        service.refreshTripForToday(trip);

        verify(reminderRepository).deleteAllByTripId(11L);
        verify(reminderRepository, never()).saveAndFlush(any());
        verify(webSocketPublisher, never()).publishTripReminder(any());
    }

    @Test
    void replacesOlderEligibleReminderWhenTripIsEligibleOnANewReminderDate() {
        TripReminderService nextDayService = new TripReminderService(
                tripRepository,
                tripInvitationRepository,
                userSettingsRepository,
                reminderRepository,
                webSocketPublisher,
                Clock.fixed(Instant.parse("2026-07-16T08:00:00Z"), ZoneOffset.UTC)
        );
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 26));

        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 16)))
                .thenReturn(false);
        when(reminderRepository.saveAndFlush(any(TripReminderNotification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        nextDayService.refreshTripForToday(trip);

        verify(reminderRepository).deleteAllByTripIdAndReminderDateNot(11L, LocalDate.of(2026, 7, 16));
        ArgumentCaptor<TripReminderNotification> reminderCaptor = ArgumentCaptor.forClass(TripReminderNotification.class);
        verify(reminderRepository).saveAndFlush(reminderCaptor.capture());
        assertThat(reminderCaptor.getValue().getReminderDate()).isEqualTo(LocalDate.of(2026, 7, 16));
    }

    @Test
    void duplicateProtectionStillAppliesAfterStaleCleanup() {
        Trip trip = trip(11L, owner, LocalDate.of(2026, 7, 25));

        when(tripInvitationRepository.findAllByTripIdAndStatusOrderByCreatedAtDesc(11L, TripInvitationStatus.ACCEPTED))
                .thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(reminderRepository.existsByTripIdAndRecipientIdAndReminderDate(11L, 7L, LocalDate.of(2026, 7, 15)))
                .thenReturn(true);

        service.refreshTripForToday(trip);

        verify(reminderRepository).deleteAllByTripIdAndReminderDateNot(11L, LocalDate.of(2026, 7, 15));
        verify(reminderRepository, never()).saveAndFlush(any());
        verify(webSocketPublisher, never()).publishTripReminder(any());
    }

    private Trip trip(Long id, AppUser owner, LocalDate startDate) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setName("Summer Trip");
        trip.setDestination("Rome");
        trip.setStartDate(startDate);
        trip.setEndDate(startDate.plusDays(5));
        trip.setBudget(new BigDecimal("1200.00"));
        trip.setStatus(TripStatus.UPCOMING);
        trip.setOwner(owner);
        return trip;
    }

    private AppUser user(Long id, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setUsername(email);
        return user;
    }
}
