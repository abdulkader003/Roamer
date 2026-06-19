package com.sep.weather;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WeatherControllerTest {

    @Test
    void getWeatherReturnsServiceDtos() {
        WeatherService weatherService = mock(WeatherService.class);
        List<WeatherDto> dto = List.of(new WeatherDto("Berlin", 18.5, "Sunny", "sun", 48, 8.1, null));
        when(weatherService.getWeather(List.of("Berlin"))).thenReturn(dto);

        WeatherController controller = new WeatherController(weatherService);
        List<WeatherDto> response = controller.getWeather(List.of("Berlin"));

        assertThat(response).isEqualTo(dto);
        verify(weatherService).getWeather(List.of("Berlin"));
    }
}
