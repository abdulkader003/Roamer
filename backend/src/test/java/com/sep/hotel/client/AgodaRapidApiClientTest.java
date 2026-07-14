package com.sep.hotel.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.io.IOException;
import java.util.List;

import static org.hamcrest.Matchers.startsWith;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AgodaRapidApiClientTest {

    private static final String BASE_URL = "https://agoda.example.test";
    private static final String HOST = "agoda-com.p.rapidapi.com";
    private static final String API_KEY = "test-key";

    @Test
    void searchHotelsMapsSuccessfulRapidApiResponseAndSendsExpectedRequests() {
        TestContext context = createContext();
        MockRestServiceServer server = context.server();
        AgodaRapidApiClient client = context.client();

        server.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/auto-complete")))
                .andExpect(queryParam("q", "Berlin"))
                .andExpect(queryParam("language_id", "1"))
                .andExpect(header("X-RapidAPI-Host", HOST))
                .andExpect(header("X-RapidAPI-Key", API_KEY))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {
                              "DisplayNames": {
                                "Name": "Berlin",
                                "CategoryName": "City",
                                "GeoHierarchyName": "Germany"
                              }
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        server.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/overnight-stays/search")))
                .andExpect(queryParam("location", "Berlin,%20Germany"))
                .andExpect(queryParam("checkin_date", "2026-06-01"))
                .andExpect(queryParam("checkout_date", "2026-06-03"))
                .andExpect(queryParam("adults", "2"))
                .andExpect(queryParam("rooms", "1"))
                .andExpect(queryParam("language_id", "1"))
                .andExpect(queryParam("child_ages", "10,10"))
                .andExpect(header("X-RapidAPI-Host", HOST))
                .andExpect(header("X-RapidAPI-Key", API_KEY))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {
                              "propertyId": "prop-1",
                              "type": "hotel",
                              "displayName": "Alpha Hotel",
                              "stars": 4,
                              "latitude": 52.5201,
                              "longitude": 13.4052,
                              "location": "Boulevard 10, Berlin",
                              "price": "123.45",
                              "reviewScore": "8.7",
                              "ratingText": "Excellent",
                              "reviewCount": "112",
                              "distanceFromCityCenter": "2.5",
                              "description": "A convenient city stay",
                              "amenities": ["WiFi", "Breakfast", "", null],
                              "highlights": [{"name": "Pool"}],
                              "images": ["//cdn.example.test/a.jpg", "https://cdn.example.test/b.png", "https://cdn.example.test/a.jpg"]
                            },
                            {
                              "propertyId": "prop-1",
                              "type": "hotel",
                              "displayName": "Duplicate Alpha",
                              "price": "150"
                            },
                            {
                              "propertyId": "prop-2",
                              "type": "apartment",
                              "name": "Beta Apartments",
                              "address": "Beta Street, Berlin",
                              "roomPrice": "180.00",
                              "review_score": 9.1,
                              "reviewCount": 33,
                              "distance": "1.2 km from city center",
                              "ratingText": "Exceptional",
                              "overview": "Another option",
                              "facilities": {
                                "items": [
                                  {"title": "Gym"},
                                  {"description": "Spa"}
                                ]
                              },
                              "imageUrls": [
                                "https://cdn.example.test/c.jpg",
                                "https://cdn.example.test/d.jpeg",
                                "https://cdn.example.test/c.jpg"
                              ]
                            },
                            {
                              "propertyId": "prop-3",
                              "type": "city",
                              "displayName": "Skip Me"
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        List<AgodaHotel> hotels = client.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 2);

        assertThat(hotels).hasSize(2);
        assertThat(hotels.get(0).externalId()).isEqualTo("agoda:prop-1");
        assertThat(hotels.get(0).name()).isEqualTo("Alpha Hotel");
        assertThat(hotels.get(0).city()).isEqualTo("Berlin");
        assertThat(hotels.get(0).latitude()).isEqualTo(52.5201);
        assertThat(hotels.get(0).longitude()).isEqualTo(13.4052);
        assertThat(hotels.get(0).address()).isEqualTo("Boulevard 10, Berlin");
        assertThat(hotels.get(0).stars()).isEqualTo(4);
        assertThat(hotels.get(0).pricePerNight()).isEqualByComparingTo(new BigDecimal("123.45"));
        assertThat(hotels.get(0).ratingScore()).isEqualTo(8.7);
        assertThat(hotels.get(0).ratingLabel()).isEqualTo("Excellent");
        assertThat(hotels.get(0).reviewCount()).isEqualTo(112);
        assertThat(hotels.get(0).distance()).isEqualTo("2.5 km from city center");
        assertThat(hotels.get(0).description()).isEqualTo("A convenient city stay");
        assertThat(hotels.get(0).amenities()).containsExactly("WiFi", "Breakfast", "Pool");
        assertThat(hotels.get(0).images()).containsExactly(
                "https://cdn.example.test/a.jpg",
                "https://cdn.example.test/b.png"
        );

        assertThat(hotels.get(1).externalId()).isEqualTo("agoda:prop-2");
        assertThat(hotels.get(1).name()).isEqualTo("Beta Apartments");
        assertThat(hotels.get(1).pricePerNight()).isEqualByComparingTo(new BigDecimal("180.00"));
        assertThat(hotels.get(1).ratingScore()).isEqualTo(9.1);
        assertThat(hotels.get(1).ratingLabel()).isEqualTo("Exceptional");
        assertThat(hotels.get(1).reviewCount()).isEqualTo(33);
        assertThat(hotels.get(1).distance()).isEqualTo("1.2 km from city center");
        assertThat(hotels.get(1).description()).isEqualTo("Spa");
        assertThat(hotels.get(1).amenities()).containsExactly("Gym", "Spa");
        assertThat(hotels.get(1).images()).containsExactly(
                "https://cdn.example.test/c.jpg",
                "https://cdn.example.test/d.jpeg"
        );

        server.verify();
    }

    @Test
    void searchHotelsReturnsEmptyForEmptyApiResponse() {
        TestContext context = createContext();
        MockRestServiceServer server = context.server();
        AgodaRapidApiClient client = context.client();

        server.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/auto-complete")))
                .andExpect(queryParam("q", "Berlin"))
                .andExpect(queryParam("language_id", "1"))
                .andRespond(withSuccess("""
                        {"data":[{"DisplayNames":{"Name":"Berlin","CategoryName":"City"}}]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/overnight-stays/search")))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));

        List<AgodaHotel> hotels = client.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0);

        assertThat(hotels).isEmpty();
        server.verify();
    }

    @Test
    void searchHotelsReturnsEmptyWhenAutocompleteBodyIsLiteralNull() {
        TestContext context = createContext();
        MockRestServiceServer server = context.server();
        AgodaRapidApiClient client = context.client();

        server.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/auto-complete")))
                .andRespond(withSuccess("null", MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/overnight-stays/search")))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));

        List<AgodaHotel> hotels = client.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0);

        assertThat(hotels).isEmpty();
        server.verify();
    }

    @Test
    void searchHotelsReturnsEmptyOnHttpErrorTimeoutAndMalformedResponses() {
        TestContext httpErrorContext = createContext();
        MockRestServiceServer httpErrorServer = httpErrorContext.server();
        AgodaRapidApiClient httpErrorClient = httpErrorContext.client();
        httpErrorServer.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/auto-complete")))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        assertThat(httpErrorClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0)).isEmpty();
        httpErrorServer.verify();

        TestContext timeoutContext = createContext();
        MockRestServiceServer timeoutServer = timeoutContext.server();
        AgodaRapidApiClient timeoutClient = timeoutContext.client();
        timeoutServer.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/auto-complete")))
                .andRespond(withException(new IOException("timeout")));
        assertThat(timeoutClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0)).isEmpty();
        timeoutServer.verify();

        TestContext malformedContext = createContext();
        MockRestServiceServer malformedServer = malformedContext.server();
        AgodaRapidApiClient malformedClient = malformedContext.client();
        malformedServer.expect(once(), requestTo(startsWith(BASE_URL + "/hotels-homes/auto-complete")))
                .andRespond(withSuccess("{", MediaType.APPLICATION_JSON));
        assertThat(malformedClient.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0)).isEmpty();
        malformedServer.verify();
    }

    @Test
    void searchHotelsReturnsEmptyWhenApiKeyIsMissing() {
        AgodaRapidApiClient client = new AgodaRapidApiClient("", HOST, BASE_URL, new ObjectMapper());

        List<AgodaHotel> hotels = client.searchHotels("Berlin", "2026-06-01", "2026-06-03", 2, 0);

        assertThat(hotels).isEmpty();
    }

    @Test
    void helperMethodsCoverParsingAndBranchLogic() {
        AgodaRapidApiClient client = new AgodaRapidApiClient(API_KEY, HOST, BASE_URL, new ObjectMapper());

        assertThat((String) invoke(client, "childrenAges", 0)).isEqualTo("");
        assertThat((String) invoke(client, "childrenAges", 3)).isEqualTo("10,10,10");
        assertThat((String) invoke(client, "abbreviate", null, 10)).isNull();
        assertThat((String) invoke(client, "abbreviate", "short", 10)).isEqualTo("short");
        assertThat((String) invoke(client, "abbreviate", "12345678901", 10)).isEqualTo("1234567890...");

        JsonNode locationEmpty = json("""
                {"data":[]}
                """);
        assertThat((String) invoke(client, "locationFromAutocomplete", "Berlin", locationEmpty)).isEqualTo("Berlin");

        JsonNode locationPreferred = json("""
                {"data":[
                  {"CityName":"Paris","typeName":"City","CountryName":"France"},
                  {"CityName":"Berlin","typeName":"City","CountryName":"Germany"}
                ]}
                """);
        assertThat((String) invoke(client, "locationFromAutocomplete", "Berlin", locationPreferred)).isEqualTo("Berlin, Germany");

        JsonNode directPropertyId = json("""
                {"propertyId":"direct-1","type":"hotel"}
                """);
        JsonNode nestedPropertyId = json("""
                {"content":{"property_id":"nested-1"},"type":"hotel"}
                """);
        JsonNode summaryPropertyId = json("""
                {"informationSummary":{"agodaPropertyId":"summary-1"},"type":"apartment"}
                """);
        JsonNode skippedPropertyId = json("""
                {"type":"city"}
                """);
        assertThat((java.util.Optional<String>) invoke(client, "propertyId", directPropertyId)).contains("direct-1");
        assertThat((java.util.Optional<String>) invoke(client, "propertyId", nestedPropertyId)).contains("nested-1");
        assertThat((java.util.Optional<String>) invoke(client, "propertyId", summaryPropertyId)).contains("summary-1");
        assertThat((java.util.Optional<String>) invoke(client, "propertyId", skippedPropertyId)).isEmpty();

        assertThat((Boolean) invoke(client, "isPropertyNode", directPropertyId)).isTrue();
        assertThat((Boolean) invoke(client, "isPropertyNode", json("{\"propertyId\":\"x\",\"type\":\"city\"}"))).isFalse();

        JsonNode imageNode = json("""
                {"images":["//cdn.example.test/a.jpg","https://cdn.example.test/b.png","https://cdn.example.test/a.jpg","not-image"]}
                """);
        assertThat((List<String>) invoke(client, "extractImages", imageNode))
                .containsExactly("https://cdn.example.test/a.jpg", "https://cdn.example.test/b.png");
        assertThat((Boolean) invoke(client, "isImageUrl", "//cdn.example.test/a.jpg")).isTrue();
        assertThat((Boolean) invoke(client, "isImageUrl", "ftp://cdn.example.test/a.jpg")).isFalse();
        assertThat((String) invoke(client, "normalizeImageUrl", "//cdn.example.test/a.jpg")).isEqualTo("https://cdn.example.test/a.jpg");

        JsonNode amenityNode = json("""
                {
                  "amenities":["WiFi", "", null, "A very useful amenity"],
                  "highlights":[{"name":"Pool"}],
                  "facilities":{"items":["Gym", "Facilities", "property-facility"]}
                }
                """);
        assertThat((List<String>) invoke(client, "extractAmenities", amenityNode))
                .contains("WiFi", "A very useful amenity", "Pool", "Gym", "Facilities", "property-facility");

        JsonNode textNode = json("""
                {"outer":{"inner":{"name":"Found name"}}}
                """);
        assertThat((java.util.Optional<String>) invoke(client, "firstText", textNode, new String[]{"name"})).contains("Found name");
        assertThat((java.util.Optional<String>) invoke(client, "firstDirectText", textNode, new String[]{"name"})).isEmpty();
        assertThat((java.util.Optional<String>) invoke(client, "nestedText", textNode, "/outer/inner/name")).contains("Found name");
        assertThat((java.util.Optional<String>) invoke(client, "findText", textNode, "name")).contains("Found name");

        JsonNode numericNode = json("""
                {"stars":"4","price":"123.45","distanceFromCityCenter":"2.5","latitude":52.5,"longitude":13.4}
                """);
        assertThat((java.util.Optional<Integer>) invoke(client, "firstInteger", numericNode, new String[]{"stars"})).contains(4);
        assertThat((java.util.Optional<BigDecimal>) invoke(client, "firstDecimal", numericNode, new String[]{"price"})).contains(new BigDecimal("123.45"));
        assertThat((java.util.Optional<Double>) invoke(client, "latitude", numericNode)).contains(52.5);
        assertThat((java.util.Optional<Double>) invoke(client, "longitude", numericNode)).contains(13.4);
        assertThat((java.util.Optional<String>) invoke(client, "distance", numericNode)).contains("2.5 km from city center");

        JsonNode emptyDistanceNode = json("{}");
        assertThat((java.util.Optional<String>) invoke(client, "distance", emptyDistanceNode)).isEmpty();
        assertThat((java.util.Optional<Integer>) invoke(client, "firstInteger", json("{\"stars\":\"abc\"}"), new String[]{"stars"})).isEmpty();
        assertThat((java.util.Optional<BigDecimal>) invoke(client, "firstDecimal", json("{\"price\":\"abc\"}"), new String[]{"price"})).isEmpty();

        JsonNode nestedProperties = json("""
                {
                  "data": [
                    {"propertyId":"node-1","type":"hotel"},
                    {"wrapper":{"propertyId":"node-2","type":"apartment"}},
                    {"wrapper":{"propertyId":"node-3","type":"city"}}
                  ]
                }
                """);
        assertThat((List<JsonNode>) invoke(client, "collectPropertyNodes", nestedProperties)).hasSize(2);

        AgodaHotel hotel = (AgodaHotel) invoke(client, "toHotel", "Berlin", "prop-9", json("""
                {
                  "displayName":"Gamma Hotel",
                  "type":"hotel",
                  "price":"210.00",
                  "ratingScore":"9.3",
                  "stars":"4",
                  "reviewCount":"98",
                  "distanceFromCityCenter":"3.2",
                  "description":"Gamma description",
                  "amenities":["WiFi", "Breakfast"],
                  "images":["https://cdn.example.test/gamma.jpg"]
                }
                """), json("""
                {
                  "displayName":"Gamma Hotel",
                  "type":"hotel",
                  "price":"210.00",
                  "ratingScore":"9.3",
                  "stars":"4",
                  "reviewCount":"98",
                  "distanceFromCityCenter":"3.2",
                  "description":"Gamma description",
                  "amenities":["WiFi", "Breakfast"],
                  "images":["https://cdn.example.test/gamma.jpg"]
                }
                """), json("""
                {
                  "displayName":"Gamma Hotel",
                  "type":"hotel",
                  "price":"210.00",
                  "ratingScore":"9.3",
                  "stars":"4",
                  "reviewCount":"98",
                  "distanceFromCityCenter":"3.2",
                  "description":"Gamma description",
                  "amenities":["WiFi", "Breakfast"],
                  "images":["https://cdn.example.test/gamma.jpg"]
                }
                """));
        assertThat(hotel).isNotNull();
        assertThat(hotel.externalId()).isEqualTo("agoda:prop-9");
        assertThat(hotel.images()).containsExactly("https://cdn.example.test/gamma.jpg");
        assertThat(hotel.amenities()).contains("WiFi", "Breakfast");

        assertThat((AgodaHotel) invoke(client, "toHotel", "Berlin", "prop-10", json("{\"type\":\"hotel\"}"), json("{\"type\":\"hotel\"}"), json("{\"type\":\"hotel\"}"))).isNull();

    }

    private TestContext createContext() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader("X-RapidAPI-Host", HOST);
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();

        AgodaRapidApiClient client = new AgodaRapidApiClient(API_KEY, HOST, BASE_URL, new ObjectMapper());
        ReflectionTestUtils.setField(client, "restClient", restClient);
        return new TestContext(server, client);
    }

    @SuppressWarnings("unchecked")
    private <T> T invoke(AgodaRapidApiClient client, String method, Object... args) {
        return (T) ReflectionTestUtils.invokeMethod(client, method, args);
    }

    private JsonNode json(String value) {
        try {
            return new ObjectMapper().readTree(value);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private record TestContext(MockRestServiceServer server, AgodaRapidApiClient client) {
    }
}
