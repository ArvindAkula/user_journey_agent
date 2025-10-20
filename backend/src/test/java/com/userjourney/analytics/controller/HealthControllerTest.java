package com.userjourney.analytics.controller;

import com.userjourney.analytics.service.HealthCheckService;
import com.userjourney.analytics.service.RealTimeEventService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
public class HealthControllerTest {

    @Mock
    private RealTimeEventService realTimeEventService;

    @Mock
    private HealthCheckService healthCheckService;

    @InjectMocks
    private HealthController healthController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(healthController).build();
        System.out.println("=== TEST SETUP COMPLETED ===");
    }

    @Test
    void testHealthEndpoint() throws Exception {
        System.out.println("=== TESTING HEALTH ENDPOINT ===");
        
        // Mock the health check service
        HealthCheckService.HealthStatus mockStatus = new HealthCheckService.HealthStatus(
            HealthCheckService.HealthStatus.Status.UP, 
            "System is healthy", 
            new java.util.HashMap<>()
        );
        
        when(healthCheckService.getBasicHealth()).thenReturn(mockStatus);

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").exists());

        verify(healthCheckService, times(1)).getBasicHealth();
        System.out.println("=== HEALTH ENDPOINT TEST PASSED ===");
    }

    @Test
    void testEventsEndpoint() throws Exception {
        System.out.println("=== TESTING EVENTS ENDPOINT ===");
        
        String eventJson = "{\"eventType\":\"test\",\"data\":\"sample\"}";

        mockMvc.perform(post("/api/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(eventJson))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.success").value(true));

        verify(realTimeEventService, times(1)).processEvent(any());
        System.out.println("=== EVENTS ENDPOINT TEST PASSED ===");
    }

    @Test
    void testEventsBatchEndpoint() throws Exception {
        System.out.println("=== TESTING EVENTS BATCH ENDPOINT ===");
        
        String batchJson = "{\"events\":[{\"eventType\":\"test\",\"data\":\"sample\"}]}";

        mockMvc.perform(post("/api/events/batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content(batchJson))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.success").value(true));

        System.out.println("=== EVENTS BATCH ENDPOINT TEST PASSED ===");
    }

    @Test
    void testControllerInstantiation() {
        System.out.println("=== TESTING CONTROLLER INSTANTIATION ===");
        
        // Test that the controller can be instantiated
        HealthController controller = new HealthController();
        assert controller != null;
        
        System.out.println("=== CONTROLLER INSTANTIATION TEST PASSED ===");
    }
}