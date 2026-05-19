package com.sep.hotels.controller;

import com.sep.hotels.dto.HotelResponse;
import com.sep.hotels.service.HotelService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

@RestController
@RequestMapping("/api/hotels")
public class HotelController {

    private static final Logger log = LoggerFactory.getLogger(HotelController.class);
    private static final DateTimeFormatter EUROPEAN_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final HotelService hotelService;

    public HotelController(HotelService hotelService) {
        this.hotelService = hotelService;
    }

    @GetMapping
    public ResponseEntity<?> searchHotels(
            @RequestParam("location") String location,
            @RequestParam("checkIn") String checkIn,
            @RequestParam("checkOut") String checkOut,
            @RequestParam(value = "adults", required = false) Integer adults,
            @RequestParam(value = "children", required = false) Integer children
    ) {
        String validationError = validate(location, checkIn, checkOut, adults, children);
        if (validationError != null) {
            return ResponseEntity.badRequest().body(validationError);
        }

        try {
            String normalizedCheckIn = parseDate(checkIn).toString();
            String normalizedCheckOut = parseDate(checkOut).toString();
            List<HotelResponse> hotels = hotelService.searchHotels(location, normalizedCheckIn, normalizedCheckOut, adults, children);
            return ResponseEntity.ok(hotels);
        } catch (Exception ex) {
            log.warn("Hotel search failed for location '{}'. Returning empty list. Reason: {}", location, ex.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    private String validate(String location, String checkIn, String checkOut, Integer adults, Integer children) {
        if (location == null || location.isBlank()) {
            return "location must not be empty";
        }
        if (checkIn == null || checkIn.isBlank()) {
            return "checkIn must not be empty";
        }
        if (checkOut == null || checkOut.isBlank()) {
            return "checkOut must not be empty";
        }

        LocalDate checkInDate;
        LocalDate checkOutDate;
        try {
            checkInDate = parseDate(checkIn);
            checkOutDate = parseDate(checkOut);
        } catch (DateTimeParseException ex) {
            return "checkIn and checkOut must use format YYYY-MM-DD or DD/MM/YYYY";
        }

        if (checkInDate.isBefore(LocalDate.now())) {
            return "checkIn must not be in the past";
        }
        if (!checkOutDate.isAfter(checkInDate)) {
            return "checkOut must be after checkIn";
        }
        if (adults != null && adults < 1) {
            return "adults must be at least 1";
        }
        if (children != null && children < 0) {
            return "children must be at least 0";
        }

        int totalGuests = (adults == null ? 2 : adults) + (children == null ? 0 : children);
        if (totalGuests > 10) {
            return "adults and children must not exceed 10 guests";
        }

        return null;
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            return LocalDate.parse(value, EUROPEAN_DATE_FORMAT);
        }
    }
}
