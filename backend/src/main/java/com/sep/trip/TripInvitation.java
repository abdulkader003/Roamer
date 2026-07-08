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
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "trip_invitations",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_trip_invitations_trip_user_status",
                        columnNames = {"trip_id", "invited_user_id", "status"}
                )
        }
)
public class TripInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_user_id", nullable = false)
    private AppUser invitedUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_by_id", nullable = false)
    private AppUser invitedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TripInvitationStatus status;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

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

    public Trip getTrip() {
        return trip;
    }

    public void setTrip(Trip trip) {
        this.trip = trip;
    }

    public AppUser getInvitedUser() {
        return invitedUser;
    }

    public void setInvitedUser(AppUser invitedUser) {
        this.invitedUser = invitedUser;
    }

    public AppUser getInvitedBy() {
        return invitedBy;
    }

    public void setInvitedBy(AppUser invitedBy) {
        this.invitedBy = invitedBy;
    }

    public TripInvitationStatus getStatus() {
        return status;
    }

    public void setStatus(TripInvitationStatus status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
