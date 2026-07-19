package com.sep.budget;

import com.sep.settings.UserSettings;
import com.sep.settings.UserSettingsRepository;
import com.sep.trip.Trip;
import com.sep.trip.TripInvitationRepository;
import com.sep.trip.TripRepository;
import com.sep.trip.TripStatus;
import com.sep.user.AppUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.any;

@ExtendWith(MockitoExtension.class)
class BudgetAlertNotificationServiceTest {

    @Mock
    private BudgetAlertNotificationRepository alertRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripInvitationRepository tripInvitationRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private UserSettingsRepository userSettingsRepository;

    @Mock
    private BudgetRealtimeWebSocketPublisher budgetRealtimeWebSocketPublisher;

    private BudgetAlertNotificationService service;
    private AppUser user;

    @BeforeEach
    void setUp() {
        service = new BudgetAlertNotificationService(
                alertRepository,
                tripRepository,
                tripInvitationRepository,
                expenseRepository,
                userSettingsRepository,
                budgetRealtimeWebSocketPublisher
        );
        user = new AppUser();
        user.setId(7L);
        user.setEmail("traveler@example.com");
    }

    @Test
    void createsOneStableAlertWhenUserIsOverBudget() {
        Trip trip = trip("1000.00");
        trip.setFlightTotal(new BigDecimal("1200.00"));

        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip));
        when(expenseRepository.findAllByTripIdInOrderByDateDesc(List.of(11L))).thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(alertRepository.findByRecipientIdAndAlertKey(7L, BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY))
                .thenReturn(Optional.empty());

        service.evaluateForUser(user);

        ArgumentCaptor<BudgetAlertNotification> alertCaptor = ArgumentCaptor.forClass(BudgetAlertNotification.class);
        verify(alertRepository).save(alertCaptor.capture());
        BudgetAlertNotification alert = alertCaptor.getValue();
        assertThat(alert.getRecipient()).isEqualTo(user);
        assertThat(alert.getAlertKey()).isEqualTo(BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY);
        assertThat(alert.isActive()).isTrue();
        assertThat(alert.getTotalBudget()).isEqualByComparingTo("1000.00");
        assertThat(alert.getTotalSpent()).isEqualByComparingTo("1200.00");
        verify(budgetRealtimeWebSocketPublisher).publishBudgetAlert(alert);
    }

    @Test
    void updatesExistingAlertInsteadOfCreatingDuplicate() {
        Trip trip = trip("1000.00");
        trip.setHotelTotal(new BigDecimal("1300.00"));
        BudgetAlertNotification existing = new BudgetAlertNotification();
        existing.setRecipient(user);
        existing.setAlertKey(BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY);

        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip));
        when(expenseRepository.findAllByTripIdInOrderByDateDesc(List.of(11L))).thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(alertRepository.findByRecipientIdAndAlertKey(7L, BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY))
                .thenReturn(Optional.of(existing));

        service.evaluateForUser(user);

        verify(alertRepository).save(existing);
        verify(budgetRealtimeWebSocketPublisher).publishBudgetAlert(existing);
        assertThat(existing.isActive()).isTrue();
        assertThat(existing.getTotalSpent()).isEqualByComparingTo("1300.00");
        assertThat(existing.getUpdatedAt()).isNotNull();
    }

    @Test
    void resolvesExistingAlertWhenSpendingReturnsBelowBudget() {
        Trip trip = trip("1000.00");
        trip.setHotelTotal(new BigDecimal("300.00"));
        BudgetAlertNotification existing = new BudgetAlertNotification();
        existing.setRecipient(user);
        existing.setAlertKey(BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY);
        existing.setActive(true);

        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip));
        when(expenseRepository.findAllByTripIdInOrderByDateDesc(List.of(11L))).thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(alertRepository.findByRecipientIdAndAlertKey(7L, BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY))
                .thenReturn(Optional.of(existing));

        service.evaluateForUser(user);

        assertThat(existing.isActive()).isFalse();
        assertThat(existing.getResolvedAt()).isNotNull();
        verify(alertRepository).save(existing);
        verify(budgetRealtimeWebSocketPublisher, never()).publishBudgetAlert(any());
    }

    @Test
    void resolvesActiveAlertWhenBudgetAlertsAreDisabled() {
        BudgetAlertNotification existing = new BudgetAlertNotification();
        existing.setRecipient(user);
        existing.setAlertKey(BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY);
        existing.setActive(true);
        UserSettings settings = new UserSettings();
        settings.setBudgetAlerts(false);

        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip("1000.00")));
        when(expenseRepository.findAllByTripIdInOrderByDateDesc(List.of(11L))).thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.of(settings));
        when(alertRepository.findByRecipientIdAndAlertKey(7L, BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY))
                .thenReturn(Optional.of(existing));

        service.evaluateForUser(user);

        assertThat(existing.isActive()).isFalse();
        assertThat(existing.getResolvedAt()).isNotNull();
        verify(alertRepository).save(existing);
        verify(budgetRealtimeWebSocketPublisher, never()).publishBudgetAlert(any());
    }

    @Test
    void doesNotCreateAlertWhenSpentEqualsBudget() {
        Trip trip = trip("1000.00");
        trip.setActivitiesTotal(new BigDecimal("1000.00"));

        when(tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(7L)).thenReturn(List.of(trip));
        when(expenseRepository.findAllByTripIdInOrderByDateDesc(List.of(11L))).thenReturn(List.of());
        when(userSettingsRepository.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(alertRepository.findByRecipientIdAndAlertKey(7L, BudgetAlertNotificationService.GLOBAL_OVER_BUDGET_KEY))
                .thenReturn(Optional.empty());

        service.evaluateForUser(user);

        verify(alertRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(budgetRealtimeWebSocketPublisher, never()).publishBudgetAlert(any());
    }

    private Trip trip(String budget) {
        Trip trip = new Trip();
        trip.setId(11L);
        trip.setName("Rome");
        trip.setDestination("Rome");
        trip.setStartDate(LocalDate.of(2026, 7, 15));
        trip.setEndDate(LocalDate.of(2026, 7, 22));
        trip.setBudget(new BigDecimal(budget));
        trip.setStatus(TripStatus.UPCOMING);
        trip.setOwner(user);
        return trip;
    }
}
