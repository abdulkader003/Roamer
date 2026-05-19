package com.sep.flight_backend.repository.flight;

import com.sep.flight_backend.entity.flight.FlightOfferEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FlightOfferRepository extends JpaRepository<FlightOfferEntity, Long> {
    List<FlightOfferEntity> findBySearchId(Long searchId);

    List<FlightOfferEntity> findBySelectedTrue();
}
