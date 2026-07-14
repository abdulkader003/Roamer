package com.sep.hotel.service;

import com.sep.hotel.client.AgodaHotel;
import com.sep.hotel.client.AgodaRapidApiClient;
import com.sep.hotel.dto.HotelResponse;
import com.sep.hotel.model.Hotel;
import com.sep.hotel.model.HotelImage;
import com.sep.hotel.repository.HotelRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HotelServiceTest {

    private final HotelRepository hotelRepository = org.mockito.Mockito.mock(HotelRepository.class);
    private final AgodaRapidApiClient agodaRapidApiClient = org.mockito.Mockito.mock(AgodaRapidApiClient.class);
    private final HotelService hotelService = new HotelService(
            hotelRepository,
            agodaRapidApiClient,
            new CityNameMapper()
    );

    @Test
    void unknownDestinationReturnsEmptyWithoutFetchingOrCaching() {
        List<HotelResponse> hotels = hotelService.searchHotels(
                "iozjiejzierwfrg",
                "2026-06-01",
                "2026-06-03",
                2,
                0
        );

        assertThat(hotels).isEmpty();
        verifyNoInteractions(hotelRepository, agodaRapidApiClient);
    }

    @Test
    void cacheHitSkipsExternalApiAndMapsSortedResponses() {
        List<Hotel> cachedHotels = new ArrayList<>();
        cachedHotels.add(buildCachedHotel(
                1L,
                "Budget Inn",
                8.1,
                "South bank",
                "1.5 km from city center",
                "Warm and simple",
                "Kings Road, Berlin",
                3,
                81,
                "hero-1",
                List.of("WiFi", "Breakfast"),
                List.of("img-2", "img-1")
        ));
        cachedHotels.add(buildCachedHotel(
                2L,
                "Luxury Lodge",
                9.5,
                "Old town",
                "0.9 km from city center",
                "Upscale and central",
                "Main Street, Berlin",
                5,
                245,
                "hero-2",
                List.of("Parking", "Gym"),
                List.of("img-4", "img-3")
        ));
        HotelImage firstLuxuryImage = cachedHotels.get(1).getImages().iterator().next();
        firstLuxuryImage.setSortOrder(2);
        HotelImage secondLuxuryImage = cachedHotels.get(1).getImages().stream().skip(1).findFirst().orElseThrow();
        secondLuxuryImage.setSortOrder(1);
        for (long index = 3; index <= 15; index++) {
            cachedHotels.add(buildCachedHotel(
                    index,
                    "Hotel " + index,
                    7.0 - (index * 0.01),
                    "Area " + index,
                    "2.0 km from city center",
                    "Fallback",
                    "Address " + index + ", Berlin",
                    4,
                    120,
                    "hero-" + index,
                    List.of("WiFi"),
                    List.of("img-" + index)
            ));
        }

        when(hotelRepository.findWithDetailsByCityIgnoreCase("Berlin")).thenReturn(cachedHotels);

        List<HotelResponse> hotels = hotelService.searchHotels(
                "Berlin",
                "2026-06-01",
                "2026-06-03",
                null,
                null
        );

        assertThat(hotels).hasSize(15);
        assertThat(hotels.get(0).name()).isEqualTo("Luxury Lodge");
        assertThat(hotels.get(0).adults()).isEqualTo(2);
        assertThat(hotels.get(0).children()).isEqualTo(0);
        assertThat(hotels.get(0).amenities()).containsExactly("Gym", "Parking");
        assertThat(hotels.get(0).images()).containsExactly("img-3", "img-4");
        assertThat(hotels.get(0).checkIn()).isEqualTo("2026-06-01");
        assertThat(hotels.get(0).checkOut()).isEqualTo("2026-06-03");
        verifyNoInteractions(agodaRapidApiClient);
    }

    @Test
    void cacheMissFetchesAndCachesAgodaHotelsBeforeReturningStoredResults() {
        Hotel returnedHotel = buildCachedHotel(
                99L,
                "Hotel Alpha",
                8.4,
                "Near Museum Island",
                "1.1 km from city center",
                "A detailed fallback description",
                "Boulevard Haus 12, Berlin",
                4,
                132,
                "primary-image",
                List.of("WiFi", "facilities", "Pool"),
                List.of("img-a", "img-b")
        );

        when(hotelRepository.findWithDetailsByCityIgnoreCase("Berlin")).thenReturn(List.of(), List.of(returnedHotel));
        when(agodaRapidApiClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 1)).thenReturn(List.of(
                new AgodaHotel(
                        "agoda:1",
                        "Hotel Alpha",
                        "Berlin",
                        52.5300,
                        13.4100,
                        "Boulevard Haus 12, Berlin",
                        5,
                        null,
                        8.8,
                        "Great",
                        12,
                        null,
                        "Provider description",
                        Arrays.asList("WiFi", "facilities", "Pool", null),
                        Arrays.asList("img-a", "", null, "img-a", "img-b")
                ),
                new AgodaHotel(
                        "agoda:1",
                        "Duplicate Hotel",
                        "Berlin",
                        52.5310,
                        13.4110,
                        "Other address, Berlin",
                        2,
                        BigDecimal.valueOf(210),
                        7.9,
                        "Good",
                        9,
                        null,
                        "Duplicate provider description",
                        List.of("Spa"),
                        List.of("dup-image")
                ),
                new AgodaHotel(
                        "agoda:2",
                        "Hotel Beta",
                        "Berlin",
                        52.5400,
                        13.4200,
                        "Second Street, Berlin",
                        4,
                        BigDecimal.valueOf(180),
                        9.2,
                        "Excellent",
                        84,
                        null,
                        "Provider description",
                        List.of("Breakfast", "WiFi"),
                        List.of("beta-1", "beta-2")
                )
        ));
        when(hotelRepository.existsByExternalIdAndSource("agoda:1", AgodaRapidApiClient.SOURCE)).thenReturn(false, true);
        when(hotelRepository.existsByExternalIdAndSource("agoda:2", AgodaRapidApiClient.SOURCE)).thenReturn(false);

        List<HotelResponse> hotels = hotelService.searchHotels(
                "Berlin",
                "2026-06-01",
                "2026-06-03",
                2,
                1
        );

        assertThat(hotels).hasSize(1);
        assertThat(hotels.get(0).name()).isEqualTo("Hotel Alpha");
        assertThat(hotels.get(0).city()).isEqualTo("Berlin");
        assertThat(hotels.get(0).images()).containsExactly("img-a", "img-b");
        assertThat(hotels.get(0).amenities()).contains("WiFi", "Pool");

        ArgumentCaptor<Hotel> hotelCaptor = ArgumentCaptor.forClass(Hotel.class);
        verify(hotelRepository, times(2)).save(hotelCaptor.capture());
        List<Hotel> savedHotels = hotelCaptor.getAllValues();

        Hotel firstSavedHotel = savedHotels.get(0);
        assertThat(firstSavedHotel.getExternalId()).isEqualTo("agoda:1");
        assertThat(firstSavedHotel.getSource()).isEqualTo(AgodaRapidApiClient.SOURCE);
        assertThat(firstSavedHotel.getName()).isEqualTo("Hotel Alpha");
        assertThat(firstSavedHotel.getCity()).isEqualTo("Berlin");
        assertThat(firstSavedHotel.getPricePerNight()).isNotNull();
        assertThat(firstSavedHotel.getStars()).isEqualTo(5);
        assertThat(firstSavedHotel.getReviewCount()).isBetween(40, 2500);
        assertThat(firstSavedHotel.getRatingScore()).isBetween(3.0, 10.0);
        assertThat(firstSavedHotel.getRatingLabel()).isNotBlank();
        assertThat(firstSavedHotel.getDistance()).contains("Berlin");
        assertThat(firstSavedHotel.getDistanceFromCenter()).contains("km from city center");
        assertThat(firstSavedHotel.getTag()).isNotBlank();
        assertThat(firstSavedHotel.getDescription()).isNotBlank();
        assertThat(firstSavedHotel.getImage()).isEqualTo("img-a");
        List<String> savedAmenityNames = firstSavedHotel.getAmenities().stream()
                .map(amendity -> amendity.getName())
                .collect(Collectors.toList());
        assertThat(savedAmenityNames).hasSize(6);
        assertThat(savedAmenityNames).contains("WiFi", "Pool");
        assertThat(savedAmenityNames).doesNotContain("facilities");
        assertThat(savedAmenityNames).doesNotContainNull();
        assertThat(firstSavedHotel.getImages()).hasSize(2);

        Hotel secondSavedHotel = savedHotels.get(1);
        assertThat(secondSavedHotel.getExternalId()).isEqualTo("agoda:2");
        verify(agodaRapidApiClient).searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 1);
    }

    @Test
    void cacheMissFallsBackWhenProviderReturnsNothing() {
        when(hotelRepository.findWithDetailsByCityIgnoreCase("Berlin")).thenReturn(List.of(), List.of());
        when(agodaRapidApiClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0)).thenReturn(List.of());

        List<HotelResponse> hotels = hotelService.searchHotels(
                "Berlin",
                "2026-06-01",
                "2026-06-03",
                null,
                null
        );

        assertThat(hotels).hasSize(15);
        assertThat(hotels).allSatisfy(hotel -> {
            assertThat(hotel.city()).isEqualTo("Berlin");
            assertThat(hotel.adults()).isEqualTo(2);
            assertThat(hotel.children()).isEqualTo(0);
            assertThat(hotel.name()).startsWith("Berlin ");
        });
        verify(agodaRapidApiClient).searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0);
        verify(hotelRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void cacheMissFallsBackWhenProviderThrows() {
        when(hotelRepository.findWithDetailsByCityIgnoreCase("Berlin")).thenReturn(List.of(), List.of());
        when(agodaRapidApiClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0))
                .thenThrow(new IllegalStateException("provider down"));

        List<HotelResponse> hotels = hotelService.searchHotels(
                "Berlin",
                "2026-06-01",
                "2026-06-03",
                null,
                null
        );

        assertThat(hotels).hasSize(15);
        assertThat(hotels).allSatisfy(hotel -> assertThat(hotel.city()).isEqualTo("Berlin"));
        verify(agodaRapidApiClient).searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0);
        verify(hotelRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void sanitizesBrokenCachedHotelAndPersistsUpdatedFields() {
        Hotel brokenHotel = buildCachedHotel(
                7L,
                "Broken Hotel",
                6.7,
                null,
                "0 km from city center",
                "0 km from city center",
                null,
                3,
                44,
                "broken-image",
                List.of("WiFi"),
                List.of("broken-1")
        );
        when(hotelRepository.findWithDetailsByCityIgnoreCase("Berlin")).thenReturn(List.of(brokenHotel), List.of(brokenHotel));
        when(agodaRapidApiClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0)).thenReturn(List.of());

        List<HotelResponse> hotels = hotelService.searchHotels(
                "Berlin",
                "2026-06-01",
                "2026-06-03",
                2,
                0
        );

        assertThat(hotels).hasSize(1);
        assertThat(hotels.get(0).distance()).isNotBlank();
        assertThat(hotels.get(0).distance()).doesNotContain("0 km");
        assertThat(hotels.get(0).distanceFromCenter()).matches("[0-9]+\\.[0-9] km from city center");
        assertThat(hotels.get(0).description()).isNotBlank();
        verify(hotelRepository).save(brokenHotel);
    }

    @Test
    void helperMethodsCoverRatingLocationDistanceAndCollectionBranches() {
        assertThat((String) invoke("buildRatingLabel", (Object) null)).isNull();
        assertThat((String) invoke("buildRatingLabel", 9.2d)).isEqualTo("Exceptional");
        assertThat((String) invoke("buildRatingLabel", 8.3d)).isEqualTo("Excellent");
        assertThat((String) invoke("buildRatingLabel", 7.5d)).isEqualTo("Very good");
        assertThat((String) invoke("buildRatingLabel", 6.2d)).isEqualTo("Good");
        assertThat((String) invoke("buildRatingLabel", 5.9d)).isEqualTo("Pleasant");

        assertThat((Boolean) invoke("isGenericLocationText", (Object) null)).isTrue();
        assertThat((Boolean) invoke("isGenericLocationText", "city center")).isTrue();
        assertThat((Boolean) invoke("isGenericLocationText", "near city centre")).isTrue();
        assertThat((Boolean) invoke("isGenericLocationText", "Downtown")).isTrue();
        assertThat((Boolean) invoke("isGenericLocationText", "Riverside suites")).isFalse();

        assertThat((Boolean) invoke("isUsableLocation", "Boulevard Haus 12, Berlin", "Berlin")).isTrue();
        assertThat((Boolean) invoke("isUsableLocation", (Object) null, "Berlin")).isFalse();
        assertThat((Boolean) invoke("isUsableLocation", "Berlin", "Berlin")).isFalse();
        assertThat((Boolean) invoke("isUsableLocation", "0 km from city center", "Berlin")).isFalse();
        assertThat((Boolean) invoke("isUsableLocation", "Very long address 12345", "Berlin")).isFalse();

        assertThat((Boolean) invoke("isValidDistance", "1.0 km from city center")).isTrue();
        assertThat((Boolean) invoke("isValidDistance", "0 km from city center")).isFalse();
        assertThat((Boolean) invoke("isValidDistance", "11.0 km from city center")).isFalse();
        assertThat((Boolean) invoke("isValidDistance", "distance unknown")).isFalse();

        assertThat((Boolean) invoke("containsInvalidDistance", "1.1 km from city center")).isFalse();
        assertThat((Boolean) invoke("containsInvalidDistance", "0 km from city center")).isTrue();
        assertThat((Boolean) invoke("containsInvalidDistance", "11.0 km from city center")).isTrue();

        assertThat((Double) invoke("distanceFromCoordinates", "Berlin", 52.5200, 13.4050)).isNull();
        assertThat((Double) invoke("distanceFromCoordinates", "Berlin", 52.5300, 13.4150)).isPositive();
        assertThat((Double) invoke("distanceFromCoordinates", "Berlin", null, 13.4150)).isNull();
        assertThat((Double) invoke("distanceFromCoordinates", "Berlin", 0.0, 13.4150)).isNull();
        assertThat((Double) invoke("distanceFromCoordinates", "Unknown City", 52.5300, 13.4150)).isNull();

        assertThat((List<String>) invoke("providerImages", (Object) null)).isEmpty();
        assertThat((List<String>) invoke("providerImages", Arrays.asList("img-1", "", "img-1", null, "img-2")))
                .containsExactly("img-1", "img-2");

        assertThat((List<String>) invoke("providerAmenities", (Object) null, 0, 0))
                .hasSize(6)
                .doesNotContainNull();
        assertThat((List<String>) invoke(
                "providerAmenities",
                Arrays.asList("WiFi", null, "", "Facilities", "Hotel services", "Property-facility", "Close to public transportation"),
                0,
                0
        )).contains("WiFi");

        assertThat((String) invoke("buildLocationLabel", "Berlin", null, 0, 0)).isEqualTo("Near Museum Island, Berlin");
        assertThat((String) invoke("buildLocationLabel", "Berlin", "Boulevard Haus 12, Berlin", 0, 0))
                .contains("Boulevard Haus 12")
                .contains("Berlin");

        assertThat((Integer) invoke("resolveStars", 5, 123)).isEqualTo(5);
        assertThat((Integer) invoke("resolveStars", null, 123)).isBetween(3, 5);
        assertThat((Integer) invoke("resolveReviewCount", 120, 123)).isEqualTo(120);
        assertThat((Integer) invoke("resolveReviewCount", 12, 123)).isBetween(40, 2500);
        assertThat((Double) invoke("resolveRatingScore", 8.8d, 123, 0)).isBetween(3.0, 10.0);
        assertThat((Double) invoke("resolveRatingScore", null, 123, 0)).isBetween(3.0, 10.0);

        for (int position = 0; position < 12; position++) {
            String description = invoke(
                    "buildProviderDescription",
                    "Hotel Alpha",
                    "Berlin",
                    "Near Museum Island",
                    "1.2 km from city center",
                    4,
                    "Top pick",
                    List.of(),
                    0,
                    position
            );
            assertThat(description).isNotBlank();
            assertThat(description).contains("Hotel Alpha");
        }
    }

    @SuppressWarnings("unchecked")
    private <T> T invoke(String methodName, Object... args) {
        return (T) ReflectionTestUtils.invokeMethod(hotelService, methodName, args);
    }

    private Hotel buildCachedHotel(
            Long id,
            String name,
            Double ratingScore,
            String distance,
            String distanceFromCenter,
            String description,
            String address,
            Integer stars,
            Integer reviewCount,
            String image,
            List<String> amenities,
            List<String> images
    ) {
        Hotel hotel = new Hotel();
        ReflectionTestUtils.setField(hotel, "id", id);
        hotel.setName(name);
        hotel.setCity("Berlin");
        hotel.setPricePerNight(BigDecimal.valueOf(140));
        hotel.setRating(ratingScore);
        hotel.setRatingScore(ratingScore);
        hotel.setRatingLabel("Excellent");
        hotel.setReviewCount(reviewCount);
        hotel.setStars(stars);
        hotel.setDistance(distance);
        hotel.setDistanceFromCenter(distanceFromCenter);
        hotel.setTag("Top pick");
        hotel.setDescription(description);
        hotel.setImage(image);
        hotel.setAddress(address);
        if (amenities != null) {
            amenities.forEach(hotel::addAmenity);
        }
        if (images != null) {
            for (int index = 0; index < images.size(); index++) {
                hotel.addImage(images.get(index), index + 1);
            }
        }
        return hotel;
    }
}
