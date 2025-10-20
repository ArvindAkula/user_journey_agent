package com.userjourney.analytics.monitoring;

import com.userjourney.analytics.service.HealthCheckService;
import com.userjourney.analytics.service.MonitoringService;
import com.userjourney.analytics.service.StructuredLoggingService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for monitoring functionality
 */
@ExtendWith(MockitoExtension.class)
public class MonitoringUnitTest {

    private MonitoringService monitoringService;
    private StructuredLoggingService structuredLoggingService;
    private HealthCheckService healthCheckService;

    @Mock
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @BeforeEach
    public void setUp() {
        // Create monitoring service with simple meter registry
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        monitoringService = new MonitoringService(meterRegistry);
        
        // Create structured logging service
        structuredLoggingService = new StructuredLoggingService();
        
        // Create health check service
        healthCheckService = new HealthCheckService();
    }

    @Test
    public void testMonitoringServiceBasicFunctionality() {
        // Test that monitoring service is working
        assertTrue(monitoringService.isHealthy());
        
        // Test metric recording
        assertDoesNotThrow(() -> {
            monitoringService.incrementUserEventsProcessed();
            monitoringService.incrementStruggleSignalsDetected();
            monitoringService.incrementInterventionsExecuted();
            monitoringService.recordDataProcessingTime(java.time.Duration.ofMillis(100));
        });
        
        // Test gauge operations
        assertDoesNotThrow(() -> {
            monitoringService.setActiveUsers(10);
            monitoringService.setProcessingQueueSize(5);
            monitoringService.setAiServiceHealth(true);
        });
        
        // Verify gauge values
        assertEquals(10.0, monitoringService.getActiveUsers());
        assertEquals(5.0, monitoringService.getProcessingQueueSize());
        assertEquals(1.0, monitoringService.getAiServiceHealth());
    }

    @Test
    public void testHealthCheckServiceBasicFunctionality() {
        // Test basic health check
        HealthCheckService.HealthStatus basicHealth = healthCheckService.getBasicHealth();
        assertNotNull(basicHealth);
        assertNotNull(basicHealth.getStatus());
        assertNotNull(basicHealth.getMessage());
        assertNotNull(basicHealth.getDetails());

        // Test detailed health check
        HealthCheckService.DetailedHealthStatus detailedHealth = healthCheckService.getDetailedHealth();
        assertNotNull(detailedHealth);
        assertNotNull(detailedHealth.getComponents());
        assertNotNull(detailedHealth.getSystemInfo());
        
        // Test readiness check
        HealthCheckService.HealthStatus readinessHealth = healthCheckService.getReadinessCheck();
        assertNotNull(readinessHealth);
        assertNotNull(readinessHealth.getStatus());
        
        // Test liveness check
        HealthCheckService.HealthStatus livenessHealth = healthCheckService.getLivenessCheck();
        assertNotNull(livenessHealth);
        assertNotNull(livenessHealth.getStatus());
    }

    @Test
    public void testStructuredLoggingService() {
        // Test that structured logging methods don't throw exceptions
        assertDoesNotThrow(() -> {
            structuredLoggingService.logBusinessEvent("TEST_EVENT", "Test message", 
                Map.of("key", "value"));
            
            structuredLoggingService.logPerformanceMetric("test_operation", 100L, true, 
                Map.of("component", "test"));
            
            structuredLoggingService.logUserJourneyEvent("user123", "session456", 
                "click", "button", Map.of("buttonId", "submit"));
            
            structuredLoggingService.logAIServiceInteraction("bedrock", "invoke", 
                200L, true, Map.of("model", "nova"));
            
            structuredLoggingService.logCircuitBreakerEvent("dynamodb", "OPEN", 
                "Too many failures", Map.of("failureCount", 5));
            
            structuredLoggingService.logDataProcessingEvent("event123", "validation", 
                true, 50L, Map.of("eventType", "user_click"));
        });
    }

    @Test
    public void testCorrelationIdHandling() {
        // Test correlation ID methods
        assertDoesNotThrow(() -> {
            structuredLoggingService.addContext("testKey", "testValue");
            structuredLoggingService.removeContext("testKey");
        });
        
        // These might return null in test environment, but should not throw
        assertDoesNotThrow(() -> {
            structuredLoggingService.getCurrentCorrelationId();
            structuredLoggingService.getCurrentRequestId();
        });
    }

    @Test
    public void testHealthStatusEnums() {
        // Test that health status enums work correctly
        HealthCheckService.HealthStatus.Status[] statuses = HealthCheckService.HealthStatus.Status.values();
        assertTrue(statuses.length > 0);
        
        // Test creating health status objects
        HealthCheckService.HealthStatus status = new HealthCheckService.HealthStatus(
            HealthCheckService.HealthStatus.Status.UP,
            "Test message",
            Map.of("test", "value")
        );
        
        assertEquals(HealthCheckService.HealthStatus.Status.UP, status.getStatus());
        assertEquals("Test message", status.getMessage());
        assertNotNull(status.getDetails());
        assertTrue(status.getDetails().containsKey("test"));
    }

    @Test
    public void testMonitoringServiceMetrics() {
        // Test various monitoring service methods
        assertDoesNotThrow(() -> {
            monitoringService.incrementUserEventsProcessed("click");
            monitoringService.incrementStruggleSignalsDetected("calculator", 3);
            monitoringService.incrementInterventionsExecuted("tooltip");
            monitoringService.incrementAiServiceErrors("bedrock", "timeout");
            monitoringService.incrementBedrockInvocations("nova-micro");
            monitoringService.incrementNovaAnalysisRequests();
            monitoringService.incrementSagemakerPredictions();
            monitoringService.incrementHighVideoEngagement("video123", 0.85);
        });
        
        // Test timer methods
        assertDoesNotThrow(() -> {
            var sample = monitoringService.startDataProcessingTimer();
            monitoringService.recordDataProcessingTime(sample);
            
            var aiSample = monitoringService.startAiServiceTimer();
            monitoringService.recordAiServiceTime(aiSample, "bedrock");
            
            var dbSample = monitoringService.startDatabaseTimer();
            monitoringService.recordDatabaseTime(dbSample, "query");
        });
        
        // Test business metrics
        assertDoesNotThrow(() -> {
            monitoringService.recordUserJourneyMetric("engagement_score", 0.75, "user", "user123");
            monitoringService.recordPerformanceMetric("api_call", java.time.Duration.ofMillis(200), true);
            monitoringService.recordUserEngagementPattern("user123", "high_activity", 0.9);
            monitoringService.recordInterventionEffectiveness("tooltip", true);
            monitoringService.recordCostMetric("bedrock", 0.05);
        });
    }
}