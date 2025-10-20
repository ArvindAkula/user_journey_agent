package com.userjourney.analytics.monitoring;

import com.userjourney.analytics.service.HealthCheckService;
import com.userjourney.analytics.service.MonitoringService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for monitoring and health check functionality
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    classes = com.userjourney.analytics.AnalyticsBackendApplication.class
)
@ActiveProfiles("test")
public class MonitoringIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private HealthCheckService healthCheckService;

    @Autowired
    private MonitoringService monitoringService;

    @Test
    public void testBasicHealthEndpoint() {
        ResponseEntity<Map> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/health", Map.class);
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().containsKey("status"));
    }

    @Test
    public void testReadinessEndpoint() {
        ResponseEntity<Map> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/health/ready", Map.class);
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().containsKey("status"));
    }

    @Test
    public void testLivenessEndpoint() {
        ResponseEntity<Map> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/health/live", Map.class);
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().containsKey("status"));
    }

    @Test
    public void testPingEndpoint() {
        ResponseEntity<Map> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/ping", Map.class);
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("pong", response.getBody().get("message"));
        assertTrue(response.getBody().containsKey("correlationId"));
    }

    @Test
    public void testHealthCheckService() {
        HealthCheckService.HealthStatus basicHealth = healthCheckService.getBasicHealth();
        assertNotNull(basicHealth);
        assertNotNull(basicHealth.getStatus());
        assertNotNull(basicHealth.getMessage());

        HealthCheckService.DetailedHealthStatus detailedHealth = healthCheckService.getDetailedHealth();
        assertNotNull(detailedHealth);
        assertNotNull(detailedHealth.getComponents());
        assertNotNull(detailedHealth.getSystemInfo());
    }

    @Test
    public void testMonitoringService() {
        // Test that monitoring service is working
        assertTrue(monitoringService.isHealthy());
        
        // Test metric recording
        monitoringService.incrementUserEventsProcessed();
        monitoringService.recordDataProcessingTime(java.time.Duration.ofMillis(100));
        
        // These should not throw exceptions
        assertDoesNotThrow(() -> {
            monitoringService.setActiveUsers(10);
            monitoringService.setProcessingQueueSize(5);
            monitoringService.setAiServiceHealth(true);
        });
    }

    @Test
    public void testCorrelationIdInResponse() {
        ResponseEntity<Map> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/ping", Map.class);
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        
        // Check that correlation ID is present in response
        assertTrue(response.getBody().containsKey("correlationId"));
        assertNotNull(response.getBody().get("correlationId"));
        
        // Check that correlation ID header is present
        assertTrue(response.getHeaders().containsKey("X-Correlation-ID"));
    }
}