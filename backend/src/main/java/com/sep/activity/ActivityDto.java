package com.sep.activity;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;

public class ActivityDto {
    private String id;
    private String title;
    private String type;
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
    private String venueUrl;
    private String venueTimezone;
    private String venueAddress;
    private String venuePostalCode;
    private Double venueLatitude;
    private Double venueLongitude;
    private String description;
    private String info;
    private String pleaseNote;
    private String image;
    private String seatmapUrl;
    private String accessibilityInfo;
    private String ticketLimitInfo;
    private String status;
    private String promoterName;
    private String promoterDescription;
    private Boolean featured;
    private Boolean tba;
    private Boolean tbd;
    private Boolean spanMultipleDays;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private LocalDateTime salesStartDate;
    private LocalDateTime salesEndDate;
    private JsonNode sales;
    private JsonNode priceRanges;
    private JsonNode images;
    private JsonNode venueDetails;
    private JsonNode attractions;
    private JsonNode classifications;
    private JsonNode promoter;
    private JsonNode promoters;
    private JsonNode outlets;
    private JsonNode products;

    public ActivityDto() {
    }

    public String getId() {
        return id;
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

    public JsonNode getSales() {
        return sales;
    }

    public JsonNode getPriceRanges() {
        return priceRanges;
    }

    public JsonNode getImages() {
        return images;
    }

    public JsonNode getVenueDetails() {
        return venueDetails;
    }

    public JsonNode getAttractions() {
        return attractions;
    }

    public JsonNode getClassifications() {
        return classifications;
    }

    public JsonNode getPromoter() {
        return promoter;
    }

    public JsonNode getPromoters() {
        return promoters;
    }

    public JsonNode getOutlets() {
        return outlets;
    }

    public JsonNode getProducts() {
        return products;
    }

    public void setId(String id) {
        this.id = id;
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

    public void setSales(JsonNode sales) {
        this.sales = sales;
    }

    public void setPriceRanges(JsonNode priceRanges) {
        this.priceRanges = priceRanges;
    }

    public void setImages(JsonNode images) {
        this.images = images;
    }

    public void setVenueDetails(JsonNode venueDetails) {
        this.venueDetails = venueDetails;
    }

    public void setAttractions(JsonNode attractions) {
        this.attractions = attractions;
    }

    public void setClassifications(JsonNode classifications) {
        this.classifications = classifications;
    }

    public void setPromoter(JsonNode promoter) {
        this.promoter = promoter;
    }

    public void setPromoters(JsonNode promoters) {
        this.promoters = promoters;
    }

    public void setOutlets(JsonNode outlets) {
        this.outlets = outlets;
    }

    public void setProducts(JsonNode products) {
        this.products = products;
    }
}
