package com.sep.tripplanning;

import com.sep.user.AppUser;
import com.sep.hotel.model.Hotel;
import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "trip_planning")
public class TripPlanning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String tripName;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal budget;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false)
    private Integer duration;

    @Column(nullable = false, length = 20)
    private String travelStyle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "selected_hotel_id")
    private Hotel selectedHotel;

    private String selectedHotelName;

    private String selectedHotelCity;

    @Column(precision = 10, scale = 2)
    private BigDecimal selectedHotelPricePerNight;

    private Integer selectedHotelStars;

    private Double selectedHotelRatingScore;

    private String selectedHotelRatingLabel;

    @Column(columnDefinition = "TEXT")
    private String selectedHotelStaysJson;

    @ElementCollection
    @CollectionTable(name = "trip_planning_activities", joinColumns = @JoinColumn(name = "trip_planning_id"))
    private List<TripPlanningActivity> selectedActivities = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTripName() {
        return tripName;
    }

    public void setTripName(String tripName) {
        this.tripName = tripName;
    }

    public BigDecimal getBudget() {
        return budget;
    }

    public void setBudget(BigDecimal budget) {
        this.budget = budget;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Integer getDuration() {
        return duration;
    }

    public void setDuration(Integer duration) {
        this.duration = duration;
    }

    public String getTravelStyle() {
        return travelStyle;
    }

    public void setTravelStyle(String travelStyle) {
        this.travelStyle = travelStyle;
    }

    public AppUser getUser() {
        return user;
    }

    public void setUser(AppUser user) {
        this.user = user;
    }

    public Hotel getSelectedHotel() {
        return selectedHotel;
    }

    public void setSelectedHotel(Hotel selectedHotel) {
        this.selectedHotel = selectedHotel;
    }

    public String getSelectedHotelName() {
        return selectedHotelName;
    }

    public void setSelectedHotelName(String selectedHotelName) {
        this.selectedHotelName = selectedHotelName;
    }

    public String getSelectedHotelCity() {
        return selectedHotelCity;
    }

    public void setSelectedHotelCity(String selectedHotelCity) {
        this.selectedHotelCity = selectedHotelCity;
    }

    public BigDecimal getSelectedHotelPricePerNight() {
        return selectedHotelPricePerNight;
    }

    public void setSelectedHotelPricePerNight(BigDecimal selectedHotelPricePerNight) {
        this.selectedHotelPricePerNight = selectedHotelPricePerNight;
    }

    public Integer getSelectedHotelStars() {
        return selectedHotelStars;
    }

    public void setSelectedHotelStars(Integer selectedHotelStars) {
        this.selectedHotelStars = selectedHotelStars;
    }

    public Double getSelectedHotelRatingScore() {
        return selectedHotelRatingScore;
    }

    public void setSelectedHotelRatingScore(Double selectedHotelRatingScore) {
        this.selectedHotelRatingScore = selectedHotelRatingScore;
    }

    public String getSelectedHotelRatingLabel() {
        return selectedHotelRatingLabel;
    }

    public void setSelectedHotelRatingLabel(String selectedHotelRatingLabel) {
        this.selectedHotelRatingLabel = selectedHotelRatingLabel;
    }

    public String getSelectedHotelStaysJson() {
        return selectedHotelStaysJson;
    }

    public void setSelectedHotelStaysJson(String selectedHotelStaysJson) {
        this.selectedHotelStaysJson = selectedHotelStaysJson;
    }

    public List<TripPlanningActivity> getSelectedActivities() {
        return selectedActivities;
    }

    public void setSelectedActivities(List<TripPlanningActivity> selectedActivities) {
        this.selectedActivities = selectedActivities;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
