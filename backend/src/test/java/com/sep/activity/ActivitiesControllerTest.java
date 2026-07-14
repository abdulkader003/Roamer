package com.sep.activity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ActivitiesControllerTest {

    @Mock
    private ActivitiesService activitiesService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ActivitiesController(activitiesService)).build();
    }

    @Test
    void getActivitiesReturnsServiceResponseAndPassesQueryParameters() throws Exception {
        ActivityDto activity = dto("tm-1", "Concert Night", "Berlin");
        when(activitiesService.getActivities("Berlin", "concert", 2, 20))
                .thenReturn(new ActivitySearchResponse(List.of(activity), 2, 20, true));

        mockMvc.perform(get("/api/activities")
                        .param("city", "Berlin")
                        .param("keyword", "concert")
                        .param("page", "2")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.items[0].id").value("tm-1"))
                .andExpect(jsonPath("$.items[0].title").value("Concert Night"))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.hasMore").value(true));

        verify(activitiesService).getActivities("Berlin", "concert", 2, 20);
    }

    @Test
    void getActivityByIdReturnsActivityWhenPresent() throws Exception {
        ActivityDto activity = dto("tm-1", "Concert Night", "Berlin");
        when(activitiesService.getActivityById("tm-1")).thenReturn(Optional.of(activity));

        mockMvc.perform(get("/api/activities/tm-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("tm-1"))
                .andExpect(jsonPath("$.title").value("Concert Night"));

        verify(activitiesService).getActivityById("tm-1");
    }

    @Test
    void getActivityByIdReturnsNotFoundWhenServiceReturnsEmpty() throws Exception {
        when(activitiesService.getActivityById("tm-missing")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/activities/tm-missing"))
                .andExpect(status().isNotFound());

        verify(activitiesService).getActivityById("tm-missing");
    }

    @Test
    void getActivitiesMapsConfigurationErrorToServiceUnavailable() throws Exception {
        when(activitiesService.getActivities("Berlin", null, null, null))
                .thenThrow(new ActivitiesConfigurationException("Activities search is not configured."));

        mockMvc.perform(get("/api/activities").param("city", "Berlin"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Activities search is not configured."));

        verify(activitiesService).getActivities("Berlin", null, null, null);
    }

    @Test
    void getActivitiesWithNoParametersPassesNullsThrough() throws Exception {
        when(activitiesService.getActivities(null, null, null, null))
                .thenReturn(new ActivitySearchResponse(List.of(), 0, 12, false));

        mockMvc.perform(get("/api/activities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(12));

        verify(activitiesService).getActivities(null, null, null, null);
    }

    private ActivityDto dto(String id, String title, String city) {
        ActivityDto dto = new ActivityDto();
        dto.setId(id);
        dto.setTitle(title);
        dto.setCity(city);
        return dto;
    }
}
