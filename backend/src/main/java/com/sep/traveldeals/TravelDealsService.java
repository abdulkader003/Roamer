package com.sep.traveldeals;

import com.sep.activity.ActivityEntity;
import com.sep.activity.ActivityRepository;
import com.sep.activity.ActivityDto;
import com.sep.activity.ActivitiesService;
import com.sep.flight.entity.flight.FlightOfferEntity;
import com.sep.flight.entity.flight.FlightSearchEntity;
import com.sep.flight.repository.flight.FlightOfferRepository;
import com.sep.hotel.dto.HotelResponse;
import com.sep.hotel.model.Hotel;
import com.sep.hotel.repository.HotelRepository;
import com.sep.hotel.service.HotelService;
import com.sep.trip.Trip;
import com.sep.trip.TripRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;

@Service
public class TravelDealsService {

    private static final List<String> DEFAULT_DESTINATIONS = List.of("Barcelona", "Paris", "Rome", "Amsterdam", "Milan");
    private static final BigDecimal DEFAULT_FLIGHT_PRICE = BigDecimal.valueOf(99);
    private static final List<String> DEAL_AIRLINES = List.of(
            "Lufthansa", "Eurowings", "Air France", "KLM", "Iberia", "easyJet", "Ryanair"
    );
    private static final List<String> FLIGHT_DEAL_NAMES = List.of(
            "Flash fare to %s",
            "Weekend escape to %s",
            "Smart saver flight to %s",
            "City break deal to %s",
            "Last-minute route to %s",
            "Budget-friendly hop to %s",
            "Direct flight pick to %s"
    );

    private final AppUserRepository userRepository;
    private final TripRepository tripRepository;
    private final FlightOfferRepository flightOfferRepository;
    private final HotelRepository hotelRepository;
    private final ActivityRepository activityRepository;
    private final HotelService hotelService;
    private final ActivitiesService activitiesService;

    public TravelDealsService(
            AppUserRepository userRepository,
            TripRepository tripRepository,
            FlightOfferRepository flightOfferRepository,
            HotelRepository hotelRepository,
            ActivityRepository activityRepository,
            HotelService hotelService,
            ActivitiesService activitiesService
    ) {
        this.userRepository = userRepository;
        this.tripRepository = tripRepository;
        this.flightOfferRepository = flightOfferRepository;
        this.hotelRepository = hotelRepository;
        this.activityRepository = activityRepository;
        this.hotelService = hotelService;
        this.activitiesService = activitiesService;
    }

    @Transactional
    public List<TravelDealResponse> findDealsForUser(String email) {
        return findDealsForUser(email, null);
    }

    @Transactional(readOnly = true)
    public List<TravelDealResponse> findDealsForUser(String email, String refreshKey) {
        AppUser user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user was not found."));

        List<Trip> trips = tripRepository.findAllAccessibleByUserIdOrderByStartDateAsc(user.getId());
        boolean freshRefresh = StringUtils.hasText(refreshKey);
        String rotationKey = freshRefresh ? refreshKey : "initial";
        List<String> destinationCities = rotateList(preferredDestinations(trips), rotationKey + ":destinations");
        List<TravelDealResponse> deals = new ArrayList<>();

        for (String destination : destinationCities) {
            findFlightDeal(user, destination, rotationKey, freshRefresh).ifPresent(deals::add);
            findHotelDeal(destination).ifPresent(deals::add);
            findActivityDeal(destination).ifPresent(deals::add);

            if (deals.size() >= 9) {
                break;
            }
        }

        Collections.shuffle(deals, new Random(stableHash(rotationKey + ":deals")));
        return deals.stream()
                .limit(9)
                .toList();
    }

    private java.util.Optional<TravelDealResponse> findFlightDeal(
            AppUser user,
            String destination,
            String rotationKey,
            boolean freshRefresh
    ) {
        // Refresh should create fresh local flight deals, not spend AeroDataBox requests or reshuffle old cards.
        if (!freshRefresh) {
            java.util.Optional<FlightOfferEntity> cachedOffer = flightOfferRepository.findBySelectedTrue().stream()
                    .filter(offer -> offer.getPrice() != null)
                    .filter(offer -> matchesDestination(offer, destination))
                    .min(Comparator.comparing(FlightOfferEntity::getPrice));

            if (cachedOffer.isPresent()) {
                FlightOfferEntity offer = cachedOffer.get();
                return java.util.Optional.of(new TravelDealResponse(
                        "flight-offer-" + offer.getId(),
                        "FLIGHT",
                        fallback(offer.getAirlineName(), "Cached flight") + " to " + fallback(offer.getArrivalCity(), destination),
                        fallback(offer.getDepartureAirport(), fallback(offer.getDepartureCity(), null)),
                        fallback(offer.getArrivalCity(), destination),
                        offer.getPrice().setScale(0, RoundingMode.HALF_UP),
                        fallback(offer.getCurrency(), "EUR"),
                        fallback(offer.getAirlineName(), "Flight inventory"),
                        flightDescription(offer),
                        "View flight",
                        cachedFlightDealRoute(offer, destination)
                ));
            }
        }

        return java.util.Optional.of(suggestedFlightDeal(user, destination, rotationKey));
    }

    private TravelDealResponse suggestedFlightDeal(AppUser user, String destination, String rotationKey) {
        String origin = StringUtils.hasText(user.getHomeAirport()) ? user.getHomeAirport() : "Your home airport";
        int suggestionSeed = stableHash(rotationKey + ":suggested-flight:" + destination);
        BigDecimal suggestedPrice = DEFAULT_FLIGHT_PRICE.add(BigDecimal.valueOf(Math.floorMod(suggestionSeed, 120)));
        LocalDate departureDate = LocalDate.now().plusDays(7L + Math.floorMod(suggestionSeed, 45));
        String airline = DEAL_AIRLINES.get(Math.floorMod(suggestionSeed, DEAL_AIRLINES.size()));
        String dealName = FLIGHT_DEAL_NAMES.get(Math.floorMod(suggestionSeed / 7, FLIGHT_DEAL_NAMES.size()))
                .formatted(destination);
        String duration = (1 + Math.floorMod(suggestionSeed, 3)) + "h " + (10 + Math.floorMod(suggestionSeed, 45)) + "m";

        return new TravelDealResponse(
                "flight-" + slug(destination) + "-" + Math.floorMod(suggestionSeed, 10_000),
                "FLIGHT",
                dealName,
                origin,
                destination,
                suggestedPrice,
                "EUR",
                airline,
                departureDate + " · " + duration + " · " + (Math.floorMod(suggestionSeed, 4) == 0 ? "1 stop" : "Direct"),
                "Search flights",
                suggestedFlightDealRoute(origin, destination, departureDate)
        );
    }

    private List<TravelDealResponse> findHotelDeals(String destination, String rotationKey) {
        List<TravelDealResponse> liveDeals = findLiveHotelDeals(destination, rotationKey);
        if (!liveDeals.isEmpty()) {
            return liveDeals;
        }

        List<Hotel> hotels = hotelRepository.findByCityContainingIgnoreCase(destination).stream()
                .filter(hotel -> hotel.getPricePerNight() != null)
                .toList();

        int stayNights = stayNights(rotationKey, destination);
        LocalDate checkIn = dealDate(rotationKey, "hotel", destination);

        return rotatingWindow(hotels, Comparator.comparing(Hotel::getPricePerNight), rotationKey + ":cached-hotel:" + destination)
                .stream()
                .map(hotel -> new TravelDealResponse(
                        "hotel-" + hotel.getId(),
                        "HOTEL",
                        hotel.getName(),
                        null,
                        fallback(hotel.getCity(), destination),
                        hotelDealTotal(hotel, stayNights).setScale(0, RoundingMode.HALF_UP),
                        "EUR",
                        fallback(hotel.getSource(), "Hotel inventory"),
                        hotelDescription(hotel),
                        "View hotels",
                        hotelDealRoute(fallback(hotel.getCity(), destination), hotel.getId(), checkIn, stayNights)
                ))
                .toList();
    }

    private List<TravelDealResponse> findLiveHotelDeals(String destination, String rotationKey) {
        LocalDate checkIn = dealDate(rotationKey, "hotel", destination);
        int stayNights = stayNights(rotationKey, destination);
        String checkInText = checkIn.toString();
        String checkOutText = checkIn.plusDays(stayNights).toString();

        try {
            List<HotelResponse> hotels = hotelService.searchHotels(destination, checkInText, checkOutText, 2, 0).stream()
                    .filter(hotel -> hotel.pricePerNight() != null)
                    .toList();

            return rotatingWindow(hotels, Comparator.comparing(HotelResponse::pricePerNight), rotationKey + ":live-hotel:" + destination)
                    .stream()
                    .map(hotel -> new TravelDealResponse(
                            "hotel-live-" + hotel.id(),
                            "HOTEL",
                            hotel.name(),
                            null,
                            fallback(hotel.city(), destination),
                            hotel.pricePerNight().multiply(BigDecimal.valueOf(stayNights)).setScale(0, RoundingMode.HALF_UP),
                            "EUR",
                            "Agoda RapidAPI",
                            hotelDescription(hotel),
                            "View exact hotel",
                            hotelDealRoute(fallback(hotel.city(), destination), hotel.id(), checkIn, stayNights)
                    ))
                    .toList();
        } catch (RuntimeException ex) {
            log.warn("Live hotel deal search failed for '{}': {}", destination, ex.getMessage());
            return List.of();
        }
    }

    private List<TravelDealResponse> findActivityDeals(String destination, String rotationKey) {
        List<TravelDealResponse> liveDeals = findLiveActivityDeals(destination, rotationKey);
        if (!liveDeals.isEmpty()) {
            return liveDeals;
        }

        List<ActivityEntity> activities = activityRepository.findByCityIgnoreCaseOrderByStartDateAsc(destination).stream()
                .filter(activity -> activityPrice(activity) != null)
                .toList();

        return rotatingWindow(activities, Comparator.comparing(this::activityPrice), rotationKey + ":cached-activity:" + destination)
                .stream()
                .map(activity -> new TravelDealResponse(
                        "activity-" + activity.getId(),
                        "ACTIVITY",
                        activity.getTitle(),
                        null,
                        fallback(activity.getCity(), destination),
                        activityPrice(activity).setScale(0, RoundingMode.HALF_UP),
                        fallback(activity.getPriceCurrency(), "EUR"),
                        fallback(activity.getSource(), "Activity inventory"),
                        activityDescription(activity),
                        "View activities",
                        activityDealRoute(activity)
                ))
                .toList();
    }

    private List<TravelDealResponse> findLiveActivityDeals(String destination, String rotationKey) {
        try {
            List<ActivityDto> activities = activitiesService.getActivities(destination, null, 0, 12).getItems().stream()
                    .filter(activity -> activityPrice(activity) != null)
                    .toList();

            return rotatingWindow(activities, Comparator.comparing(this::activityPrice), rotationKey + ":live-activity:" + destination)
                    .stream()
                    .map(activity -> new TravelDealResponse(
                            "activity-live-" + activity.getId(),
                            "ACTIVITY",
                            activity.getTitle(),
                            null,
                            fallback(activity.getCity(), destination),
                            activityPrice(activity).setScale(0, RoundingMode.HALF_UP),
                            fallback(activity.getPriceCurrency(), "EUR"),
                            fallback(activity.getSource(), "Ticketmaster"),
                            activityDescription(activity),
                            "View exact activity",
                            "/activities/" + encode(activity.getId())
                    ))
                    .toList();
        } catch (RuntimeException ex) {
            log.warn("Live activity deal search failed for '{}': {}", destination, ex.getMessage());
            return List.of();
        }
    }

    private List<String> preferredDestinations(List<Trip> trips) {
        Set<String> cities = new LinkedHashSet<>();

        // User-owned trip data comes first so the quick action feels personal.
        for (Trip trip : trips) {
            addCity(cities, trip.getDestination());
            if (StringUtils.hasText(trip.getDestinationCities())) {
                for (String city : trip.getDestinationCities().split("[,;>]")) {
                    addCity(cities, city);
                }
            }
        }

        DEFAULT_DESTINATIONS.forEach(city -> addCity(cities, city));
        return cities.stream().limit(8).toList();
    }

    private void addCity(Set<String> cities, String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }

        String cleaned = value.trim()
                .replace("→", ",")
                .replace("->", ",")
                .split(",")[0]
                .trim();

        if (StringUtils.hasText(cleaned)) {
            cities.add(toTitleCase(cleaned));
        }
    }

    private <T> List<T> rotatingWindow(List<T> items, Comparator<T> comparator, String rotationKey) {
        List<T> rotationPool = items.stream()
                .sorted(comparator)
                .limit(DEAL_ROTATION_POOL_SIZE)
                .toList();

        if (rotationPool.isEmpty()) {
            return List.of();
        }

        List<T> rotated = rotateList(rotationPool, rotationKey);
        return rotated.stream()
                .limit(DEALS_PER_TYPE_PER_DESTINATION)
                .toList();
    }

    private <T> List<T> rotateList(List<T> items, String rotationKey) {
        if (items.size() <= 1) {
            return items;
        }

        List<T> rotated = new ArrayList<>(items);
        Collections.rotate(rotated, -Math.floorMod(stableHash(rotationKey), rotated.size()));
        return rotated;
    }

    private int stableHash(String value) {
        return value == null ? 0 : value.hashCode();
    }

    private LocalDate dealDate(String rotationKey, String dealType, String destination) {
        int dayOffset = 7 + Math.floorMod(stableHash(rotationKey + ":" + dealType + ":" + destination), 45);
        return LocalDate.now().plusDays(dayOffset);
    }

    private int stayNights(String rotationKey, String destination) {
        return 2 + Math.floorMod(stableHash(rotationKey + ":hotel-nights:" + destination), 4);
    }

    private BigDecimal activityPrice(ActivityEntity activity) {
        Double price = activity.getPrice() != null
                ? activity.getPrice()
                : activity.getMinPrice();

        return price == null ? null : BigDecimal.valueOf(price);
    }

    private BigDecimal activityPrice(ActivityDto activity) {
        Double price = activity.getPrice() != null
                ? activity.getPrice()
                : activity.getMinPrice();

        return price == null ? null : BigDecimal.valueOf(price);
    }

    private boolean matchesDestination(FlightOfferEntity offer, String destination) {
        String normalizedDestination = destination.toLowerCase(Locale.ROOT);
        return containsIgnoreCase(offer.getArrivalCity(), normalizedDestination)
                || containsIgnoreCase(offer.getArrivalAirport(), normalizedDestination)
                || containsIgnoreCase(offer.getDepartureCity(), normalizedDestination)
                || containsIgnoreCase(offer.getDepartureAirport(), normalizedDestination);
    }

    private boolean containsIgnoreCase(String value, String normalizedNeedle) {
        return StringUtils.hasText(value) && value.toLowerCase(Locale.ROOT).contains(normalizedNeedle);
    }

    private <T> List<T> rotateList(List<T> items, String rotationKey) {
        if (items.size() <= 1 || "initial:destinations".equals(rotationKey)) {
            return items;
        }

        int startIndex = rotatingIndex(items.size(), rotationKey);
        List<T> rotated = new ArrayList<>(items.size());
        rotated.addAll(items.subList(startIndex, items.size()));
        rotated.addAll(items.subList(0, startIndex));
        return rotated;
    }

    private int rotatingIndex(int size, String rotationKey) {
        return size <= 1 ? 0 : Math.floorMod(stableHash(rotationKey), size);
    }

    private int stableHash(String value) {
        return value == null ? 0 : value.hashCode();
    }

    private String flightDescription(FlightOfferEntity offer) {
        List<String> details = new ArrayList<>();
        if (StringUtils.hasText(offer.getFlightNumber())) {
            details.add(offer.getFlightNumber());
        }
        if (StringUtils.hasText(offer.getDuration())) {
            details.add(offer.getDuration());
        }
        if (offer.getStops() != null) {
            details.add(offer.getStops() == 0 ? "Direct" : offer.getStops() + " stops");
        }

        return details.isEmpty() ? "Cached flight offer from Roamer inventory." : String.join(" · ", details);
    }

    private String cachedFlightDealRoute(FlightOfferEntity offer, String destination) {
        FlightSearchEntity search = offer.getSearch();
        String flightId = fallback(offer.getExternalOfferId(), offer.getFlightNumber());

        if (search == null) {
            return suggestedFlightDealRoute(
                    fallback(offer.getDepartureAirport(), fallback(offer.getDepartureCity(), "")),
                    fallback(offer.getArrivalAirport(), fallback(offer.getArrivalCity(), destination))
            ) + "&flightId=" + encode(flightId);
        }

        String route = "/flights?tripType=" + encode(fallback(search.getTripType(), "one-way"))
                + "&from=" + encode(airportQuery(search.getFromCity(), search.getFromCode(), offer.getDepartureAirport()))
                + "&to=" + encode(airportQuery(search.getToCity(), search.getToCode(), offer.getArrivalAirport()))
                + "&departureDate=" + search.getDepartureDate()
                + "&travelers=" + valueOrDefault(search.getTravelers(), valueOrDefault(search.getAdults(), 1))
                + "&autoSearch=true";

        if (search.getId() != null) {
            route += "&searchId=" + search.getId();
        }

        if (search.getReturnDate() != null) {
            route += "&returnDate=" + search.getReturnDate();
        }

        return StringUtils.hasText(flightId)
                ? route + "&flightId=" + encode(flightId)
                : route;
    }

    private String suggestedFlightDealRoute(String origin, String destination) {
        return suggestedFlightDealRoute(origin, destination, LocalDate.now().plusDays(14));
    }

    private String suggestedFlightDealRoute(String origin, String destination, LocalDate departureDate) {
        return "/flights?from=" + encode(origin)
                + "&to=" + encode(destination)
                + "&departureDate=" + departureDate
                + "&autoSearch=true";
    }

    private String hotelDealRoute(String destination, Long hotelId, LocalDate checkIn, int stayNights) {
        String route = "/hotels?location=" + encode(destination)
                + "&checkIn=" + checkIn
                + "&checkOut=" + checkIn.plusDays(stayNights)
                + "&adults=2"
                + "&children=0"
                + "&autoSearch=true";

        return hotelId == null ? route : route + "&hotelId=" + hotelId;
    }

    private BigDecimal hotelDealTotal(Hotel hotel, int stayNights) {
        return hotel.getPricePerNight().multiply(BigDecimal.valueOf(stayNights));
    }

    private String activityDealRoute(ActivityEntity activity) {
        String activityId = StringUtils.hasText(activity.getExternalId())
                ? activity.getExternalId()
                : String.valueOf(activity.getId());
        return "/activities/" + encode(activityId);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String airportQuery(String city, String code, String fallbackCode) {
        String selectedCode = fallback(code, fallbackCode);
        if (StringUtils.hasText(city) && StringUtils.hasText(selectedCode)) {
            return city + " (" + selectedCode + ")";
        }

        return fallback(selectedCode, fallback(city, ""));
    }

    private Integer valueOrDefault(Integer value, Integer fallback) {
        return value == null ? fallback : value;
    }

    private String hotelDescription(Hotel hotel) {
        List<String> details = new ArrayList<>();
        if (hotel.getStars() != null) {
            details.add(hotel.getStars() + " stars");
        }
        if (hotel.getRatingScore() != null) {
            details.add("rated " + hotel.getRatingScore());
        }
        if (StringUtils.hasText(hotel.getDistanceFromCenter())) {
            details.add(hotel.getDistanceFromCenter());
        }

        return details.isEmpty() ? "Cached hotel option from Roamer inventory." : String.join(" · ", details);
    }

    private String hotelDescription(HotelResponse hotel) {
        List<String> details = new ArrayList<>();
        if (hotel.stars() != null) {
            details.add(hotel.stars() + " stars");
        }
        if (hotel.ratingScore() != null) {
            details.add("rated " + hotel.ratingScore());
        }
        if (StringUtils.hasText(hotel.distanceFromCenter())) {
            details.add(hotel.distanceFromCenter());
        }

        return details.isEmpty() ? "Live hotel option from Agoda." : String.join(" · ", details);
    }

    private String activityDescription(ActivityEntity activity) {
        List<String> details = new ArrayList<>();
        if (StringUtils.hasText(activity.getCategory())) {
            details.add(activity.getCategory());
        }
        if (activity.getStartDate() != null && activity.getStartDate().toLocalDate().isAfter(LocalDate.now())) {
            details.add(activity.getStartDate().toLocalDate().toString());
        }
        if (StringUtils.hasText(activity.getVenue())) {
            details.add(activity.getVenue());
        }

        return details.isEmpty() ? "Cached activity option from Roamer inventory." : String.join(" · ", details);
    }

    private String activityDescription(ActivityDto activity) {
        List<String> details = new ArrayList<>();
        if (StringUtils.hasText(activity.getCategory())) {
            details.add(activity.getCategory());
        }
        if (activity.getStartDate() != null && activity.getStartDate().toLocalDate().isAfter(LocalDate.now())) {
            details.add(activity.getStartDate().toLocalDate().toString());
        }
        if (StringUtils.hasText(activity.getVenue())) {
            details.add(activity.getVenue());
        }

        return details.isEmpty() ? "Live activity option from Ticketmaster." : String.join(" · ", details);
    }

    private String fallback(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private String slug(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private String toTitleCase(String value) {
        String[] words = value.toLowerCase(Locale.ROOT).split("\\s+");
        List<String> titled = new ArrayList<>();
        for (String word : words) {
            if (word.isBlank()) {
                continue;
            }
            titled.add(word.substring(0, 1).toUpperCase(Locale.ROOT) + word.substring(1));
        }
        return String.join(" ", titled);
    }
}
