package com.sep.flight_backend.entity.flight;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "flight_offers")
public class FlightOfferEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String externalOfferId;
    private String flightNumber;
    private String status;
    private String legType;
    private String airlineCode;
    private String airlineName;
    private String airlineColorClass;
    private String departureTime;
    private String departureAirport;
    private String departureCity;
    private String departureTerminal;
    private String arrivalTime;
    private String arrivalAirport;
    private String arrivalCity;
    private String arrivalTerminal;
    private String duration;
    private Integer stops;
    private String stopDetails;
    private BigDecimal price;
    private String currency;
    private Boolean carryOnIncluded;
    private Boolean checkedBagIncluded;
    private Integer carryOnWeightKg;
    private Integer checkedBagWeightKg;
    private String badgeType;
    private String badgeLabel;
    private Boolean selected = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "search_id", nullable = false)
    private FlightSearchEntity search;

    public Long getId() {
        return id;
    }

    public String getExternalOfferId() {
        return externalOfferId;
    }

    public void setExternalOfferId(String externalOfferId) {
        this.externalOfferId = externalOfferId;
    }

    public String getFlightNumber() {
        return flightNumber;
    }

    public void setFlightNumber(String flightNumber) {
        this.flightNumber = flightNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getLegType() {
        return legType;
    }

    public void setLegType(String legType) {
        this.legType = legType;
    }

    public String getAirlineCode() {
        return airlineCode;
    }

    public void setAirlineCode(String airlineCode) {
        this.airlineCode = airlineCode;
    }

    public String getAirlineName() {
        return airlineName;
    }

    public void setAirlineName(String airlineName) {
        this.airlineName = airlineName;
    }

    public String getAirlineColorClass() {
        return airlineColorClass;
    }

    public void setAirlineColorClass(String airlineColorClass) {
        this.airlineColorClass = airlineColorClass;
    }

    public String getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(String departureTime) {
        this.departureTime = departureTime;
    }

    public String getDepartureAirport() {
        return departureAirport;
    }

    public void setDepartureAirport(String departureAirport) {
        this.departureAirport = departureAirport;
    }

    public String getDepartureCity() {
        return departureCity;
    }

    public void setDepartureCity(String departureCity) {
        this.departureCity = departureCity;
    }

    public String getDepartureTerminal() {
        return departureTerminal;
    }

    public void setDepartureTerminal(String departureTerminal) {
        this.departureTerminal = departureTerminal;
    }

    public String getArrivalTime() {
        return arrivalTime;
    }

    public void setArrivalTime(String arrivalTime) {
        this.arrivalTime = arrivalTime;
    }

    public String getArrivalAirport() {
        return arrivalAirport;
    }

    public void setArrivalAirport(String arrivalAirport) {
        this.arrivalAirport = arrivalAirport;
    }

    public String getArrivalCity() {
        return arrivalCity;
    }

    public void setArrivalCity(String arrivalCity) {
        this.arrivalCity = arrivalCity;
    }

    public String getArrivalTerminal() {
        return arrivalTerminal;
    }

    public void setArrivalTerminal(String arrivalTerminal) {
        this.arrivalTerminal = arrivalTerminal;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public Integer getStops() {
        return stops;
    }

    public void setStops(Integer stops) {
        this.stops = stops;
    }

    public String getStopDetails() {
        return stopDetails;
    }

    public void setStopDetails(String stopDetails) {
        this.stopDetails = stopDetails;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Boolean getCarryOnIncluded() {
        return carryOnIncluded;
    }

    public void setCarryOnIncluded(Boolean carryOnIncluded) {
        this.carryOnIncluded = carryOnIncluded;
    }

    public Boolean getCheckedBagIncluded() {
        return checkedBagIncluded;
    }

    public void setCheckedBagIncluded(Boolean checkedBagIncluded) {
        this.checkedBagIncluded = checkedBagIncluded;
    }

    public Integer getCarryOnWeightKg() {
        return carryOnWeightKg;
    }

    public void setCarryOnWeightKg(Integer carryOnWeightKg) {
        this.carryOnWeightKg = carryOnWeightKg;
    }

    public Integer getCheckedBagWeightKg() {
        return checkedBagWeightKg;
    }

    public void setCheckedBagWeightKg(Integer checkedBagWeightKg) {
        this.checkedBagWeightKg = checkedBagWeightKg;
    }

    public String getBadgeType() {
        return badgeType;
    }

    public void setBadgeType(String badgeType) {
        this.badgeType = badgeType;
    }

    public String getBadgeLabel() {
        return badgeLabel;
    }

    public void setBadgeLabel(String badgeLabel) {
        this.badgeLabel = badgeLabel;
    }

    public Boolean getSelected() {
        return selected;
    }

    public void setSelected(Boolean selected) {
        this.selected = selected;
    }

    public FlightSearchEntity getSearch() {
        return search;
    }

    public void setSearch(FlightSearchEntity search) {
        this.search = search;
    }
}
