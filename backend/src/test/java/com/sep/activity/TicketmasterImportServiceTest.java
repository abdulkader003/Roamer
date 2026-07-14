package com.sep.activity;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class TicketmasterImportServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void importByCityMapsAndSortsEventsAndSetsHasMore() {
        TicketmasterImportService importService = new TicketmasterImportService("test-key", objectMapper, new RestTemplateBuilder());
        MockRestServiceServer server = bindServer(importService);

        server.expect(once(), requestTo(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("apikey=test-key"),
                        org.hamcrest.Matchers.containsString("city=Berlin"),
                        org.hamcrest.Matchers.containsString("keyword=music"),
                        org.hamcrest.Matchers.containsString("page=0"),
                        org.hamcrest.Matchers.containsString("size=2"),
                        org.hamcrest.Matchers.containsString("sort=date,asc")
                )))
                .andRespond(withSuccess("""
                        {
                          "_embedded": {
                            "events": [
                              {
                                "id": "event-late",
                                "name": "ZÃ¼rich Night",
                                "type": "event",
                                "url": "https://example.test/event-late",
                                "locale": "en-us",
                                "source": "ticketmaster",
                                "dates": {
                                  "start": { "localDate": "2026-07-20", "localTime": "20:00:00" },
                                  "end": { "localDate": "2026-07-20", "localTime": "22:00:00" }
                                },
                                "priceRanges": [{ "min": 20, "max": 30, "currency": "EUR" }],
                                "classifications": [{ "segment": { "name": "Music" }, "genre": { "name": "Concert" }, "subGenre": { "name": "Indie" } }],
                                "_embedded": {
                                  "venues": [{
                                    "name": "Venue B",
                                    "url": "https://venue.example/event-late",
                                    "timezone": "Europe/Berlin",
                                    "address": { "line1": "Street 2", "line2": "Floor 2", "line3": "Hall 3" },
                                    "postalCode": "10115",
                                    "location": { "latitude": "52.5", "longitude": "13.4" },
                                    "city": { "name": "Berlin" },
                                    "country": { "name": "Germany", "countryCode": "DE" },
                                    "state": { "name": "Berlin", "stateCode": "BE" },
                                    "accessibleSeatingDetail": "Accessible"
                                  }]
                                },
                                "promoter": { "name": "Big Promoter", "description": "Great show" },
                                "sales": { "public": { "startDateTime": "2026-06-01T10:00:00Z", "endDateTime": "2026-07-20T18:00:00Z" } },
                                "images": [{
                                  "url": "https://img.example/late.jpg",
                                  "width": 1200,
                                  "height": 900,
                                  "ratio": "16_9",
                                  "fallback": false
                                }],
                                "accessibility": "Accessible",
                                "ticketLimit": "6",
                                "info": "Great show"
                              },
                              {
                                "id": "event-early",
                                "name": "Berlin Sunrise",
                                "type": "event",
                                "url": "https://example.test/event-early",
                                "locale": "en-us",
                                "source": "ticketmaster",
                                "dates": {
                                  "start": { "localDate": "2026-07-20", "localTime": "18:00:00" }
                                },
                                "priceRanges": [{ "min": 10, "max": 15, "currency": "EUR" }],
                                "classifications": [{ "segment": { "name": "Music" }, "genre": { "name": "Concert" }, "subGenre": { "name": "Pop" } }],
                                "duration": "2h",
                                "_embedded": {
                                  "venues": [{
                                    "name": "Venue A",
                                    "url": "https://venue.example/event-early",
                                    "timezone": "Europe/Berlin",
                                    "address": { "line1": "Street 1" },
                                    "postalCode": "10115",
                                    "location": { "latitude": "52.6", "longitude": "13.5" },
                                    "city": { "name": "Berlin" },
                                    "country": { "name": "Germany", "countryCode": "DE" },
                                    "state": { "name": "Berlin", "stateCode": "BE" },
                                    "accessibleSeatingDetail": "Accessible"
                                  }]
                                },
                                "promoter": { "name": "Small Promoter", "description": "Early show" },
                                "sales": { "public": { "startDateTime": "2026-06-01T10:00:00Z", "endDateTime": "2026-07-20T18:00:00Z" } },
                                "images": [{
                                  "url": "https://img.example/early.jpg",
                                  "width": 100,
                                  "height": 100,
                                  "ratio": "4_3",
                                  "fallback": true
                                }],
                                "accessibility": "Accessible",
                                "ticketLimit": "6",
                                "info": "Early show"
                              }
                            ]
                          },
                          "page": { "number": 0, "totalPages": 2 }
                        }
                        """, MediaType.APPLICATION_JSON));

        ActivityImportBatch batch = importService.importByCity("Berlin", "music", 0, 2);

        assertThat(batch.isHasMore()).isTrue();
        assertThat(batch.getActivities()).extracting(ActivityEntity::getExternalId)
                .containsExactly("event-early", "event-late");
        assertThat(batch.getActivities().getFirst().getTitle()).isEqualTo("Berlin Sunrise");
        assertThat(batch.getActivities().getFirst().getPriceLevel()).isEqualTo("Budget");
        assertThat(batch.getActivities().getFirst().getDuration()).isEqualTo("2h");
        assertThat(batch.getActivities().getFirst().getVenueAddress()).isEqualTo("Street 1");
        assertThat(batch.getActivities().getFirst().getRating()).isEqualTo(4.7);
        assertThat(batch.getActivities().get(1).getTitle()).isEqualTo("Zürich Night");
        assertThat(batch.getActivities().get(1).getPriceLevel()).isEqualTo("Budget");
        server.verify();
    }

    @Test
    void importByCitySkipsIncompleteEventsAndReturnsEmptyWhenEmbeddedSectionMissing() {
        TicketmasterImportService importService = new TicketmasterImportService("test-key", objectMapper, new RestTemplateBuilder());
        MockRestServiceServer server = bindServer(importService);

        server.expect(once(), requestTo(org.hamcrest.Matchers.containsString("city=Rome")))
                .andRespond(withSuccess("""
                        {
                          "_embedded": {
                            "events": [
                              { "id": "missing-title" },
                              {
                                "id": "event-valid",
                                "name": "Rome Opera",
                                "type": "event",
                                "url": "https://example.test/event-valid",
                                "locale": "en-us",
                                "source": "ticketmaster",
                                "dates": { "start": { "localDate": "2026-07-22", "localTime": "19:30:00" } },
                                "classifications": [{ "segment": { "name": "Theatre" } }],
                                "_embedded": {
                                  "venues": [{
                                    "name": "Opera House",
                                    "url": "https://venue.example/event-valid",
                                    "timezone": "Europe/Rome",
                                    "address": { "line1": "Via Roma 1" },
                                    "postalCode": "00100",
                                    "location": { "latitude": "41.9", "longitude": "12.5" },
                                    "city": { "name": "Rome" },
                                    "country": { "name": "Italy", "countryCode": "IT" },
                                    "state": { "name": "Rome", "stateCode": "RM" },
                                    "accessibleSeatingDetail": "Accessible"
                                  }]
                                },
                                "promoter": { "name": "Opera House", "description": "Classic evening" },
                                "sales": { "public": { "startDateTime": "2026-06-01T10:00:00Z", "endDateTime": "2026-07-20T18:00:00Z" } },
                                "images": [],
                                "accessibility": "Accessible",
                                "ticketLimit": "6",
                                "info": "Classic evening"
                              }
                            ]
                          },
                          "page": { "number": 0, "totalPages": 1 }
                        }
                        """, MediaType.APPLICATION_JSON));

        ActivityImportBatch batch = importService.importByCity("Rome", null, 0, 12);

        assertThat(batch.getActivities()).hasSize(1);
        assertThat(batch.getActivities().getFirst().getExternalId()).isEqualTo("event-valid");
        assertThat(batch.getActivities().getFirst().getCategory()).isEqualTo("Theatre");
        assertThat(batch.getActivities().getFirst().getPriceLevel()).isEqualTo("Mid-Range");
        assertThat(batch.getActivities().getFirst().getTimeOfDay()).isEqualTo("Evening");
        server.verify();

        TicketmasterImportService missingEmbeddedImportService = new TicketmasterImportService("test-key", objectMapper, new RestTemplateBuilder());
        MockRestServiceServer missingEmbeddedServer = bindServer(missingEmbeddedImportService);
        missingEmbeddedServer.expect(once(), requestTo(org.hamcrest.Matchers.containsString("city=Rome")))
                .andRespond(withSuccess("{\"page\":{\"number\":0,\"totalPages\":1}}", MediaType.APPLICATION_JSON));

        ActivityImportBatch emptyBatch = missingEmbeddedImportService.importByCity("Rome", null, 0, 12);
        assertThat(emptyBatch.getActivities()).isEmpty();
        assertThat(emptyBatch.isHasMore()).isFalse();
        missingEmbeddedServer.verify();
    }

    @Test
    void importByCityReturnsEmptyWhenNotConfiguredOrProviderFails() {
        TicketmasterImportService notConfigured = new TicketmasterImportService("", objectMapper, new RestTemplateBuilder());
        assertThat(notConfigured.importByCity("Berlin", null, 0, 12).getActivities()).isEmpty();

        TicketmasterImportService importService = new TicketmasterImportService("test-key", objectMapper, new RestTemplateBuilder());
        MockRestServiceServer server = bindServer(importService);
        server.expect(once(), requestTo(org.hamcrest.Matchers.containsString("city=Berlin")))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        ActivityImportBatch batch = importService.importByCity("Berlin", null, 0, 12);

        assertThat(batch.getActivities()).isEmpty();
        assertThat(batch.isHasMore()).isFalse();
        server.verify();
    }

    @Test
    void importByExternalIdMergesImagesAndReturnsNullForInvalidInputOrFailures() {
        TicketmasterImportService notConfigured = new TicketmasterImportService("", objectMapper, new RestTemplateBuilder());
        assertThat(notConfigured.importByExternalId("event-1")).isNull();
        assertThat(notConfigured.importByExternalId(" ")).isNull();

        TicketmasterImportService importService = new TicketmasterImportService("test-key", objectMapper, new RestTemplateBuilder());
        MockRestServiceServer server = bindServer(importService);

        server.expect(once(), requestTo(org.hamcrest.Matchers.containsString("/events/event-1.json")))
                .andRespond(withSuccess("""
                        {
                          "id": "event-1",
                          "name": "Event Detail",
                          "type": "event",
                          "url": "https://example.test/event-1",
                          "locale": "en-us",
                          "source": "ticketmaster",
                          "dates": {
                            "start": { "localDate": "2026-07-30", "localTime": "21:00:00" }
                          },
                          "priceRanges": [{ "min": 100, "max": 140, "currency": "EUR" }],
                          "classifications": [{ "segment": { "name": "Sports" }, "genre": { "name": "Sport" }, "subGenre": { "name": "Football" } }],
                          "_embedded": {
                            "venues": [{
                              "name": "Detail Venue",
                              "url": "https://venue.example/event-1",
                              "timezone": "Europe/Berlin",
                              "address": { "line1": "Main Street 10" },
                              "postalCode": "10115",
                              "location": { "latitude": "52.52", "longitude": "13.405" },
                              "city": { "name": "Berlin" },
                              "country": { "name": "Germany", "countryCode": "DE" },
                              "state": { "name": "Berlin", "stateCode": "BE" },
                              "accessibleSeatingDetail": "Accessible"
                            }]
                          },
                          "promoter": { "name": "Promoter", "description": "Detail description" },
                          "sales": { "public": { "startDateTime": "2026-06-01T10:00:00Z", "endDateTime": "2026-07-20T18:00:00Z" } },
                          "images": [{
                            "url": "https://img.example/base.jpg",
                            "width": 1200,
                            "height": 900,
                            "ratio": "16_9",
                            "fallback": false
                          }],
                          "accessibility": "Accessible",
                          "ticketLimit": "6",
                          "info": "Detail description"
                        }
                        """, MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(org.hamcrest.Matchers.containsString("/events/event-1/images.json")))
                .andRespond(withSuccess("""
                        {
                          "images": [
                            { "url": "https://img.example/low.jpg", "width": 200, "height": 100, "ratio": "4_3", "fallback": true },
                            { "url": "https://img.example/high.jpg", "width": 1200, "height": 900, "ratio": "16_9", "fallback": false }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        ActivityEntity detail = importService.importByExternalId("event-1");

        assertThat(detail).isNotNull();
        assertThat(detail.getExternalId()).isEqualTo("event-1");
        assertThat(detail.getImage()).isEqualTo("https://img.example/high.jpg");
        assertThat(detail.getRating()).isEqualTo(4.4);
        assertThat(detail.getPriceLevel()).isEqualTo("Premium");
        assertThat(detail.getDescription()).isEqualTo("Detail description");
        server.verify();

        TicketmasterImportService failingImportService = new TicketmasterImportService("test-key", objectMapper, new RestTemplateBuilder());
        MockRestServiceServer failingServer = bindServer(failingImportService);
        failingServer.expect(once(), requestTo(org.hamcrest.Matchers.containsString("/events/event-2.json")))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        assertThat(failingImportService.importByExternalId("event-2")).isNull();
        failingServer.verify();
    }

    @Test
    void importByExternalIdSupportsArrayImageResponsesAndComputesDurationAndMorningTime() {
        TicketmasterImportService importService = new TicketmasterImportService("test-key", objectMapper, new RestTemplateBuilder());
        MockRestServiceServer server = bindServer(importService);

        server.expect(once(), requestTo(org.hamcrest.Matchers.containsString("/events/event-array.json")))
                .andRespond(withSuccess("""
                        {
                          "id": "event-array",
                          "name": "Morning Sport",
                          "type": "event",
                          "url": "https://example.test/event-array",
                          "locale": "en-us",
                          "source": "ticketmaster",
                          "dates": {
                            "start": { "localDate": "2026-08-01", "localTime": "09:00:00" },
                            "end": { "localDate": "2026-08-01", "localTime": "11:30:00" }
                          },
                          "priceRanges": [{ "min": 30, "max": 40, "currency": "EUR" }],
                          "classifications": [{ "segment": { "name": "Sports" }, "genre": { "name": "Sport" }, "subGenre": { "name": "Football" } }],
                          "_embedded": {
                            "venues": [{
                              "name": "Morning Arena",
                              "url": "https://venue.example/event-array",
                              "timezone": "Europe/Berlin",
                              "address": { "line1": "Arena Way 1", "line2": "Gate B" },
                              "postalCode": "10115",
                              "location": { "latitude": "not-a-number", "longitude": "" },
                              "city": { "name": "Berlin" },
                              "country": { "name": "Germany", "countryCode": "DE" },
                              "state": { "name": "Berlin", "stateCode": "BE" },
                              "accessibleSeatingDetail": "Accessible"
                            }]
                          },
                          "promoter": { "name": "Sports Promo", "description": "Morning match" },
                          "sales": { "public": { "startDateTime": "2026-06-01T10:00:00Z", "endDateTime": "2026-07-20T18:00:00Z" } },
                          "images": [],
                          "accessibility": "Accessible",
                          "ticketLimit": "6",
                          "info": "Morning match"
                        }
                        """, MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(org.hamcrest.Matchers.containsString("/events/event-array/images.json")))
                .andRespond(withSuccess("""
                        [
                          { "url": "https://img.example/array-low.jpg", "width": 200, "height": 100, "ratio": "4_3", "fallback": true },
                          { "url": "https://img.example/array-high.jpg", "width": 1200, "height": 900, "ratio": "16_9", "fallback": false }
                        ]
                        """, MediaType.APPLICATION_JSON));

        ActivityEntity detail = importService.importByExternalId("event-array");

        assertThat(detail).isNotNull();
        assertThat(detail.getImage()).isEqualTo("https://img.example/array-high.jpg");
        assertThat(detail.getDuration()).isEqualTo("2h 30m");
        assertThat(detail.getTimeOfDay()).isEqualTo("Morning");
        assertThat(detail.getVenueLatitude()).isNull();
        assertThat(detail.getVenueLongitude()).isNull();
        assertThat(detail.getPriceLevel()).isEqualTo("Mid-Range");
        server.verify();
    }

    private MockRestServiceServer bindServer(TicketmasterImportService service) {
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        return MockRestServiceServer.bindTo(restTemplate).build();
    }
}
