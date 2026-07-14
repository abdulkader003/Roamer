package com.sep.hotel.controller;

import com.sep.hotel.dto.HotelResponse;
import com.sep.hotel.service.HotelService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class HotelControllerTest {

    private static final DateTimeFormatter EUROPEAN_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Mock
    private HotelService hotelService;

    private HotelController hotelController;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        hotelController = new HotelController(hotelService);
        mockMvc = MockMvcBuilders.standaloneSetup(hotelController).build();
    }

    @Test
    void searchHotelsReturnsServiceResultsForIsoDates() throws Exception {
        List<HotelResponse> hotels = List.of(sampleHotelResponse());
        when(hotelService.searchHotels("Paris", "2026-07-20", "2026-07-25", null, null)).thenReturn(hotels);

        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", "2026-07-25"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$[0].name").value("Hotel One"))
                .andExpect(jsonPath("$[0].city").value("Paris"))
                .andExpect(jsonPath("$[0].checkIn").value("2026-07-20"))
                .andExpect(jsonPath("$[0].checkOut").value("2026-07-25"));

        verify(hotelService).searchHotels("Paris", "2026-07-20", "2026-07-25", null, null);
    }

    @Test
    void searchHotelsReturnsEmptyListWhenServiceFindsNoHotels() throws Exception {
        when(hotelService.searchHotels("Paris", "2026-07-20", "2026-07-25", null, null)).thenReturn(List.of());

        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", "2026-07-25"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        verify(hotelService).searchHotels("Paris", "2026-07-20", "2026-07-25", null, null);
    }

    @Test
    void searchHotelsAcceptsEuropeanDates() throws Exception {
        LocalDate checkIn = LocalDate.now().plusDays(7);
        LocalDate checkOut = checkIn.plusDays(4);
        String europeanCheckIn = EUROPEAN_DATE_FORMAT.format(checkIn);
        String europeanCheckOut = EUROPEAN_DATE_FORMAT.format(checkOut);

        when(hotelService.searchHotels("Rome", checkIn.toString(), checkOut.toString(), 2, 1))
                .thenReturn(List.of(sampleHotelResponse()));

        mockMvc.perform(get("/api/hotels")
                        .param("location", "Rome")
                        .param("checkIn", europeanCheckIn)
                        .param("checkOut", europeanCheckOut)
                        .param("adults", "2")
                        .param("children", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Hotel One"));

        verify(hotelService).searchHotels("Rome", checkIn.toString(), checkOut.toString(), 2, 1);
    }

    @Test
    void searchHotelsRejectsBlankLocationBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/hotels")
                        .param("location", " ")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", "2026-07-25"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("location must not be empty"));

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsMissingRequiredParametersBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkOut", "2026-07-25"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsNullLocationWhenCalledDirectly() {
        var response = hotelController.searchHotels(null, "2026-07-20", "2026-07-25", null, null);

        org.assertj.core.api.Assertions.assertThat(response.getStatusCode().value()).isEqualTo(400);
        org.assertj.core.api.Assertions.assertThat(response.getBody()).isEqualTo("location must not be empty");
        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsNullCheckInWhenCalledDirectly() {
        var response = hotelController.searchHotels("Paris", null, "2026-07-25", null, null);

        org.assertj.core.api.Assertions.assertThat(response.getStatusCode().value()).isEqualTo(400);
        org.assertj.core.api.Assertions.assertThat(response.getBody()).isEqualTo("checkIn must not be empty");
        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsNullCheckOutWhenCalledDirectly() {
        var response = hotelController.searchHotels("Paris", "2026-07-20", null, null, null);

        org.assertj.core.api.Assertions.assertThat(response.getStatusCode().value()).isEqualTo(400);
        org.assertj.core.api.Assertions.assertThat(response.getBody()).isEqualTo("checkOut must not be empty");
        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsInvalidDateFormatBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "20-07-2026")
                        .param("checkOut", "2026-07-25"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("checkIn and checkOut must use format YYYY-MM-DD or DD/MM/YYYY"));

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsPastCheckInBeforeCallingService() throws Exception {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate tomorrow = LocalDate.now().plusDays(1);

        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", yesterday.toString())
                        .param("checkOut", tomorrow.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("checkIn must not be in the past"));

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsCheckoutBeforeCheckinBeforeCallingService() throws Exception {
        LocalDate checkIn = LocalDate.now().plusDays(7);
        LocalDate checkOut = checkIn.minusDays(1);

        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("checkOut must be after checkIn"));

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsInvalidGuestCountsBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", "2026-07-25")
                        .param("adults", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("adults must be at least 1"));

        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", "2026-07-25")
                        .param("children", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("children must be at least 0"));

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsTooManyGuestsBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", "2026-07-25")
                        .param("adults", "9")
                        .param("children", "2"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("adults and children must not exceed 10 guests"));

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsReturnsEmptyListWhenServiceFails() throws Exception {
        when(hotelService.searchHotels(eq("Paris"), eq("2026-07-20"), eq("2026-07-25"), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull()))
                .thenThrow(new IllegalStateException("provider down"));

        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", "2026-07-25"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        verify(hotelService).searchHotels("Paris", "2026-07-20", "2026-07-25", null, null);
    }

    @Test
    void searchHotelsRejectsBlankCheckInBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", " ")
                        .param("checkOut", "2026-07-25"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("checkIn must not be empty"));

        verifyNoInteractions(hotelService);
    }

    @Test
    void searchHotelsRejectsBlankCheckOutBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/hotels")
                        .param("location", "Paris")
                        .param("checkIn", "2026-07-20")
                        .param("checkOut", " "))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("checkOut must not be empty"));

        verifyNoInteractions(hotelService);
    }

    private HotelResponse sampleHotelResponse() {
        return new HotelResponse(
                1L,
                "Hotel One",
                "Paris",
                new BigDecimal("123.45"),
                8.9,
                8.9,
                "Excellent",
                120,
                4,
                "2026-07-20",
                "2026-07-25",
                "Near center",
                "0.5 km from center",
                "Top pick",
                "Nice hotel",
                List.of("WiFi", "Breakfast"),
                2,
                0,
                "https://example.com/hotel-one.jpg",
                List.of("https://example.com/hotel-one.jpg")
        );
    }
}
