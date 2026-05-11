package com.sep.hotels.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(
        name = "hotels",
        uniqueConstraints = @UniqueConstraint(name = "uk_hotels_external_source", columnNames = {"external_id", "source"})
)
public class Hotel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id")
    private String externalId;

    private String source;

    private String name;

    private String city;

    @Column(name = "price_per_night", precision = 10, scale = 2)
    private BigDecimal pricePerNight;

    private Double rating;

    private Double ratingScore;

    private String ratingLabel;

    private Integer reviewCount;

    private Integer stars;

    private String distance;

    private String distanceFromCenter;

    private String tag;

    @Column(length = 1000)
    private String description;

    private String image;

    private Instant lastFetchedAt;

    private Double latitude;

    private Double longitude;

    @Column(length = 1000)
    private String address;

    @OneToMany(mappedBy = "hotel", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<HotelAmenity> amenities = new LinkedHashSet<>();

    @OneToMany(mappedBy = "hotel", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<HotelImage> images = new LinkedHashSet<>();

    public Long getId() {
        return id;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public BigDecimal getPricePerNight() {
        return pricePerNight;
    }

    public void setPricePerNight(BigDecimal pricePerNight) {
        this.pricePerNight = pricePerNight;
    }

    public Double getRating() {
        return rating;
    }

    public void setRating(Double rating) {
        this.rating = rating;
    }

    public Double getRatingScore() {
        return ratingScore;
    }

    public void setRatingScore(Double ratingScore) {
        this.ratingScore = ratingScore;
    }

    public String getRatingLabel() {
        return ratingLabel;
    }

    public void setRatingLabel(String ratingLabel) {
        this.ratingLabel = ratingLabel;
    }

    public Integer getReviewCount() {
        return reviewCount;
    }

    public void setReviewCount(Integer reviewCount) {
        this.reviewCount = reviewCount;
    }

    public Integer getStars() {
        return stars;
    }

    public void setStars(Integer stars) {
        this.stars = stars;
    }

    public String getDistance() {
        return distance;
    }

    public void setDistance(String distance) {
        this.distance = distance;
    }

    public String getDistanceFromCenter() {
        return distanceFromCenter;
    }

    public void setDistanceFromCenter(String distanceFromCenter) {
        this.distanceFromCenter = distanceFromCenter;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public Instant getLastFetchedAt() {
        return lastFetchedAt;
    }

    public void setLastFetchedAt(Instant lastFetchedAt) {
        this.lastFetchedAt = lastFetchedAt;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public Set<HotelAmenity> getAmenities() {
        return amenities;
    }

    public Set<HotelImage> getImages() {
        return images;
    }

    public void addAmenity(String name) {
        HotelAmenity amenity = new HotelAmenity();
        amenity.setHotel(this);
        amenity.setName(name);
        amenities.add(amenity);
    }

    public void addImage(String imageUrl, Integer sortOrder) {
        HotelImage hotelImage = new HotelImage();
        hotelImage.setHotel(this);
        hotelImage.setImageUrl(imageUrl);
        hotelImage.setSortOrder(sortOrder);
        images.add(hotelImage);
    }
}
