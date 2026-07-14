package com.sep.activity;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityMapperTest {

    private final ActivityMapper activityMapper = new ActivityMapper(new ObjectMapper());

    @Test
    void toDtoAppliesFallbacksAndParsesJsonFields() {
        ActivityEntity entity = new ActivityEntity();
        entity.setExternalId("tm-1");
        entity.setTitle("  ");
        entity.setType(null);
        entity.setCity(null);
        entity.setCountry(null);
        entity.setCategory(null);
        entity.setPrice(null);
        entity.setMinPrice(null);
        entity.setMaxPrice(null);
        entity.setRating(null);
        entity.setDescription(null);
        entity.setSalesJson("{\"open\":true}");
        entity.setImagesJson("not json");

        ActivityDto dto = activityMapper.toDto(entity);

        assertThat(dto.getId()).isEqualTo("tm-1");
        assertThat(dto.getTitle()).isEqualTo("Untitled activity");
        assertThat(dto.getType()).isEqualTo("event");
        assertThat(dto.getCity()).isEqualTo("Unknown city");
        assertThat(dto.getCountry()).isEqualTo("Unknown country");
        assertThat(dto.getCategory()).isEqualTo("Miscellaneous");
        assertThat(dto.getPrice()).isZero();
        assertThat(dto.getMinPrice()).isZero();
        assertThat(dto.getMaxPrice()).isZero();
        assertThat(dto.getRating()).isEqualTo(4.3);
        assertThat(dto.getDescription()).contains("Details are limited");
        assertThat(dto.getSales()).isNotNull();
        assertThat(dto.getImages()).isNull();
    }

    @Test
    void toDtoPreservesProvidedValues() {
        ActivityEntity entity = new ActivityEntity();
        entity.setExternalId("tm-2");
        entity.setTitle(" Concert Night ");
        entity.setType("event");
        entity.setCity("Berlin");
        entity.setCountry("Germany");
        entity.setCategory("Music");
        entity.setPrice(42.50);
        entity.setMinPrice(40.00);
        entity.setMaxPrice(50.00);
        entity.setRating(4.8);
        entity.setDescription("Live show");
        entity.setFeatured(true);

        ActivityDto dto = activityMapper.toDto(entity);

        assertThat(dto.getTitle()).isEqualTo("Concert Night");
        assertThat(dto.getCity()).isEqualTo("Berlin");
        assertThat(dto.getCountry()).isEqualTo("Germany");
        assertThat(dto.getPrice()).isEqualTo(42.50);
        assertThat(dto.getMinPrice()).isEqualTo(40.00);
        assertThat(dto.getMaxPrice()).isEqualTo(50.00);
        assertThat(dto.getRating()).isEqualTo(4.8);
        assertThat(dto.getDescription()).isEqualTo("Live show");
    }
}
