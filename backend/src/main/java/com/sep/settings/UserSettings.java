package com.sep.settings;

import com.sep.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_settings")
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false, unique = true)
    private AppUser owner;

    @Column(nullable = false)
    private boolean tripReminders = true;

    @Column(nullable = false)
    private boolean budgetAlerts = true;

    @Column(nullable = false)
    private boolean bookingUpdates = false;

    @Column(nullable = false, length = 20)
    private String defaultCalendarView = "monthly";

    @Column(nullable = false)
    private boolean shareTripData = false;

    @Column(nullable = false)
    private boolean allowAnalytics = true;

    public Long getId() {
        return id;
    }

    public AppUser getOwner() {
        return owner;
    }

    public void setOwner(AppUser owner) {
        this.owner = owner;
    }

    public boolean isTripReminders() {
        return tripReminders;
    }

    public void setTripReminders(boolean tripReminders) {
        this.tripReminders = tripReminders;
    }

    public boolean isBudgetAlerts() {
        return budgetAlerts;
    }

    public void setBudgetAlerts(boolean budgetAlerts) {
        this.budgetAlerts = budgetAlerts;
    }

    public boolean isBookingUpdates() {
        return bookingUpdates;
    }

    public void setBookingUpdates(boolean bookingUpdates) {
        this.bookingUpdates = bookingUpdates;
    }

    public String getDefaultCalendarView() {
        return defaultCalendarView;
    }

    public void setDefaultCalendarView(String defaultCalendarView) {
        this.defaultCalendarView = defaultCalendarView;
    }

    public boolean isShareTripData() {
        return shareTripData;
    }

    public void setShareTripData(boolean shareTripData) {
        this.shareTripData = shareTripData;
    }

    public boolean isAllowAnalytics() {
        return allowAnalytics;
    }

    public void setAllowAnalytics(boolean allowAnalytics) {
        this.allowAnalytics = allowAnalytics;
    }
}
