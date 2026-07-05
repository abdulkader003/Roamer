package com.sep.trip;

import com.sep.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * A persisted travel plan owned by one application user.
 *
 * <p>Trips deliberately store date-only values because the overview does not
 * need timezone-specific arrival or departure timestamps.</p>
 */
@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 120)
    private String destination;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal budget;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TripStatus status;

    @Column
    private Long tripPlanningId;

    @Column(length = 160)
    private String origin;

    @Column(columnDefinition = "TEXT")
    private String destinationCities;

    @Column(length = 12)
    private String currency;

    @Column
    private Integer durationNights;

    @Column(length = 80)
    private String travelStyle;

    @Column
    private Integer travelers;

    @Column(length = 220)
    private String flightId;

    @Column(length = 160)
    private String flightTitle;

    @Column(length = 160)
    private String flightAirline;

    @Column(length = 160)
    private String flightNumber;

    @Column(length = 24)
    private String flightDepartureTime;

    @Column(length = 24)
    private String flightArrivalTime;

    @Column(length = 120)
    private String flightDuration;

    @Column(length = 160)
    private String flightStops;

    @Column(length = 300)
    private String flightDetails;

    @Column(precision = 12, scale = 2)
    private BigDecimal flightTotal;

    @Column(columnDefinition = "TEXT")
    private String flightSegmentsJson;

    @Column(length = 160)
    private String hotelName;

    @Column(length = 120)
    private String hotelCity;

    @Column
    private Integer hotelStars;

    @Column(length = 300)
    private String hotelDetails;

    @Column(precision = 12, scale = 2)
    private BigDecimal hotelTotal;

    @Column(columnDefinition = "TEXT")
    private String hotelStaysJson;

    @Column(length = 160)
    private String activitiesTitle;

    @Column(length = 500)
    private String activitiesDetails;

    @Column(columnDefinition = "TEXT")
    private String activitiesJson;

    @Column(precision = 12, scale = 2)
    private BigDecimal activitiesTotal;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    /**
     * Records creation time once while still allowing tests to supply a value.
     */
    @PrePersist
    void assignCreatedAt() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public BigDecimal getBudget() {
        return budget;
    }

    public void setBudget(BigDecimal budget) {
        this.budget = budget;
    }

    public TripStatus getStatus() {
        return status;
    }

    public void setStatus(TripStatus status) {
        this.status = status;
    }

    public Long getTripPlanningId() {
        return tripPlanningId;
    }

    public void setTripPlanningId(Long tripPlanningId) {
        this.tripPlanningId = tripPlanningId;
    }

    public String getOrigin() {
        return origin;
    }

    public void setOrigin(String origin) {
        this.origin = origin;
    }

    public String getDestinationCities() {
        return destinationCities;
    }

    public void setDestinationCities(String destinationCities) {
        this.destinationCities = destinationCities;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Integer getDurationNights() {
        return durationNights;
    }

    public void setDurationNights(Integer durationNights) {
        this.durationNights = durationNights;
    }

    public String getTravelStyle() {
        return travelStyle;
    }

    public void setTravelStyle(String travelStyle) {
        this.travelStyle = travelStyle;
    }

    public Integer getTravelers() {
        return travelers;
    }

    public void setTravelers(Integer travelers) {
        this.travelers = travelers;
    }

    public String getFlightId() {
        return flightId;
    }

    public void setFlightId(String flightId) {
        this.flightId = flightId;
    }

    public String getFlightTitle() {
        return flightTitle;
    }

    public void setFlightTitle(String flightTitle) {
        this.flightTitle = flightTitle;
    }

    public String getFlightAirline() {
        return flightAirline;
    }

    public void setFlightAirline(String flightAirline) {
        this.flightAirline = flightAirline;
    }

    public String getFlightNumber() {
        return flightNumber;
    }

    public void setFlightNumber(String flightNumber) {
        this.flightNumber = flightNumber;
    }

    public String getFlightDepartureTime() {
        return flightDepartureTime;
    }

    public void setFlightDepartureTime(String flightDepartureTime) {
        this.flightDepartureTime = flightDepartureTime;
    }

    public String getFlightArrivalTime() {
        return flightArrivalTime;
    }

    public void setFlightArrivalTime(String flightArrivalTime) {
        this.flightArrivalTime = flightArrivalTime;
    }

    public String getFlightDuration() {
        return flightDuration;
    }

    public void setFlightDuration(String flightDuration) {
        this.flightDuration = flightDuration;
    }

    public String getFlightStops() {
        return flightStops;
    }

    public void setFlightStops(String flightStops) {
        this.flightStops = flightStops;
    }

    public String getFlightDetails() {
        return flightDetails;
    }

    public void setFlightDetails(String flightDetails) {
        this.flightDetails = flightDetails;
    }

    public BigDecimal getFlightTotal() {
        return flightTotal;
    }

    public void setFlightTotal(BigDecimal flightTotal) {
        this.flightTotal = flightTotal;
    }

    public String getFlightSegmentsJson() {
        return flightSegmentsJson;
    }

    public void setFlightSegmentsJson(String flightSegmentsJson) {
        this.flightSegmentsJson = flightSegmentsJson;
    }

    public String getHotelName() {
        return hotelName;
    }

    public void setHotelName(String hotelName) {
        this.hotelName = hotelName;
    }

    public String getHotelCity() {
        return hotelCity;
    }

    public void setHotelCity(String hotelCity) {
        this.hotelCity = hotelCity;
    }

    public Integer getHotelStars() {
        return hotelStars;
    }

    public void setHotelStars(Integer hotelStars) {
        this.hotelStars = hotelStars;
    }

    public String getHotelDetails() {
        return hotelDetails;
    }

    public void setHotelDetails(String hotelDetails) {
        this.hotelDetails = hotelDetails;
    }

    public BigDecimal getHotelTotal() {
        return hotelTotal;
    }

    public void setHotelTotal(BigDecimal hotelTotal) {
        this.hotelTotal = hotelTotal;
    }

    public String getHotelStaysJson() {
        return hotelStaysJson;
    }

    public void setHotelStaysJson(String hotelStaysJson) {
        this.hotelStaysJson = hotelStaysJson;
    }

    public String getActivitiesTitle() {
        return activitiesTitle;
    }

    public void setActivitiesTitle(String activitiesTitle) {
        this.activitiesTitle = activitiesTitle;
    }

    public String getActivitiesDetails() {
        return activitiesDetails;
    }

    public void setActivitiesDetails(String activitiesDetails) {
        this.activitiesDetails = activitiesDetails;
    }

    public String getActivitiesJson() {
        return activitiesJson;
    }

    public void setActivitiesJson(String activitiesJson) {
        this.activitiesJson = activitiesJson;
    }

    public BigDecimal getActivitiesTotal() {
        return activitiesTotal;
    }

    public void setActivitiesTotal(BigDecimal activitiesTotal) {
        this.activitiesTotal = activitiesTotal;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public AppUser getOwner() {
        return owner;
    }

    public void setOwner(AppUser owner) {
        this.owner = owner;
    }
}
