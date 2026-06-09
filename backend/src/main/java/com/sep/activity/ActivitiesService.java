package com.sep.activity;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Serves activity search and detail requests using a cache-first Ticketmaster import strategy.
 *
 * <p>Fresh cached data is preferred for responsiveness. When cache data is missing
 * or stale, the service imports from Ticketmaster and upserts local entities.</p>
 */
@Service
public class ActivitiesService {
    private static final int CACHE_HOURS = 12;
    private static final int DETAIL_CACHE_HOURS = 24;
    private static final String DEFAULT_CITY = "Berlin";
    private static final int DEFAULT_PAGE_SIZE = 12;
    private static final int MAX_PAGE_SIZE = 40;

    private final ActivityRepository activityRepository;
    private final TicketmasterImportService ticketmasterImportService;
    private final ActivityMapper activityMapper;

    public ActivitiesService(
            ActivityRepository activityRepository,
            TicketmasterImportService ticketmasterImportService,
            ActivityMapper activityMapper
    ) {
        this.activityRepository = activityRepository;
        this.ticketmasterImportService = ticketmasterImportService;
        this.activityMapper = activityMapper;
    }

    /**
     * Returns a paged activity search result for a city or recent global activity cache.
     *
     * @param city optional city filter; blank or "All Cities" searches recent cached items
     * @param keyword optional keyword matched against core event and venue fields
     * @param page zero-based page index, clamped to non-negative values
     * @param size requested page size, clamped to service limits
     * @return DTO page with a has-more indicator
     */
    @Transactional
    public ActivitySearchResponse getActivities(String city, String keyword, Integer page, Integer size) {
        int safePage = Math.max(page == null ? 0 : page, 0);
        int safeSize = Math.min(Math.max(size == null ? DEFAULT_PAGE_SIZE : size, 1), MAX_PAGE_SIZE);

        ActivityEntityPage pageResult =
                city == null || city.isBlank() || "All Cities".equalsIgnoreCase(city)
                        ? getLatestActivities(keyword, safePage, safeSize)
                        : getActivitiesForCity(city.trim(), keyword, safePage, safeSize);

        List<ActivityDto> items = pageResult.activities().stream()
                .map(activityMapper::toDto)
                .toList();

        return new ActivitySearchResponse(items, safePage, safeSize, pageResult.hasMore());
    }

    /**
     * Loads a single activity detail, refreshing from Ticketmaster when cached
     * detail data is absent or stale.
     *
     * @param id Ticketmaster external event id
     * @return activity details if found locally or remotely
     */
    @Transactional
    public Optional<ActivityDto> getActivityById(String id) {
        Optional<ActivityEntity> existingOptional = activityRepository.findByExternalId(id);

        if (existingOptional.isPresent() && isDetailFresh(existingOptional.get())) {
            return existingOptional.map(activityMapper::toDto);
        }

        ActivityEntity imported = ticketmasterImportService.importByExternalId(id);

        if (imported == null) {
            return existingOptional.map(activityMapper::toDto);
        }

        ActivityEntity saved = saveOrUpdate(imported);
        return Optional.of(activityMapper.toDto(saved));
    }

    /**
     * Retrieves the latest stored activities and bootstraps the default city cache when empty.
     */
    private ActivityEntityPage getLatestActivities(String keyword, int page, int size) {
        List<ActivityEntity> latestActivities = activityRepository.findTop80ByOrderByFetchedAtDesc();
        List<ActivityEntity> latestMatches = filterByKeyword(latestActivities, keyword);

        if (!latestActivities.isEmpty()) {
            return paginate(latestMatches, page, size);
        }

        ensureImportConfigured();

        ActivityImportBatch imported = importAndSaveCity(DEFAULT_CITY, keyword, page, size);
        if (!imported.getActivities().isEmpty()) {
            return new ActivityEntityPage(imported.getActivities(), imported.isHasMore());
        }

        return new ActivityEntityPage(Collections.emptyList(), false);
    }

    /**
     * Uses fresh city cache when possible, then imports, then falls back to older stored data.
     */
    private ActivityEntityPage getActivitiesForCity(String city, String keyword, int page, int size) {
        LocalDateTime freshAfter = LocalDateTime.now().minusHours(CACHE_HOURS);

        List<ActivityEntity> freshActivities =
                activityRepository.findByCityIgnoreCaseAndFetchedAtAfterOrderByStartDateAsc(city, freshAfter);
        List<ActivityEntity> freshMatches = filterByKeyword(freshActivities, keyword);

        if (!freshActivities.isEmpty()) {
            ActivityEntityPage freshPage = paginate(freshMatches, page, size);

            if (!freshPage.activities().isEmpty() || page == 0) {
                return freshPage;
            }
        }

        ensureImportConfigured();

        ActivityImportBatch imported = importAndSaveCity(city, keyword, page, size);
        if (!imported.getActivities().isEmpty()) {
            return new ActivityEntityPage(imported.getActivities(), imported.isHasMore());
        }

        List<ActivityEntity> storedActivities = activityRepository.findByCityIgnoreCaseOrderByStartDateAsc(city);
        List<ActivityEntity> storedMatches = filterByKeyword(storedActivities, keyword);
        if (!storedActivities.isEmpty()) {
            ActivityEntityPage storedPage = paginate(storedMatches, page, size);

            if (!storedPage.activities().isEmpty() || page == 0) {
                return storedPage;
            }
        }

        return new ActivityEntityPage(Collections.emptyList(), false);
    }

    private ActivityImportBatch importAndSaveCity(String city, String keyword, int page, int size) {
        ActivityImportBatch imported = ticketmasterImportService.importByCity(city, keyword, page, size);

        List<ActivityEntity> saved = imported.getActivities().stream()
                .map(this::saveOrUpdate)
                .toList();

        return new ActivityImportBatch(saved, imported.isHasMore());
    }

    private void ensureImportConfigured() {
        if (!ticketmasterImportService.isConfigured()) {
            throw new ActivitiesConfigurationException(
                    "Activities search is not configured on the backend. Add TICKETMASTER_API_KEY to backend/.env and restart the backend."
            );
        }
    }

    /**
     * Upserts imported activities so repeat imports refresh provider data instead of duplicating rows.
     */
    private ActivityEntity saveOrUpdate(ActivityEntity incoming) {
        Optional<ActivityEntity> existingOptional = activityRepository.findByExternalId(incoming.getExternalId());

        if (existingOptional.isEmpty()) {
            return activityRepository.save(incoming);
        }

        ActivityEntity existing = existingOptional.get();

        existing.setTitle(incoming.getTitle());
        existing.setType(incoming.getType());
        existing.setUrl(incoming.getUrl());
        existing.setLocale(incoming.getLocale());
        existing.setSource(incoming.getSource());
        existing.setCity(incoming.getCity());
        existing.setCountry(incoming.getCountry());
        existing.setState(incoming.getState());
        existing.setCategory(incoming.getCategory());
        existing.setSegment(incoming.getSegment());
        existing.setGenre(incoming.getGenre());
        existing.setSubGenre(incoming.getSubGenre());
        existing.setPriceLevel(incoming.getPriceLevel());
        existing.setPriceCurrency(incoming.getPriceCurrency());
        existing.setPrice(incoming.getPrice());
        existing.setMinPrice(incoming.getMinPrice());
        existing.setMaxPrice(incoming.getMaxPrice());
        existing.setRating(incoming.getRating());
        existing.setTimeOfDay(incoming.getTimeOfDay());
        existing.setDuration(incoming.getDuration());
        existing.setVenue(incoming.getVenue());
        existing.setVenueId(incoming.getVenueId());
        existing.setVenueUrl(incoming.getVenueUrl());
        existing.setVenueTimezone(incoming.getVenueTimezone());
        existing.setVenueAddress(incoming.getVenueAddress());
        existing.setVenuePostalCode(incoming.getVenuePostalCode());
        existing.setVenueLatitude(incoming.getVenueLatitude());
        existing.setVenueLongitude(incoming.getVenueLongitude());
        existing.setDescription(incoming.getDescription());
        existing.setInfo(incoming.getInfo());
        existing.setPleaseNote(incoming.getPleaseNote());
        existing.setImage(incoming.getImage());
        existing.setSeatmapUrl(incoming.getSeatmapUrl());
        existing.setAccessibilityInfo(incoming.getAccessibilityInfo());
        existing.setTicketLimitInfo(incoming.getTicketLimitInfo());
        existing.setStatus(incoming.getStatus());
        existing.setPromoterName(incoming.getPromoterName());
        existing.setPromoterDescription(incoming.getPromoterDescription());
        existing.setFeatured(incoming.getFeatured());
        existing.setTba(incoming.getTba());
        existing.setTbd(incoming.getTbd());
        existing.setSpanMultipleDays(incoming.getSpanMultipleDays());
        existing.setStartDate(incoming.getStartDate());
        existing.setEndDate(incoming.getEndDate());
        existing.setSalesStartDate(incoming.getSalesStartDate());
        existing.setSalesEndDate(incoming.getSalesEndDate());
        existing.setSalesJson(incoming.getSalesJson());
        existing.setPriceRangesJson(incoming.getPriceRangesJson());
        existing.setImagesJson(incoming.getImagesJson());
        existing.setVenueDetailsJson(incoming.getVenueDetailsJson());
        existing.setAttractionsJson(incoming.getAttractionsJson());
        existing.setClassificationsJson(incoming.getClassificationsJson());
        existing.setPromoterJson(incoming.getPromoterJson());
        existing.setPromotersJson(incoming.getPromotersJson());
        existing.setOutletsJson(incoming.getOutletsJson());
        existing.setProductsJson(incoming.getProductsJson());
        existing.setRawEventJson(incoming.getRawEventJson());
        existing.setFetchedAt(incoming.getFetchedAt());

        if (incoming.getDetailFetchedAt() != null) {
            existing.setDetailFetchedAt(incoming.getDetailFetchedAt());
        }

        return activityRepository.save(existing);
    }

    private List<ActivityEntity> filterByKeyword(List<ActivityEntity> activities, String keyword) {
        return activities.stream()
                .filter(activity -> matchesKeyword(activity, keyword))
                .toList();
    }

    /**
     * Applies keyword matching across the main searchable activity fields.
     */
    private boolean matchesKeyword(ActivityEntity activity, String keyword) {
        if (!hasSearchKeyword(keyword)) {
            return true;
        }

        String search = keyword.trim().toLowerCase();

        return contains(activity.getTitle(), search)
                || contains(activity.getCity(), search)
                || contains(activity.getCountry(), search)
                || contains(activity.getCategory(), search)
                || contains(activity.getSegment(), search)
                || contains(activity.getGenre(), search)
                || contains(activity.getSubGenre(), search)
                || contains(activity.getVenue(), search)
                || contains(activity.getDescription(), search)
                || contains(activity.getInfo(), search)
                || contains(activity.getPleaseNote(), search)
                || contains(activity.getPromoterName(), search);
    }

    private boolean hasSearchKeyword(String keyword) {
        return keyword != null && !keyword.isBlank();
    }

    private boolean contains(String value, String search) {
        return value != null && value.toLowerCase().contains(search);
    }

    private boolean isDetailFresh(ActivityEntity entity) {
        if (entity.getDetailFetchedAt() == null) {
            return false;
        }

        return entity.getDetailFetchedAt().isAfter(LocalDateTime.now().minusHours(DETAIL_CACHE_HOURS));
    }

    private ActivityEntityPage paginate(List<ActivityEntity> activities, int page, int size) {
        int fromIndex = page * size;

        if (fromIndex >= activities.size()) {
            return new ActivityEntityPage(Collections.emptyList(), false);
        }

        int toIndex = Math.min(fromIndex + size, activities.size());
        boolean hasMore = toIndex < activities.size();

        return new ActivityEntityPage(activities.subList(fromIndex, toIndex), hasMore);
    }

    private record ActivityEntityPage(List<ActivityEntity> activities, boolean hasMore) {
    }
}
