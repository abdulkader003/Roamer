package com.sep.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "activities")
public class ActivityEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String externalId;

    @Column(nullable = false)
    private String title;

    private String type;

    @Column(length = 1200)
    private String url;

    private String locale;
    private String source;
    private String city;
    private String country;
    private String state;
    private String category;
    private String segment;
    private String genre;
    private String subGenre;
    private String priceLevel;
    private String priceCurrency;
    private Double price;
    private Double minPrice;
    private Double maxPrice;
    private Double rating;
    private String timeOfDay;
    private String duration;
    private String venue;
    private String venueId;

    @Column(length = 1200)
    private String venueUrl;

    private String venueTimezone;

    @Column(length = 1200)
    private String venueAddress;

    private String venuePostalCode;
    private Double venueLatitude;
    private Double venueLongitude;

    @Column(length = 3000)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String info;

    @Column(length = 3000)
    private String pleaseNote;

    @Column(length = 1200)
    private String image;

    @Column(length = 1200)
    private String seatmapUrl;

    @Column(length = 2000)
    private String accessibilityInfo;

    @Column(length = 2000)
    private String ticketLimitInfo;

    private String status;
    private String promoterName;

    @Column(length = 2000)
    private String promoterDescription;

    private Boolean featured;
    private Boolean tba;
    private Boolean tbd;
    private Boolean spanMultipleDays;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private LocalDateTime salesStartDate;
    private LocalDateTime salesEndDate;
    private LocalDateTime fetchedAt;
    private LocalDateTime detailFetchedAt;

    @Column(columnDefinition = "TEXT")
    private String salesJson;

    @Column(columnDefinition = "TEXT")
    private String priceRangesJson;

    @Column(columnDefinition = "TEXT")
    private String imagesJson;

    @Column(columnDefinition = "TEXT")
    private String venueDetailsJson;

    @Column(columnDefinition = "TEXT")
    private String attractionsJson;

    @Column(columnDefinition = "TEXT")
    private String classificationsJson;

    @Column(columnDefinition = "TEXT")
    private String promoterJson;

    @Column(columnDefinition = "TEXT")
    private String promotersJson;

    @Column(columnDefinition = "TEXT")
    private String outletsJson;

    @Column(columnDefinition = "TEXT")
    private String productsJson;

    @Column(columnDefinition = "TEXT")
    private String rawEventJson;

    public ActivityEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getExternalId() {
        return externalId;
    }

    public String getTitle() {
        return title;
    }

    public String getType() {
        return type;
    }

    public String getUrl() {
        return url;
    }

    public String getLocale() {
        return locale;
    }

    public String getSource() {
        return source;
    }

    public String getCity() {
        return city;
    }

    public String getCountry() {
        return country;
    }

    public String getState() {
        return state;
    }

    public String getCategory() {
        return category;
    }

    public String getSegment() {
        return segment;
    }

    public String getGenre() {
        return genre;
    }

    public String getSubGenre() {
        return subGenre;
    }

    public String getPriceLevel() {
        return priceLevel;
    }

    public String getPriceCurrency() {
        return priceCurrency;
    }

    public Double getPrice() {
        return price;
    }

    public Double getMinPrice() {
        return minPrice;
    }

    public Double getMaxPrice() {
        return maxPrice;
    }

    public Double getRating() {
        return rating;
    }

    public String getTimeOfDay() {
        return timeOfDay;
    }

    public String getDuration() {
        return duration;
    }

    public String getVenue() {
        return venue;
    }

    public String getVenueId() {
        return venueId;
    }

    public String getVenueUrl() {
        return venueUrl;
    }

    public String getVenueTimezone() {
        return venueTimezone;
    }

    public String getVenueAddress() {
        return venueAddress;
    }

    public String getVenuePostalCode() {
        return venuePostalCode;
    }

    public Double getVenueLatitude() {
        return venueLatitude;
    }

    public Double getVenueLongitude() {
        return venueLongitude;
    }

    public String getDescription() {
        return description;
    }

    public String getInfo() {
        return info;
    }

    public String getPleaseNote() {
        return pleaseNote;
    }

    public String getImage() {
        return image;
    }

    public String getSeatmapUrl() {
        return seatmapUrl;
    }

    public String getAccessibilityInfo() {
        return accessibilityInfo;
    }

    public String getTicketLimitInfo() {
        return ticketLimitInfo;
    }

    public String getStatus() {
        return status;
    }

    public String getPromoterName() {
        return promoterName;
    }

    public String getPromoterDescription() {
        return promoterDescription;
    }

    public Boolean getFeatured() {
        return featured;
    }

    public Boolean getTba() {
        return tba;
    }

    public Boolean getTbd() {
        return tbd;
    }

    public Boolean getSpanMultipleDays() {
        return spanMultipleDays;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public LocalDateTime getEndDate() {
        return endDate;
    }

    public LocalDateTime getSalesStartDate() {
        return salesStartDate;
    }

    public LocalDateTime getSalesEndDate() {
        return salesEndDate;
    }

    public LocalDateTime getFetchedAt() {
        return fetchedAt;
    }

    public LocalDateTime getDetailFetchedAt() {
        return detailFetchedAt;
    }

    public String getSalesJson() {
        return salesJson;
    }

    public String getPriceRangesJson() {
        return priceRangesJson;
    }

    public String getImagesJson() {
        return imagesJson;
    }

    public String getVenueDetailsJson() {
        return venueDetailsJson;
    }

    public String getAttractionsJson() {
        return attractionsJson;
    }

    public String getClassificationsJson() {
        return classificationsJson;
    }

    public String getPromoterJson() {
        return promoterJson;
    }

    public String getPromotersJson() {
        return promotersJson;
    }

    public String getOutletsJson() {
        return outletsJson;
    }

    public String getProductsJson() {
        return productsJson;
    }

    public String getRawEventJson() {
        return rawEventJson;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public void setState(String state) {
        this.state = state;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public void setSegment(String segment) {
        this.segment = segment;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public void setSubGenre(String subGenre) {
        this.subGenre = subGenre;
    }

    public void setPriceLevel(String priceLevel) {
        this.priceLevel = priceLevel;
    }

    public void setPriceCurrency(String priceCurrency) {
        this.priceCurrency = priceCurrency;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public void setMinPrice(Double minPrice) {
        this.minPrice = minPrice;
    }

    public void setMaxPrice(Double maxPrice) {
        this.maxPrice = maxPrice;
    }

    public void setRating(Double rating) {
        this.rating = rating;
    }

    public void setTimeOfDay(String timeOfDay) {
        this.timeOfDay = timeOfDay;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public void setVenue(String venue) {
        this.venue = venue;
    }

    public void setVenueId(String venueId) {
        this.venueId = venueId;
    }

    public void setVenueUrl(String venueUrl) {
        this.venueUrl = venueUrl;
    }

    public void setVenueTimezone(String venueTimezone) {
        this.venueTimezone = venueTimezone;
    }

    public void setVenueAddress(String venueAddress) {
        this.venueAddress = venueAddress;
    }

    public void setVenuePostalCode(String venuePostalCode) {
        this.venuePostalCode = venuePostalCode;
    }

    public void setVenueLatitude(Double venueLatitude) {
        this.venueLatitude = venueLatitude;
    }

    public void setVenueLongitude(Double venueLongitude) {
        this.venueLongitude = venueLongitude;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setInfo(String info) {
        this.info = info;
    }

    public void setPleaseNote(String pleaseNote) {
        this.pleaseNote = pleaseNote;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public void setSeatmapUrl(String seatmapUrl) {
        this.seatmapUrl = seatmapUrl;
    }

    public void setAccessibilityInfo(String accessibilityInfo) {
        this.accessibilityInfo = accessibilityInfo;
    }

    public void setTicketLimitInfo(String ticketLimitInfo) {
        this.ticketLimitInfo = ticketLimitInfo;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setPromoterName(String promoterName) {
        this.promoterName = promoterName;
    }

    public void setPromoterDescription(String promoterDescription) {
        this.promoterDescription = promoterDescription;
    }

    public void setFeatured(Boolean featured) {
        this.featured = featured;
    }

    public void setTba(Boolean tba) {
        this.tba = tba;
    }

    public void setTbd(Boolean tbd) {
        this.tbd = tbd;
    }

    public void setSpanMultipleDays(Boolean spanMultipleDays) {
        this.spanMultipleDays = spanMultipleDays;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
    }

    public void setEndDate(LocalDateTime endDate) {
        this.endDate = endDate;
    }

    public void setSalesStartDate(LocalDateTime salesStartDate) {
        this.salesStartDate = salesStartDate;
    }

    public void setSalesEndDate(LocalDateTime salesEndDate) {
        this.salesEndDate = salesEndDate;
    }

    public void setFetchedAt(LocalDateTime fetchedAt) {
        this.fetchedAt = fetchedAt;
    }

    public void setDetailFetchedAt(LocalDateTime detailFetchedAt) {
        this.detailFetchedAt = detailFetchedAt;
    }

    public void setSalesJson(String salesJson) {
        this.salesJson = salesJson;
    }

    public void setPriceRangesJson(String priceRangesJson) {
        this.priceRangesJson = priceRangesJson;
    }

    public void setImagesJson(String imagesJson) {
        this.imagesJson = imagesJson;
    }

    public void setVenueDetailsJson(String venueDetailsJson) {
        this.venueDetailsJson = venueDetailsJson;
    }

    public void setAttractionsJson(String attractionsJson) {
        this.attractionsJson = attractionsJson;
    }

    public void setClassificationsJson(String classificationsJson) {
        this.classificationsJson = classificationsJson;
    }

    public void setPromoterJson(String promoterJson) {
        this.promoterJson = promoterJson;
    }

    public void setPromotersJson(String promotersJson) {
        this.promotersJson = promotersJson;
    }

    public void setOutletsJson(String outletsJson) {
        this.outletsJson = outletsJson;
    }

    public void setProductsJson(String productsJson) {
        this.productsJson = productsJson;
    }

    public void setRawEventJson(String rawEventJson) {
        this.rawEventJson = rawEventJson;
    }
}
