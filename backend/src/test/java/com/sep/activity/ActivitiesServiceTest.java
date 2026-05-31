package com.sep.activity;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivitiesServiceTest {

    @Mock
    private ActivityRepository activityRepository;

    @Mock
    private TicketmasterImportService ticketmasterImportService;

    private ActivitiesService activitiesService;

    @BeforeEach
    void setUp() {
        activitiesService = new ActivitiesService(
                activityRepository,
                ticketmasterImportService,
                new ActivityMapper(new ObjectMapper())
        );
    }

    @Test
    void freshCachedCityActivitiesAreReturnedWithoutCallingTicketmaster() {
        ActivityEntity cachedActivity = activity("tm-berlin", "Berlin Jazz Night", "Berlin", "Music");

        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Berlin"),
                any(LocalDateTime.class)
        )).thenReturn(List.of(cachedActivity));

        ActivitySearchResponse response = activitiesService.getActivities("Berlin", null, 0, 12);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getId()).isEqualTo("tm-berlin");
        assertThat(response.getItems().getFirst().getTitle()).isEqualTo("Berlin Jazz Night");
        assertThat(response.isHasMore()).isFalse();
        verifyNoInteractions(ticketmasterImportService);
    }

    @Test
    void emptyCityCacheImportsAndPersistsTicketmasterActivities() {
        ActivityEntity importedActivity = activity("tm-hamburg", "Hamburg Live", "Hamburg", "Music");
        importedActivity.setPrice(39.50);
        importedActivity.setPriceCurrency("EUR");

        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Hamburg"),
                any(LocalDateTime.class)
        )).thenReturn(List.of());
        when(ticketmasterImportService.isConfigured()).thenReturn(true);
        when(ticketmasterImportService.importByCity("Hamburg", "live", 0, 12))
                .thenReturn(new ActivityImportBatch(List.of(importedActivity), false));
        when(activityRepository.findByExternalId("tm-hamburg")).thenReturn(Optional.empty());
        when(activityRepository.save(importedActivity)).thenReturn(importedActivity);

        ActivitySearchResponse response = activitiesService.getActivities("Hamburg", "live", 0, 12);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getCity()).isEqualTo("Hamburg");
        assertThat(response.getItems().getFirst().getPrice()).isEqualTo(39.50);
        assertThat(response.getItems().getFirst().getPriceCurrency()).isEqualTo("EUR");
        verify(activityRepository).save(importedActivity);
    }

    @Test
    void allCitiesKeywordSearchFiltersAndPaginatesCachedActivities() {
        ActivityEntity jazzNight = activity("tm-jazz", "Jazz Night", "Paris", "Music");
        ActivityEntity footballFinal = activity("tm-football", "Football Final", "Madrid", "Sports");
        ActivityEntity rockArena = activity("tm-rock", "Rock Arena", "London", "Music");

        when(activityRepository.findTop80ByOrderByFetchedAtDesc())
                .thenReturn(List.of(jazzNight, footballFinal, rockArena));

        ActivitySearchResponse response = activitiesService.getActivities("All Cities", "music", 0, 1);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getId()).isEqualTo("tm-jazz");
        assertThat(response.getPage()).isZero();
        assertThat(response.getSize()).isEqualTo(1);
        assertThat(response.isHasMore()).isTrue();
        verifyNoInteractions(ticketmasterImportService);
    }

    @Test
    void freshActivityDetailsAreReturnedWithoutCallingTicketmaster() {
        ActivityEntity cachedActivity = activity("tm-detail", "Cached Detail Event", "Cologne", "Theatre");
        cachedActivity.setDetailFetchedAt(LocalDateTime.now());

        when(activityRepository.findByExternalId("tm-detail")).thenReturn(Optional.of(cachedActivity));

        Optional<ActivityDto> result = activitiesService.getActivityById("tm-detail");

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().getTitle()).isEqualTo("Cached Detail Event");
        verify(ticketmasterImportService, never()).importByExternalId("tm-detail");
    }

    @Test
    void missingApiKeyProducesClearConfigurationErrorWhenNoCacheExists() {
        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Rome"),
                any(LocalDateTime.class)
        )).thenReturn(List.of());
        when(ticketmasterImportService.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> activitiesService.getActivities("Rome", null, 0, 12))
                .isInstanceOf(ActivitiesConfigurationException.class)
                .hasMessageContaining("TICKETMASTER_API_KEY");

        verify(ticketmasterImportService, never()).importByCity("Rome", null, 0, 12);
    }

    private ActivityEntity activity(String id, String title, String city, String category) {
        ActivityEntity activity = new ActivityEntity();
        activity.setExternalId(id);
        activity.setTitle(title);
        activity.setCity(city);
        activity.setCategory(category);
        activity.setFetchedAt(LocalDateTime.now());
        return activity;
    }
}
