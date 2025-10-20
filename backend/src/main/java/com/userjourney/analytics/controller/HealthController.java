package com.userjourney.analytics.controller;

import com.userjourney.analytics.service.HealthCheckService;
import com.userjourney.analytics.service.RealTimeEventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000")
public class HealthController {

    private static final Logger logger = LoggerFactory.getLogger(HealthController.class);

    @Autowired
    private RealTimeEventService realTimeEventService;

    @Autowired
    private HealthCheckService healthCheckService;

    public HealthController() {
        logger.info("=== HealthController CONSTRUCTOR CALLED ===");
        System.out.println("=== HealthController CONSTRUCTOR CALLED ===");
    }

    /**
     * Basic health endpoint for load balancers - fast response
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        logger.info("=== HEALTH ENDPOINT CALLED ===");
        System.out.println("=== HEALTH ENDPOINT CALLED ===");
        logger.debug("Health check requested - correlationId: {}", MDC.get("correlationId"));
        
        try {
            HealthCheckService.HealthStatus status = healthCheckService.getBasicHealth();
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", status.getStatus().toString());
            response.put("message", status.getMessage());
            response.put("timestamp", LocalDateTime.now());
            response.put("service", "User Journey Analytics Backend");
            response.put("version", "0.0.1-SNAPSHOT");
            response.put("realTimeEnabled", true);
            response.putAll(status.getDetails());
            
            HttpStatus httpStatus = status.getStatus() == HealthCheckService.HealthStatus.Status.UP 
                ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
            
            return ResponseEntity.status(httpStatus).body(response);
        } catch (Exception e) {
            logger.error("Health check failed", e);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "DOWN");
            response.put("message", "Health check failed: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }

    /**
     * Detailed health endpoint for monitoring systems
     */
    @GetMapping("/health/detailed")
    public ResponseEntity<HealthCheckService.DetailedHealthStatus> detailedHealth() {
        logger.debug("Detailed health check requested - correlationId: {}", MDC.get("correlationId"));
        
        try {
            HealthCheckService.DetailedHealthStatus status = healthCheckService.getDetailedHealth();
            
            HttpStatus httpStatus = status.getStatus() == HealthCheckService.HealthStatus.Status.UP 
                ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
            
            return ResponseEntity.status(httpStatus).body(status);
        } catch (Exception e) {
            logger.error("Detailed health check failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Readiness probe for Kubernetes - checks if app is ready to serve traffic
     */
    @GetMapping("/health/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        logger.debug("Readiness check requested - correlationId: {}", MDC.get("correlationId"));
        
        try {
            HealthCheckService.HealthStatus status = healthCheckService.getReadinessCheck();
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", status.getStatus().toString());
            response.put("message", status.getMessage());
            response.put("timestamp", LocalDateTime.now());
            response.putAll(status.getDetails());
            
            HttpStatus httpStatus = status.getStatus() == HealthCheckService.HealthStatus.Status.UP 
                ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
            
            return ResponseEntity.status(httpStatus).body(response);
        } catch (Exception e) {
            logger.error("Readiness check failed", e);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "DOWN");
            response.put("message", "Readiness check failed: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }

    /**
     * Liveness probe for Kubernetes - checks if app is alive and not deadlocked
     */
    @GetMapping("/health/live")
    public ResponseEntity<Map<String, Object>> liveness() {
        logger.debug("Liveness check requested - correlationId: {}", MDC.get("correlationId"));
        
        try {
            HealthCheckService.HealthStatus status = healthCheckService.getLivenessCheck();
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", status.getStatus().toString());
            response.put("message", status.getMessage());
            response.put("timestamp", LocalDateTime.now());
            response.putAll(status.getDetails());
            
            HttpStatus httpStatus = status.getStatus() == HealthCheckService.HealthStatus.Status.UP 
                ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
            
            return ResponseEntity.status(httpStatus).body(response);
        } catch (Exception e) {
            logger.error("Liveness check failed", e);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "DOWN");
            response.put("message", "Liveness check failed: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }

    @GetMapping("/ping")
    public ResponseEntity<Map<String, String>> ping() {
        logger.debug("Ping requested - correlationId: {}", MDC.get("correlationId"));
        
        Map<String, String> response = new HashMap<>();
        response.put("message", "pong");
        response.put("backend", "Spring Boot Real-Time");
        response.put("correlationId", MDC.get("correlationId"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/events")
    public Map<String, Object> trackEvent(@RequestBody Map<String, Object> eventData) {
        try {
            // Process event through the real-time pipeline
            realTimeEventService.processEvent(eventData);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Event processed successfully");
            response.put("timestamp", LocalDateTime.now());
            return response;
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Event processing failed: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            return response;
        }
    }

    @PostMapping("/events/batch")
    public Map<String, Object> trackEventBatch(@RequestBody Map<String, Object> batchData) {
        try {
            logger.info("[DEBUG] Received batch events: {}", batchData);
            
            // Extract events array from batch data
            Object eventsObj = batchData.get("events");
            int processedCount = 0;
            
            if (eventsObj instanceof java.util.List) {
                java.util.List<?> events = (java.util.List<?>) eventsObj;
                logger.info("[DEBUG] Processing {} events from batch", events.size());
                
                for (Object eventObj : events) {
                    if (eventObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> event = (Map<String, Object>) eventObj;
                        
                        // Process each event through the real-time pipeline
                        realTimeEventService.processEvent(event);
                        processedCount++;
                    }
                }
                
                logger.info("[DEBUG] Successfully processed {} events", processedCount);
            } else {
                logger.warn("[DEBUG] No events array found in batch data");
            }
            
            // Process batch events
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Batch events processed successfully");
            response.put("eventsProcessed", processedCount);
            response.put("timestamp", LocalDateTime.now());
            return response;
        } catch (Exception e) {
            logger.error("[DEBUG] Error processing batch events: ", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Batch event processing failed: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            return response;
        }
    }

    // Removed getDashboardMetrics() - now handled by AnalyticsDashboardController
}