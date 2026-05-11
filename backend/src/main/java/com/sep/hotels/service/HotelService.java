package com.sep.hotels.service;

import com.sep.hotels.client.AgodaHotel;
import com.sep.hotels.client.AgodaRapidApiClient;
import com.sep.hotels.dto.HotelResponse;
import com.sep.hotels.model.Hotel;
import com.sep.hotels.model.HotelAmenity;
import com.sep.hotels.model.HotelImage;
import com.sep.hotels.repository.HotelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class HotelService {

    private static final Logger log = LoggerFactory.getLogger(HotelService.class);
    private static final int MAX_HOTELS_PER_CITY = 15;
    private static final double MIN_DISTANCE_KM = 0.4;
    private static final double MAX_DISTANCE_KM = 10.0;
    private static final Pattern DISTANCE_PATTERN = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)\\s*km", Pattern.CASE_INSENSITIVE);

    private static final List<String> AGODA_TAGS = List.of(
            "Top pick",
            "City favorite",
            "Great value",
            "Boutique stay",
            "Business friendly",
            "Central location",
            "Highly rated",
            "Popular choice"
    );

    private static final List<String> DEFAULT_LOCATION_AREAS = List.of(
            "Near the main station",
            "Close to the old town",
            "Around the museum district",
            "Near the business quarter",
            "Close to riverside walks",
            "Around the shopping streets",
            "Near public transport links",
            "In a quiet central neighborhood",
            "Near the historic center",
            "Close to local restaurants",
            "Around the theatre district",
            "Near a central market",
            "Close to tram and metro links",
            "Around a lively square",
            "Near the cultural quarter"
    );

    private static final List<String> DEFAULT_AMENITIES = List.of(
            "Free WiFi",
            "Breakfast",
            "Air conditioning",
            "24-hour front desk",
            "Family rooms",
            "Restaurant",
            "Bar",
            "Fitness center",
            "Room service",
            "Private parking",
            "Airport shuttle",
            "Terrace",
            "Business facilities",
            "Soundproof rooms",
            "Luggage storage",
            "Tea and coffee maker"
    );

    private static final List<String> FALLBACK_HOTEL_NAMES = List.of(
            "Central House",
            "Grand Station Hotel",
            "Urban Garden Suites",
            "Riverside Residence",
            "Market Square Hotel",
            "Museum Quarter Rooms",
            "Cityline Boutique",
            "Old Town Retreat",
            "Arcade Hotel",
            "Vista Park Suites",
            "Metro Court Hotel",
            "Avenue House",
            "Harbor View Stay",
            "The Local",
            "Terrace Rooms"
    );

    private static final List<String> FALLBACK_IMAGES = List.of(
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80"
    );

    private static final Map<String, List<String>> CITY_LOCATION_AREAS = Map.ofEntries(
            Map.entry("Paris", List.of(
                    "Near Montmartre",
                    "Close to the Latin Quarter",
                    "Around Le Marais",
                    "Near Champs-Elysees",
                    "Central Paris, close to metro connections",
                    "Around Saint-Germain-des-Pres",
                    "Near Opera Garnier",
                    "Close to the Seine",
                    "Near Canal Saint-Martin",
                    "Around Bastille",
                    "Close to Luxembourg Gardens",
                    "Near Place de la Republique",
                    "Around Trocadero",
                    "Close to Gare de Lyon",
                    "Near the Louvre"
            )),
            Map.entry("Berlin", List.of(
                    "Near Museum Island",
                    "Around Mitte",
                    "Close to Potsdamer Platz",
                    "Near Kurfurstendamm",
                    "Around Friedrichstrasse",
                    "Close to Alexanderplatz",
                    "Near Checkpoint Charlie",
                    "Around Prenzlauer Berg",
                    "Near Hackescher Markt",
                    "Close to Tiergarten",
                    "Around Kreuzberg",
                    "Near Berlin Hauptbahnhof",
                    "Close to Gendarmenmarkt",
                    "Around Charlottenburg",
                    "Near the Spree riverside"
            )),
            Map.entry("Barcelona", List.of(
                    "Near Gothic Quarter",
                    "Close to La Rambla",
                    "Around Eixample",
                    "Near Barceloneta",
                    "Close to Sagrada Familia",
                    "Near Passeig de Gracia",
                    "Around El Born",
                    "Close to Sants station",
                    "Near Placa de Catalunya",
                    "Around Gracia",
                    "Close to Port Vell",
                    "Near Montjuic",
                    "Around Poblenou",
                    "Close to Casa Batllo",
                    "Near the beach promenade"
            )),
            Map.entry("London", List.of(
                    "Near Covent Garden",
                    "Around Westminster",
                    "Close to South Bank",
                    "Near Hyde Park",
                    "Around Soho",
                    "Close to King's Cross",
                    "Near Tower Bridge",
                    "Around Kensington",
                    "Near Paddington",
                    "Close to Shoreditch",
                    "Around Mayfair",
                    "Near Victoria Station",
                    "Close to Camden Market",
                    "Around Chelsea",
                    "Near St Paul's Cathedral"
            )),
            Map.entry("Madrid", List.of(
                    "Near Gran Via",
                    "Around Sol",
                    "Close to Retiro Park",
                    "Near Salamanca",
                    "Around Chueca",
                    "Close to Atocha",
                    "Near Plaza Mayor",
                    "Around Chamberi",
                    "Near Prado Museum",
                    "Close to La Latina",
                    "Around Malasana",
                    "Near Royal Palace",
                    "Close to Paseo del Prado",
                    "Around Lavapies",
                    "Near Cibeles"
            )),
            Map.entry("Rome", List.of(
                    "Near Roma Termini",
                    "Close to the Colosseum",
                    "Around Trastevere",
                    "Near Piazza Navona",
                    "Close to Vatican City",
                    "Around Monti",
                    "Near Spanish Steps",
                    "Close to Campo de' Fiori",
                    "Around Testaccio",
                    "Near Villa Borghese",
                    "Close to Trevi Fountain",
                    "Around Prati",
                    "Near Pantheon",
                    "Close to Piazza Venezia",
                    "Around San Giovanni"
            )),
            Map.entry("Cairo", List.of(
                    "Near Tahrir Square",
                    "Close to the Egyptian Museum",
                    "Around Zamalek",
                    "Near Downtown Cairo",
                    "Close to the Nile Corniche",
                    "Around Garden City",
                    "Near Khan el-Khalili",
                    "Close to Cairo Opera House",
                    "Around Heliopolis",
                    "Near Giza Plateau connections",
                    "Close to Al-Azhar Park",
                    "Around Dokki",
                    "Near Maadi",
                    "Close to Ramses Station",
                    "Around Nasr City"
            ))
    );

    private static final Map<String, double[]> CITY_CENTERS = Map.ofEntries(
            Map.entry("Paris", new double[]{48.8566, 2.3522}),
            Map.entry("Berlin", new double[]{52.5200, 13.4050}),
            Map.entry("Barcelona", new double[]{41.3874, 2.1686}),
            Map.entry("London", new double[]{51.5072, -0.1276}),
            Map.entry("Madrid", new double[]{40.4168, -3.7038}),
            Map.entry("Rome", new double[]{41.9028, 12.4964}),
            Map.entry("Milan", new double[]{45.4642, 9.1900}),
            Map.entry("Vienna", new double[]{48.2082, 16.3738}),
            Map.entry("Budapest", new double[]{47.4979, 19.0402}),
            Map.entry("Funchal", new double[]{32.6669, -16.9241}),
            Map.entry("Madeira", new double[]{32.6669, -16.9241}),
            Map.entry("Cairo", new double[]{30.0444, 31.2357})
    );

    private final HotelRepository hotelRepository;
    private final AgodaRapidApiClient agodaRapidApiClient;
    private final CityNameMapper cityNameMapper;

    public HotelService(
            HotelRepository hotelRepository,
            AgodaRapidApiClient agodaRapidApiClient,
            CityNameMapper cityNameMapper
    ) {
        this.hotelRepository = hotelRepository;
        this.agodaRapidApiClient = agodaRapidApiClient;
        this.cityNameMapper = cityNameMapper;
    }

    public List<HotelResponse> searchHotels(String location, String checkIn, String checkOut, Integer adults, Integer children) {
        int resolvedAdults = adults == null ? 2 : adults;
        int resolvedChildren = children == null ? 0 : children;
        String city = cityNameMapper.normalize(location);

        List<Hotel> cachedHotels = hotelRepository.findWithDetailsByCityIgnoreCase(city);
        if (cachedHotels.size() < MAX_HOTELS_PER_CITY) {
            try {
                log.info(
                        "Hotel cache for '{}': {} hotels available, target is {}. Loading missing hotels from Agoda RapidAPI",
                        city,
                        cachedHotels.size(),
                        MAX_HOTELS_PER_CITY
                );
                fetchAndCacheHotels(city, checkIn, checkOut, resolvedAdults, resolvedChildren, MAX_HOTELS_PER_CITY - cachedHotels.size());
            } catch (Exception ex) {
                log.warn(
                        "Agoda hotel refresh failed for '{}'. Returning empty cache result. Reason: {}",
                        city,
                        ex.getMessage()
                );
            }
            cachedHotels = hotelRepository.findWithDetailsByCityIgnoreCase(city);
        } else {
            log.info(
                    "Hotel cache hit for '{}': {} hotels available, target is {}. External API skipped",
                    city,
                    cachedHotels.size(),
                    MAX_HOTELS_PER_CITY
            );
        }
        sanitizeCachedHotels(cachedHotels, city);

        if (cachedHotels.isEmpty()) {
            log.warn("No cached hotels available for '{}'", city);
            return fallbackHotelResponses(city, checkIn, checkOut, resolvedAdults, resolvedChildren);
        }

        return cachedHotels.stream()
                .sorted(Comparator.comparing(Hotel::getRatingScore, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_HOTELS_PER_CITY)
                .map(hotel -> toResponse(hotel, checkIn, checkOut, resolvedAdults, resolvedChildren))
                .toList();
    }

    private List<HotelResponse> fallbackHotelResponses(String city, String checkIn, String checkOut, int adults, int children) {
        log.info("Returning generated fallback hotels for '{}'", city);
        return java.util.stream.IntStream.range(0, MAX_HOTELS_PER_CITY)
                .mapToObj(position -> fallbackHotelResponse(city, checkIn, checkOut, adults, children, position))
                .toList();
    }

    private HotelResponse fallbackHotelResponse(String city, String checkIn, String checkOut, int adults, int children, int position) {
        String baseName = FALLBACK_HOTEL_NAMES.get(position % FALLBACK_HOTEL_NAMES.size());
        String hotelName = city + " " + baseName;
        int hash = stableHash(city, hotelName);
        Integer stars = resolveStars(null, hash);
        List<String> amenities = providerAmenities(List.of(), hash, position);
        String tag = AGODA_TAGS.get(positive(hash / 7, AGODA_TAGS.size()));
        String locationLabel = buildLocationLabel(city, null, hash, position);
        String distanceFromCenter = buildDistanceFromCenter(city, null, null, hash, position);
        Double ratingScore = resolveRatingScore(null, hash, position);
        BigDecimal pricePerNight = BigDecimal.valueOf(75L + positive(hash / 19 + position * 23, 210));
        List<String> images = fallbackImages(position);

        return new HotelResponse(
                -1L * (position + 1),
                hotelName,
                city,
                pricePerNight,
                ratingScore,
                ratingScore,
                buildRatingLabel(ratingScore),
                resolveReviewCount(null, hash),
                stars,
                checkIn,
                checkOut,
                locationLabel,
                distanceFromCenter,
                tag,
                buildProviderDescription(hotelName, city, locationLabel, distanceFromCenter, stars, tag, amenities, hash, position),
                amenities,
                adults,
                children,
                images.get(0),
                images
        );
    }

    private List<String> fallbackImages(int position) {
        List<String> images = new ArrayList<>();
        for (int index = 0; index < FALLBACK_IMAGES.size(); index++) {
            images.add(FALLBACK_IMAGES.get((position + index) % FALLBACK_IMAGES.size()));
        }
        return images;
    }

    private void fetchAndCacheHotels(String city, String checkIn, String checkOut, int adults, int children, int missingHotelCount) {
        log.info("Hotel cache miss for '{}': loading hotels from Agoda RapidAPI", city);
        List<AgodaHotel> agodaHotels = agodaRapidApiClient.searchHotels(city, checkIn, checkOut, adults, children);

        if (agodaHotels.isEmpty()) {
            log.warn("No hotels returned by Agoda RapidAPI for '{}'", city);
            return;
        }

        int saved = cacheAgodaHotels(city, agodaHotels, missingHotelCount);
        log.info("Cached {} new Agoda hotels for '{}'", saved, city);
    }

    private int cacheAgodaHotels(String city, List<AgodaHotel> externalHotels, int missingHotelCount) {
        int saved = 0;
        for (int index = 0; index < externalHotels.size(); index++) {
            if (saved >= missingHotelCount) {
                break;
            }

            AgodaHotel externalHotel = externalHotels.get(index);
            if (hotelRepository.existsByExternalIdAndSource(externalHotel.externalId(), AgodaRapidApiClient.SOURCE)) {
                continue;
            }

            Hotel hotel = createHotelEntity(externalHotel, city, index);
            hotelRepository.save(hotel);
            saved++;
        }
        return saved;
    }

    private Hotel createHotelEntity(AgodaHotel externalHotel, String city, int position) {
        Hotel hotel = new Hotel();
        hotel.setExternalId(externalHotel.externalId());
        hotel.setSource(AgodaRapidApiClient.SOURCE);
        hotel.setName(externalHotel.name());
        hotel.setCity(city);
        hotel.setLatitude(externalHotel.latitude());
        hotel.setLongitude(externalHotel.longitude());
        hotel.setAddress(null);
        hotel.setLastFetchedAt(Instant.now());

        int hash = stableHash(city, externalHotel.name());
        Integer stars = resolveStars(externalHotel.stars(), hash);
        List<String> amenities = providerAmenities(externalHotel.amenities(), hash, position);
        String tag = AGODA_TAGS.get(positive(hash / 7, AGODA_TAGS.size()));
        String locationLabel = buildLocationLabel(city, externalHotel.address(), hash, position);
        String distanceFromCenter = buildDistanceFromCenter(city, externalHotel.latitude(), externalHotel.longitude(), hash, position);
        List<String> images = providerImages(externalHotel.images());
        Double ratingScore = resolveRatingScore(externalHotel.ratingScore(), hash, position);

        hotel.setStars(stars);
        hotel.setPricePerNight(externalHotel.pricePerNight() == null
                ? BigDecimal.valueOf(80L + positive(hash, 180))
                : externalHotel.pricePerNight());
        hotel.setRatingScore(ratingScore);
        hotel.setRating(hotel.getRatingScore());
        hotel.setRatingLabel(buildRatingLabel(ratingScore));
        hotel.setReviewCount(resolveReviewCount(externalHotel.reviewCount(), hash));
        hotel.setAddress(locationLabel);
        hotel.setDistance(locationLabel);
        hotel.setDistanceFromCenter(distanceFromCenter);
        hotel.setTag(tag);
        hotel.setDescription(buildProviderDescription(externalHotel.name(), city, locationLabel, distanceFromCenter, stars, tag, amenities, hash, position));
        hotel.setImage(images.isEmpty() ? null : images.get(0));

        amenities.forEach(hotel::addAmenity);
        for (int imageIndex = 0; imageIndex < images.size(); imageIndex++) {
            hotel.addImage(images.get(imageIndex), imageIndex + 1);
        }

        return hotel;
    }

    private HotelResponse toResponse(Hotel hotel, String checkIn, String checkOut, Integer adults, Integer children) {
        List<String> amenities = hotel.getAmenities().stream()
                .map(HotelAmenity::getName)
                .filter(Objects::nonNull)
                .sorted()
                .toList();

        List<String> images = hotel.getImages().stream()
                .sorted(Comparator.comparing(HotelImage::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(HotelImage::getImageUrl)
                .filter(Objects::nonNull)
                .toList();

        return new HotelResponse(
                hotel.getId(),
                hotel.getName(),
                hotel.getCity(),
                hotel.getPricePerNight(),
                hotel.getRating(),
                hotel.getRatingScore(),
                hotel.getRatingLabel(),
                hotel.getReviewCount(),
                hotel.getStars(),
                checkIn,
                checkOut,
                hotel.getDistance(),
                hotel.getDistanceFromCenter(),
                hotel.getTag(),
                hotel.getDescription(),
                amenities,
                adults,
                children,
                hotel.getImage(),
                images
        );
    }

    private String buildRatingLabel(Double ratingScore) {
        if (ratingScore == null) {
            return null;
        }
        if (ratingScore >= 9.0) {
            return "Exceptional";
        }
        if (ratingScore >= 8.0) {
            return "Excellent";
        }
        if (ratingScore >= 7.0) {
            return "Very good";
        }
        if (ratingScore >= 6.0) {
            return "Good";
        }
        return "Pleasant";
    }

    private Double resolveRatingScore(Double providerRatingScore, int hash, int position) {
        double generatedScore = 9.4 - (position * 0.23) + (positive(hash / 31, 5) - 2) * 0.05;
        if (providerRatingScore != null && providerRatingScore >= 3.0 && providerRatingScore <= 10.0) {
            double blendedScore = (providerRatingScore * 0.65) + (generatedScore * 0.35);
            return roundRating(clampDouble(blendedScore, 3.0, 10.0));
        }
        return roundRating(clampDouble(generatedScore, 3.0, 10.0));
    }

    private Integer resolveStars(Integer providerStars, int hash) {
        if (providerStars != null && providerStars >= 3 && providerStars <= 5) {
            return providerStars;
        }
        return 3 + positive(hash / 11, 3);
    }

    private Integer resolveReviewCount(Integer providerReviewCount, int hash) {
        if (providerReviewCount != null && providerReviewCount >= 40 && providerReviewCount <= 2500) {
            return providerReviewCount;
        }
        return 40 + positive(hash / 17, 2461);
    }

    private String buildLocationLabel(String city, String providerAddress, int hash, int position) {
        List<String> cityAreas = CITY_LOCATION_AREAS.getOrDefault(city, DEFAULT_LOCATION_AREAS);
        String area = cityAreas.get(positive(position, cityAreas.size()));
        if (isUsableLocation(providerAddress, city)) {
            String normalizedAddress = removeCitySuffix(providerAddress.trim(), city);
            String areaHint = lowerFirst(area);
            if (normalizedAddress.toLowerCase(Locale.ROOT).contains(areaHint.toLowerCase(Locale.ROOT))) {
                return normalizedAddress.contains(city) ? normalizedAddress : normalizedAddress + ", " + city;
            }
            return normalizedAddress + ", " + areaHint + ", " + city;
        }

        if (area.toLowerCase().contains(city.toLowerCase())) {
            return area;
        }
        return area + ", " + city;
    }

    private String removeCitySuffix(String value, String city) {
        return value
                .replaceAll("(?i),?\\s*" + Pattern.quote(city) + "\\s*$", "")
                .trim();
    }

    private String lowerFirst(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        return value.substring(0, 1).toLowerCase(Locale.ROOT) + value.substring(1);
    }

    private boolean isUsableLocation(String providerAddress, String city) {
        if (providerAddress == null || providerAddress.isBlank()) {
            return false;
        }
        String normalizedAddress = providerAddress.trim();
        String lowerAddress = normalizedAddress.toLowerCase();
        return normalizedAddress.length() <= 80
                && !normalizedAddress.equalsIgnoreCase(city)
                && !isGenericLocationText(normalizedAddress)
                && !lowerAddress.contains("null")
                && !lowerAddress.matches(".*\\d{5,}.*")
                && !lowerAddress.contains("km from");
    }

    private boolean isGenericLocationText(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("central location")
                || normalized.equals("city center")
                || normalized.equals("city centre")
                || normalized.equals("downtown")
                || normalized.equals("near city center")
                || normalized.equals("near city centre")
                || normalized.contains("central location")
                || normalized.contains("0 km from city center")
                || normalized.contains("0 km from city centre");
    }

    private void sanitizeCachedHotels(List<Hotel> hotels, String city) {
        for (int position = 0; position < hotels.size(); position++) {
            Hotel hotel = hotels.get(position);
            if (sanitizeCachedHotel(hotel, city, position)) {
                hotelRepository.save(hotel);
            }
        }
    }

    private boolean sanitizeCachedHotel(Hotel hotel, String city, int position) {
        int hash = stableHash(city, hotel.getName() == null ? "" : hotel.getName());
        boolean changed = false;

        String cleanDistanceFromCenter = hotel.getDistanceFromCenter();
        if (!isValidDistance(cleanDistanceFromCenter)) {
            cleanDistanceFromCenter = buildDistanceFromCenter(city, hotel.getLatitude(), hotel.getLongitude(), hash, position);
            hotel.setDistanceFromCenter(cleanDistanceFromCenter);
            changed = true;
        }

        if (hotel.getDistance() == null
                || hotel.getDistance().isBlank()
                || containsInvalidDistance(hotel.getDistance())
                || isGenericLocationText(hotel.getDistance())) {
            hotel.setDistance(buildLocationLabel(city, hotel.getAddress(), hash, position));
            changed = true;
        }

        if (hotel.getDescription() == null
                || hotel.getDescription().isBlank()
                || containsInvalidDistance(hotel.getDescription())
                || isGenericLocationText(hotel.getDescription())) {
            List<String> amenities = hotel.getAmenities().stream()
                    .map(HotelAmenity::getName)
                    .filter(Objects::nonNull)
                    .toList();
            String tag = hotel.getTag() == null || hotel.getTag().isBlank()
                    ? AGODA_TAGS.get(positive(hash / 7, AGODA_TAGS.size()))
                    : hotel.getTag();
            hotel.setDescription(buildProviderDescription(
                    hotel.getName(),
                    city,
                    hotel.getDistance(),
                    cleanDistanceFromCenter,
                    hotel.getStars(),
                    tag,
                    amenities,
                    hash,
                    position
            ));
            changed = true;
        }

        return changed;
    }

    private String buildDistanceFromCenter(String city, Double latitude, Double longitude, int hash, int position) {
        Double coordinateDistance = distanceFromCoordinates(city, latitude, longitude);
        if (coordinateDistance != null && coordinateDistance >= MIN_DISTANCE_KM && coordinateDistance <= MAX_DISTANCE_KM) {
            return String.format(Locale.US, "%.1f km from city center", coordinateDistance);
        }

        double generatedDistance = MIN_DISTANCE_KM + positive((hash / 23) + (position * 17), 97) / 10.0;
        return String.format(Locale.US, "%.1f km from city center", generatedDistance);
    }

    private Double distanceFromCoordinates(String city, Double latitude, Double longitude) {
        if (latitude == null || longitude == null || latitude == 0.0 || longitude == 0.0) {
            return null;
        }
        double[] center = CITY_CENTERS.get(city);
        if (center == null) {
            return null;
        }
        double distance = haversineKilometers(center[0], center[1], latitude, longitude);
        if (Double.isNaN(distance) || Double.isInfinite(distance) || distance <= 0.0) {
            return null;
        }
        return Math.round(distance * 10.0) / 10.0;
    }

    private boolean isValidDistance(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        Matcher matcher = DISTANCE_PATTERN.matcher(value);
        if (!matcher.find()) {
            return false;
        }
        String distanceText = matcher.group(1);
        if (matcher.find()) {
            return false;
        }
        double distance = parseDistanceValue(distanceText);
        return distance >= MIN_DISTANCE_KM
                && distance <= MAX_DISTANCE_KM
                && value.matches("^[0-9]+\\.[0-9] km from city center$");
    }

    private boolean containsInvalidDistance(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        Matcher matcher = DISTANCE_PATTERN.matcher(value);
        boolean foundDistance = false;
        while (matcher.find()) {
            foundDistance = true;
            double distance = parseDistanceValue(matcher.group(1));
            if (distance < MIN_DISTANCE_KM
                    || distance > MAX_DISTANCE_KM
                    || !matcher.group(1).matches("[0-9]+\\.[0-9]")) {
                return true;
            }
        }
        return foundDistance && value.toLowerCase(Locale.ROOT).contains("0 km");
    }

    private double parseDistanceValue(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ex) {
            return -1.0;
        }
    }

    private double haversineKilometers(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private List<String> providerAmenities(List<String> providerAmenities, int hash, int position) {
        Set<String> amenities = new LinkedHashSet<>();
        if (providerAmenities != null) {
            providerAmenities.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(this::isUsefulAmenity)
                    .forEach(amenities::add);
        }

        int offset = positive(hash / 29 + position * 3, DEFAULT_AMENITIES.size());
        for (int index = 0; amenities.size() < 6 && index < DEFAULT_AMENITIES.size(); index++) {
            amenities.add(DEFAULT_AMENITIES.get((offset + index) % DEFAULT_AMENITIES.size()));
        }
        return new ArrayList<>(amenities).stream().limit(6).toList();
    }

    private boolean isUsefulAmenity(String amenity) {
        if (amenity == null || amenity.isBlank()) {
            return false;
        }
        String normalized = amenity.trim().toLowerCase(Locale.ROOT);
        return normalized.length() <= 40
                && !normalized.contains("property-facility")
                && !normalized.contains("openable window")
                && !normalized.equals("facilities")
                && !normalized.equals("hotel services")
                && !normalized.equals("close to public transportation");
    }

    private List<String> providerImages(List<String> providerImages) {
        if (providerImages == null) {
            return List.of();
        }
        return providerImages.stream()
                .filter(Objects::nonNull)
                .filter(image -> !image.isBlank())
                .distinct()
                .limit(7)
                .toList();
    }

    private String buildProviderDescription(String hotelName, String city, String locationLabel, String distanceFromCenter, Integer stars, String tag, List<String> amenities, int hash, int position) {
        String starText = stars == null || stars <= 0 ? "well-rated" : stars + "-star";
        String style = tag == null || tag.isBlank() || isGenericLocationText(tag)
                ? "city stay"
                : tag.toLowerCase(Locale.ROOT);
        String amenityOne = amenityForSentence(amenities, hash, 0);
        String amenityTwo = amenityForSentence(amenities, hash, 1);
        String amenityThree = amenityForSentence(amenities, hash, 2);

        return switch (positive(position + positive(hash / 37, 12), 12)) {
            case 0 -> "%s offers a %s base in %s, set %s and %s from the city center, with %s and %s for a comfortable %s."
                    .formatted(hotelName, starText, city, locationLabel, distanceFromCenter, amenityOne, amenityTwo, style);
            case 1 -> "Set %s, %s is a %s option in %s, pairing %s access with %s, %s, and an easy %s atmosphere."
                    .formatted(locationLabel, hotelName, starText, city, distanceFromCenter, amenityOne, amenityTwo, style);
            case 2 -> "%s suits travelers planning a %s in %s, with a %s location, %s, and useful touches like %s and %s."
                    .formatted(hotelName, style, city, starText, distanceFromCenter, amenityOne, amenityThree);
            case 3 -> "For guests who want %s with practical comfort, %s combines a %s setting %s with %s, %s, and %s."
                    .formatted(city, hotelName, starText, locationLabel, amenityOne, amenityTwo, amenityThree);
            case 4 -> "%s is a %s hotel %s, positioned %s and designed around %s, %s, and relaxed %s stays."
                    .formatted(hotelName, starText, locationLabel, distanceFromCenter, amenityOne, amenityTwo, style);
            case 5 -> "A good fit for a %s visit to %s, %s places guests %s, %s from the center, with %s and %s close at hand."
                    .formatted(style, city, hotelName, locationLabel, distanceFromCenter, amenityOne, amenityTwo);
            case 6 -> "%s brings together a %s standard, a %s address, and guest-friendly facilities such as %s, %s, and %s."
                    .formatted(hotelName, starText, locationLabel, amenityOne, amenityTwo, amenityThree);
            case 7 -> "From %s, %s makes %s easy to explore while offering %s comfort, %s, and %s for %s travelers."
                    .formatted(locationLabel, hotelName, city, starText, amenityOne, amenityTwo, style);
            case 8 -> "%s works well for visitors who prefer a %s stay in %s: %s, %s from the center, plus %s and %s."
                    .formatted(hotelName, style, city, locationLabel, distanceFromCenter, amenityOne, amenityThree);
            case 9 -> "With a %s profile and a spot %s, %s gives guests %s access to %s, backed by %s and %s."
                    .formatted(starText, locationLabel, hotelName, distanceFromCenter, city, amenityOne, amenityTwo);
            case 10 -> "%s is tailored for a %s trip to %s, offering a %s location, %s, %s, and %s."
                    .formatted(hotelName, style, city, locationLabel, distanceFromCenter, amenityOne, amenityTwo);
            default -> "Guests at %s stay %s in %s, where the %s setting, %s, %s, and %s support an easy %s visit."
                    .formatted(hotelName, locationLabel, city, starText, distanceFromCenter, amenityOne, amenityTwo, style);
        };
    }

    private String amenityForSentence(List<String> amenities, int hash, int offset) {
        List<String> source = amenities == null || amenities.isEmpty() ? DEFAULT_AMENITIES : amenities;
        int start = positive(hash / 13, source.size());
        return source.get((start + offset) % source.size()).toLowerCase(Locale.ROOT);
    }

    private int stableHash(String... values) {
        return String.join("|", values).hashCode();
    }

    private int positive(int value, int modulo) {
        return Math.floorMod(value, modulo);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private double clampDouble(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double roundRating(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
