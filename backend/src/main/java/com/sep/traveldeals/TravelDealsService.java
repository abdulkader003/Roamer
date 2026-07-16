package com.sep.traveldeals;

import com.sep.activity.ActivityEntity;
import com.sep.activity.ActivityRepository;
import com.sep.flight.entity.flight.FlightOfferEntity;
import com.sep.flight.entity.flight.FlightSearchEntity;
import com.sep.flight.repository.flight.FlightOfferRepository;
import com.sep.hotel.model.Hotel;
import com.sep.hotel.repository.HotelRepository;
import com.sep.trip.Trip;
import com.sep.trip.TripRepository;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
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

    public TravelDealsService(
            AppUserRepository userRepository,
            TripRepository tripRepository,
            FlightOfferRepository flightOfferRepository,
            HotelRepository hotelRepository,
            ActivityRepository activityRepository
    ) {
        this.userRepository = userRepository;
        this.tripRepository = tripRepository;
        this.flightOfferRepository = flightOfferRepository;
        this.hotelRepository = hotelRepository;
        this.activityRepository = activityRepository;
    }

    @Transactional(readOnly = true)
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

    private java.util.Optional<TravelDealResponse> findHotelDeal(String destination) {
        return hotelRepository.findByCityContainingIgnoreCase(destination).stream()
                .filter(hotel -> hotel.getPricePerNight() != null)
                .min(Comparator.comparing(Hotel::getPricePerNight))
                .map(hotel -> new TravelDealResponse(
                        "hotel-" + hotel.getId(),
                        "HOTEL",
                        hotel.getName(),
                        null,
                        fallback(hotel.getCity(), destination),
                        hotelDealTotal(hotel).setScale(0, RoundingMode.HALF_UP),
                        "EUR",
                        fallback(hotel.getSource(), "Hotel inventory"),
                        hotelDescription(hotel),
                        "View hotels",
                        hotelDealRoute(fallback(hotel.getCity(), destination), hotel.getId())
                ));
    }

    private java.util.Optional<TravelDealResponse> findActivityDeal(String destination) {
        return activityRepository.findByCityIgnoreCaseOrderByStartDateAsc(destination).stream()
                .filter(activity -> activityPrice(activity) != null)
                .min(Comparator.comparing(this::activityPrice))
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
                ));
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

    private BigDecimal activityPrice(ActivityEntity activity) {
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

    private String hotelDealRoute(String destination, Long hotelId) {
        LocalDate checkIn = LocalDate.now().plusDays(14);
        String route = "/hotels?location=" + encode(destination)
                + "&checkIn=" + checkIn
                + "&checkOut=" + checkIn.plusDays(3)
                + "&adults=2"
                + "&children=0"
                + "&autoSearch=true";

        return hotelId == null ? route : route + "&hotelId=" + hotelId;
    }

    private BigDecimal hotelDealTotal(Hotel hotel) {
        return hotel.getPricePerNight().multiply(BigDecimal.valueOf(3));
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
