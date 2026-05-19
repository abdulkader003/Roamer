package com.sep.activities;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class ActivityMapper {
    private final ObjectMapper objectMapper;

    public ActivityMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ActivityDto toDto(ActivityEntity entity) {
        ActivityDto dto = new ActivityDto();

        dto.setId(entity.getExternalId());
        dto.setTitle(valueOrDefault(entity.getTitle(), "Untitled activity"));
        dto.setType(valueOrDefault(entity.getType(), "event"));
        dto.setUrl(valueOrDefault(entity.getUrl(), ""));
        dto.setLocale(valueOrDefault(entity.getLocale(), ""));
        dto.setSource(valueOrDefault(entity.getSource(), ""));
        dto.setCity(valueOrDefault(entity.getCity(), "Unknown city"));
        dto.setCountry(valueOrDefault(entity.getCountry(), "Unknown country"));
        dto.setState(valueOrDefault(entity.getState(), ""));
        dto.setCategory(valueOrDefault(entity.getCategory(), "Miscellaneous"));
        dto.setSegment(valueOrDefault(entity.getSegment(), ""));
        dto.setGenre(valueOrDefault(entity.getGenre(), ""));
        dto.setSubGenre(valueOrDefault(entity.getSubGenre(), ""));
        dto.setPriceLevel(valueOrDefault(entity.getPriceLevel(), "Unknown"));
        dto.setPriceCurrency(valueOrDefault(entity.getPriceCurrency(), ""));
        dto.setPrice(entity.getPrice() == null ? 0.0 : entity.getPrice());
        dto.setMinPrice(entity.getMinPrice() == null ? 0.0 : entity.getMinPrice());
        dto.setMaxPrice(entity.getMaxPrice() == null ? 0.0 : entity.getMaxPrice());
        dto.setRating(entity.getRating() == null ? 4.3 : entity.getRating());
        dto.setTimeOfDay(valueOrDefault(entity.getTimeOfDay(), "Evening"));
        dto.setDuration(valueOrDefault(entity.getDuration(), "See event time"));
        dto.setVenue(valueOrDefault(entity.getVenue(), "Venue not available"));
        dto.setVenueId(valueOrDefault(entity.getVenueId(), ""));
        dto.setVenueUrl(valueOrDefault(entity.getVenueUrl(), ""));
        dto.setVenueTimezone(valueOrDefault(entity.getVenueTimezone(), ""));
        dto.setVenueAddress(valueOrDefault(entity.getVenueAddress(), ""));
        dto.setVenuePostalCode(valueOrDefault(entity.getVenuePostalCode(), ""));
        dto.setVenueLatitude(entity.getVenueLatitude());
        dto.setVenueLongitude(entity.getVenueLongitude());
        dto.setDescription(valueOrDefault(
                entity.getDescription(),
                "Details are limited for this event. Open the event page for the latest information."
        ));
        dto.setInfo(valueOrDefault(entity.getInfo(), ""));
        dto.setPleaseNote(valueOrDefault(entity.getPleaseNote(), ""));
        dto.setImage(valueOrDefault(entity.getImage(), ""));
        dto.setSeatmapUrl(valueOrDefault(entity.getSeatmapUrl(), ""));
        dto.setAccessibilityInfo(valueOrDefault(entity.getAccessibilityInfo(), ""));
        dto.setTicketLimitInfo(valueOrDefault(entity.getTicketLimitInfo(), ""));
        dto.setStatus(valueOrDefault(entity.getStatus(), ""));
        dto.setPromoterName(valueOrDefault(entity.getPromoterName(), ""));
        dto.setPromoterDescription(valueOrDefault(entity.getPromoterDescription(), ""));
        dto.setFeatured(Boolean.TRUE.equals(entity.getFeatured()));
        dto.setTba(Boolean.TRUE.equals(entity.getTba()));
        dto.setTbd(Boolean.TRUE.equals(entity.getTbd()));
        dto.setSpanMultipleDays(Boolean.TRUE.equals(entity.getSpanMultipleDays()));
        dto.setStartDate(entity.getStartDate());
        dto.setEndDate(entity.getEndDate());
        dto.setSalesStartDate(entity.getSalesStartDate());
        dto.setSalesEndDate(entity.getSalesEndDate());
        dto.setSales(parseJson(entity.getSalesJson()));
        dto.setPriceRanges(parseJson(entity.getPriceRangesJson()));
        dto.setImages(parseJson(entity.getImagesJson()));
        dto.setVenueDetails(parseJson(entity.getVenueDetailsJson()));
        dto.setAttractions(parseJson(entity.getAttractionsJson()));
        dto.setClassifications(parseJson(entity.getClassificationsJson()));
        dto.setPromoter(parseJson(entity.getPromoterJson()));
        dto.setPromoters(parseJson(entity.getPromotersJson()));
        dto.setOutlets(parseJson(entity.getOutletsJson()));
        dto.setProducts(parseJson(entity.getProductsJson()));

        return dto;
    }

    private JsonNode parseJson(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            return null;
        }
    }

    private String valueOrDefault(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }

        return value.trim();
    }
}
