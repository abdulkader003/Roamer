package com.sep.hotels.service;

import com.sep.hotels.client.AgodaRapidApiClient;
import com.sep.hotels.dto.HotelResponse;
import com.sep.hotels.repository.HotelRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HotelServiceTest {

    private final HotelRepository hotelRepository = mock(HotelRepository.class);
    private final AgodaRapidApiClient agodaRapidApiClient = mock(AgodaRapidApiClient.class);
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
    void validKnownCityStillUsesExistingFallbackWhenNoCachedOrExternalHotelsExist() {
        when(hotelRepository.findWithDetailsByCityIgnoreCase("Berlin")).thenReturn(List.of());
        when(agodaRapidApiClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0)).thenReturn(List.of());

        List<HotelResponse> hotels = hotelService.searchHotels(
                "Berlin",
                "2026-06-01",
                "2026-06-03",
                2,
                0
        );

        assertThat(hotels).hasSize(15);
        assertThat(hotels).allSatisfy(hotel -> assertThat(hotel.city()).isEqualTo("Berlin"));
        verify(agodaRapidApiClient).searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0);
    }
}
