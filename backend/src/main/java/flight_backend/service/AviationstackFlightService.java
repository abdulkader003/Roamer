package flight_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import flight_backend.client.AviationstackClient;
import flight_backend.dto.flight.FlightSearchRequest;
import org.springframework.stereotype.Service;

@Service
public class AviationstackFlightService {
    private final AviationstackClient aviationstackClient;

    public AviationstackFlightService(AviationstackClient aviationstackClient) {
        this.aviationstackClient = aviationstackClient;
    }

    public JsonNode searchFlights(FlightSearchRequest request) {
        return aviationstackClient.searchFlights(request);
    }
}
