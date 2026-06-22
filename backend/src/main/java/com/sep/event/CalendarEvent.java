package com.sep.event;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Persisted travel calendar item shared by imported bookings and manually added plans.
 *
 * <p>The start and end timestamps are intentionally generic so different frontend
 * event types can represent point-in-time activities or multi-day stays.</p>
 */
@Entity
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trip_id")
    private Long tripId;

    private String title;

    @Column(length = 1000)
    private String description;

    private String location;

    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;

    private String category;

    private Double budgetCost;

    @Column(length = 2000)
    private String notes;

    public Long getId() {
        return id;
    }

    public Long getTripId() {
        return tripId;
    }

    public void setTripId(Long tripId) {
        this.tripId = tripId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public LocalDateTime getStartDateTime() {
        return startDateTime;
    }

    public void setStartDateTime(LocalDateTime startDateTime) {
        this.startDateTime = startDateTime;
    }

    public LocalDateTime getEndDateTime() {
        return endDateTime;
    }

    public void setEndDateTime(LocalDateTime endDateTime) {
        this.endDateTime = endDateTime;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Double getBudgetCost() {
        return budgetCost;
    }

    public void setBudgetCost(Double budgetCost) {
        this.budgetCost = budgetCost;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
