package com.sep.activity;

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

    @Mock
    private ActivityMapper activityMapper;

    private ActivitiesService activitiesService;

    @BeforeEach
    void setUp() {
        activitiesService = new ActivitiesService(activityRepository, ticketmasterImportService, activityMapper);
    }

    @Test
    void freshCachedCityActivitiesAreReturnedWithoutCallingTicketmaster() {
        ActivityEntity cachedActivity = activity("tm-berlin", "Berlin Jazz Night", "Berlin", "Music");
        ActivityDto cachedDto = dto("tm-berlin", "Berlin Jazz Night", "Berlin");

        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Berlin"),
                any(LocalDateTime.class)
        )).thenReturn(List.of(cachedActivity));
        when(activityMapper.toDto(cachedActivity)).thenReturn(cachedDto);

        ActivitySearchResponse response = activitiesService.getActivities("Berlin", null, 0, 12);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getId()).isEqualTo("tm-berlin");
        assertThat(response.getItems().getFirst().getTitle()).isEqualTo("Berlin Jazz Night");
        assertThat(response.isHasMore()).isFalse();
        verifyNoInteractions(ticketmasterImportService);
        verify(activityMapper).toDto(cachedActivity);
    }

    @Test
    void blankCityWithInvalidPaginationClampsToLatestSearchAndImportsDefaultCity() {
        ActivityEntity importedActivity = activity("tm-default", "Berlin Live", "Berlin", "Music");
        ActivityDto importedDto = dto("tm-default", "Berlin Live", "Berlin");

        when(activityRepository.findTop80ByOrderByFetchedAtDesc()).thenReturn(List.of());
        when(ticketmasterImportService.isConfigured()).thenReturn(true);
        when(ticketmasterImportService.importByCity("Berlin", null, 0, 40))
                .thenReturn(new ActivityImportBatch(List.of(importedActivity), true));
        when(activityRepository.findByExternalId("tm-default")).thenReturn(Optional.empty());
        when(activityRepository.save(importedActivity)).thenReturn(importedActivity);
        when(activityMapper.toDto(importedActivity)).thenReturn(importedDto);

        ActivitySearchResponse response = activitiesService.getActivities(" ", null, -5, 100);

        assertThat(response.getPage()).isZero();
        assertThat(response.getSize()).isEqualTo(40);
        assertThat(response.isHasMore()).isTrue();
        assertThat(response.getItems()).extracting(ActivityDto::getId).containsExactly("tm-default");
        verify(ticketmasterImportService).importByCity("Berlin", null, 0, 40);
        verify(activityRepository).save(importedActivity);
    }

    @Test
    void allCitiesKeywordSearchFiltersAndPaginatesCachedActivities() {
        ActivityEntity jazzNight = activity("tm-jazz", "Jazz Night", "Paris", "Music");
        ActivityEntity footballFinal = activity("tm-football", "Football Final", "Madrid", "Sports");
        ActivityEntity rockArena = activity("tm-rock", "Rock Arena", "London", "Music");

        when(activityRepository.findTop80ByOrderByFetchedAtDesc())
                .thenReturn(List.of(jazzNight, footballFinal, rockArena));
        when(activityMapper.toDto(jazzNight)).thenReturn(dto("tm-jazz", "Jazz Night", "Paris"));

        ActivitySearchResponse response = activitiesService.getActivities("All Cities", "music", 0, 1);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getId()).isEqualTo("tm-jazz");
        assertThat(response.getPage()).isZero();
        assertThat(response.getSize()).isEqualTo(1);
        assertThat(response.isHasMore()).isTrue();
        verifyNoInteractions(ticketmasterImportService);
    }

    @Test
    void citySearchReturnsEmptyFreshPageWithoutImportWhenPageZeroAndNoKeywordMatches() {
        ActivityEntity cachedActivity = activity("tm-paris", "Paris Museum Night", "Paris", "Culture");
        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Paris"),
                any(LocalDateTime.class)
        )).thenReturn(List.of(cachedActivity));

        ActivitySearchResponse response = activitiesService.getActivities("Paris", "opera", 0, 12);

        assertThat(response.getItems()).isEmpty();
        assertThat(response.isHasMore()).isFalse();
        verifyNoInteractions(ticketmasterImportService);
        verifyNoInteractions(activityMapper);
    }

    @Test
    void citySearchTreatsBlankKeywordLikeNoKeywordAndUsesCachedActivities() {
        ActivityEntity cachedActivity = activity("tm-paris", "Paris Museum Night", "Paris", "Culture");
        ActivityDto cachedDto = dto("tm-paris", "Paris Museum Night", "Paris");

        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Paris"),
                any(LocalDateTime.class)
        )).thenReturn(List.of(cachedActivity));
        when(activityMapper.toDto(cachedActivity)).thenReturn(cachedDto);

        ActivitySearchResponse response = activitiesService.getActivities("Paris", "   ", 0, 12);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getId()).isEqualTo("tm-paris");
        verifyNoInteractions(ticketmasterImportService);
        verify(activityMapper).toDto(cachedActivity);
    }

    @Test
    void citySearchMatchesPromoterNameWhenEarlierFieldsDoNotMatch() {
        ActivityEntity cachedActivity = activity("tm-paris", "Paris Museum Night", "Paris", "Culture");
        cachedActivity.setVenue("Grand Hall");
        cachedActivity.setDescription("Art evening");
        cachedActivity.setInfo("Details");
        cachedActivity.setPleaseNote("Note");
        cachedActivity.setPromoterName("Headline Star");
        ActivityDto cachedDto = dto("tm-paris", "Paris Museum Night", "Paris");

        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Paris"),
                any(LocalDateTime.class)
        )).thenReturn(List.of(cachedActivity));
        when(activityMapper.toDto(cachedActivity)).thenReturn(cachedDto);

        ActivitySearchResponse response = activitiesService.getActivities("Paris", "headline", 0, 12);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getId()).isEqualTo("tm-paris");
        verifyNoInteractions(ticketmasterImportService);
        verify(activityMapper).toDto(cachedActivity);
    }

    @Test
    void citySearchFallsBackToImportWhenFreshPageIsEmptyForLaterPages() {
        ActivityEntity freshActivity = activity("tm-paris", "Paris Museum Night", "Paris", "Culture");
        ActivityEntity importedActivity = activity("tm-paris-imported", "Imported Paris Show", "Paris", "Music");
        ActivityDto importedDto = dto("tm-paris-imported", "Imported Paris Show", "Paris");

        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Paris"),
                any(LocalDateTime.class)
        )).thenReturn(List.of(freshActivity));
        when(ticketmasterImportService.isConfigured()).thenReturn(true);
        when(ticketmasterImportService.importByCity("Paris", null, 1, 12))
                .thenReturn(new ActivityImportBatch(List.of(importedActivity), false));
        when(activityRepository.findByExternalId("tm-paris-imported")).thenReturn(Optional.empty());
        when(activityRepository.save(importedActivity)).thenReturn(importedActivity);
        when(activityMapper.toDto(importedActivity)).thenReturn(importedDto);

        ActivitySearchResponse response = activitiesService.getActivities("Paris", null, 1, 12);

        assertThat(response.getItems()).extracting(ActivityDto::getId).containsExactly("tm-paris-imported");
        verify(ticketmasterImportService).importByCity("Paris", null, 1, 12);
        verify(activityRepository).save(importedActivity);
    }

    @Test
    void citySearchFallsBackToStoredCacheWhenFreshAndImportedDataAreEmpty() {
        ActivityEntity storedActivity = activity("tm-rome", "Rome Opera", "Rome", "Culture");
        ActivityDto storedDto = dto("tm-rome", "Rome Opera", "Rome");

        when(activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(
                eq("Rome"),
                any(LocalDateTime.class)
        )).thenReturn(List.of());
        when(ticketmasterImportService.isConfigured()).thenReturn(true);
        when(ticketmasterImportService.importByCity("Rome", null, 0, 12))
                .thenReturn(new ActivityImportBatch(List.of(), false));
        when(activityRepository.findByCityIgnoreCaseOrderByStartDateAsc("Rome")).thenReturn(List.of(storedActivity));
        when(activityMapper.toDto(storedActivity)).thenReturn(storedDto);

        ActivitySearchResponse response = activitiesService.getActivities("Rome", null, 0, 12);

        assertThat(response.getItems()).extracting(ActivityDto::getId).containsExactly("tm-rome");
        verify(ticketmasterImportService).importByCity("Rome", null, 0, 12);
        verify(activityMapper).toDto(storedActivity);
    }

    @Test
    void emptyLatestCacheImportsAndPersistsTicketmasterActivities() {
        ActivityEntity importedActivity = activity("tm-hamburg", "Hamburg Live", "Hamburg", "Music");
        ActivityDto importedDto = dto("tm-hamburg", "Hamburg Live", "Hamburg");

        when(activityRepository.findTop80ByOrderByFetchedAtDesc()).thenReturn(List.of());
        when(ticketmasterImportService.isConfigured()).thenReturn(true);
        when(ticketmasterImportService.importByCity("Berlin", "live", 0, 12))
                .thenReturn(new ActivityImportBatch(List.of(importedActivity), false));
        when(activityRepository.findByExternalId("tm-hamburg")).thenReturn(Optional.empty());
        when(activityRepository.save(importedActivity)).thenReturn(importedActivity);
        when(activityMapper.toDto(importedActivity)).thenReturn(importedDto);

        ActivitySearchResponse response = activitiesService.getActivities(null, "live", 0, 12);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getCity()).isEqualTo("Hamburg");
        verify(activityRepository).save(importedActivity);
        verify(activityMapper).toDto(importedActivity);
    }

    @Test
    void emptyLatestCacheReturnsEmptyWhenImportProducesNoActivities() {
        when(activityRepository.findTop80ByOrderByFetchedAtDesc()).thenReturn(List.of());
        when(ticketmasterImportService.isConfigured()).thenReturn(true);
        when(ticketmasterImportService.importByCity("Berlin", null, 0, 12))
                .thenReturn(new ActivityImportBatch(List.of(), false));

        ActivitySearchResponse response = activitiesService.getActivities(null, null, 0, 12);

        assertThat(response.getItems()).isEmpty();
        assertThat(response.isHasMore()).isFalse();
        verifyNoInteractions(activityMapper);
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

    @Test
    void freshActivityDetailsAreReturnedWithoutCallingTicketmaster() {
        ActivityEntity cachedActivity = activity("tm-detail", "Cached Detail Event", "Cologne", "Theatre");
        cachedActivity.setDetailFetchedAt(LocalDateTime.now());
        ActivityDto cachedDto = dto("tm-detail", "Cached Detail Event", "Cologne");

        when(activityRepository.findByExternalId("tm-detail")).thenReturn(Optional.of(cachedActivity));
        when(activityMapper.toDto(cachedActivity)).thenReturn(cachedDto);

        Optional<ActivityDto> result = activitiesService.getActivityById("tm-detail");

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().getTitle()).isEqualTo("Cached Detail Event");
        verify(ticketmasterImportService, never()).importByExternalId("tm-detail");
    }

    @Test
    void staleCachedActivityFallsBackToExistingDetailsWhenImportFails() {
        ActivityEntity cachedActivity = activity("tm-stale", "Stale Detail Event", "Cologne", "Theatre");
        ActivityDto cachedDto = dto("tm-stale", "Stale Detail Event", "Cologne");

        when(activityRepository.findByExternalId("tm-stale")).thenReturn(Optional.of(cachedActivity));
        when(ticketmasterImportService.importByExternalId("tm-stale")).thenReturn(null);
        when(activityMapper.toDto(cachedActivity)).thenReturn(cachedDto);

        Optional<ActivityDto> result = activitiesService.getActivityById("tm-stale");

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().getId()).isEqualTo("tm-stale");
        verify(activityMapper).toDto(cachedActivity);
        verify(activityRepository, never()).save(any());
    }

    @Test
    void staleCachedActivityIsRefreshedAndSavedWhenImportSucceeds() {
        ActivityEntity existingActivity = activity("tm-refresh", "Old Title", "Berlin", "Music");
        ActivityEntity importedActivity = activity("tm-refresh", "New Title", "Berlin", "Sports");
        importedActivity.setVenue("Updated Venue");
        importedActivity.setDescription("Updated description");
        importedActivity.setDetailFetchedAt(LocalDateTime.now());
        ActivityDto refreshedDto = dto("tm-refresh", "New Title", "Berlin");

        when(activityRepository.findByExternalId("tm-refresh"))
                .thenReturn(Optional.of(existingActivity), Optional.of(existingActivity));
        when(ticketmasterImportService.importByExternalId("tm-refresh")).thenReturn(importedActivity);
        when(activityRepository.save(existingActivity)).thenReturn(existingActivity);
        when(activityMapper.toDto(existingActivity)).thenReturn(refreshedDto);

        Optional<ActivityDto> result = activitiesService.getActivityById("tm-refresh");

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().getTitle()).isEqualTo("New Title");
        assertThat(existingActivity.getTitle()).isEqualTo("New Title");
        assertThat(existingActivity.getVenue()).isEqualTo("Updated Venue");
        assertThat(existingActivity.getDescription()).isEqualTo("Updated description");
        verify(activityRepository).save(existingActivity);
        verify(activityMapper).toDto(existingActivity);
    }

    @Test
    void missingActivityReturnsEmptyWhenImportFailsAndNothingExistsLocally() {
        when(activityRepository.findByExternalId("tm-missing")).thenReturn(Optional.empty());
        when(ticketmasterImportService.importByExternalId("tm-missing")).thenReturn(null);

        Optional<ActivityDto> result = activitiesService.getActivityById("tm-missing");

        assertThat(result).isEmpty();
        verifyNoInteractions(activityMapper);
        verify(activityRepository, never()).save(any());
    }

    @Test
    void directRepositorySaveResultIsMappedWhenExistingEntityIsUpdated() {
        ActivityEntity existingActivity = activity("tm-direct", "Direct Old", "Munich", "Culture");
        ActivityEntity importedActivity = activity("tm-direct", "Direct New", "Munich", "Culture");
        importedActivity.setDetailFetchedAt(LocalDateTime.now());
        ActivityDto dto = dto("tm-direct", "Direct New", "Munich");

        when(activityRepository.findByExternalId("tm-direct"))
                .thenReturn(Optional.of(existingActivity), Optional.of(existingActivity));
        when(ticketmasterImportService.importByExternalId("tm-direct")).thenReturn(importedActivity);
        when(activityRepository.save(existingActivity)).thenReturn(existingActivity);
        when(activityMapper.toDto(existingActivity)).thenReturn(dto);

        Optional<ActivityDto> result = activitiesService.getActivityById("tm-direct");

        assertThat(result).isPresent();
        verify(activityRepository).save(existingActivity);
        verify(activityMapper).toDto(existingActivity);
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

    private ActivityDto dto(String id, String title, String city) {
        ActivityDto dto = new ActivityDto();
        dto.setId(id);
        dto.setTitle(title);
        dto.setCity(city);
        return dto;
    }
}
