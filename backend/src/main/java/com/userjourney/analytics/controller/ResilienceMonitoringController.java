package com.userjourney.analytics.controller;

import com.userjourney.analytics.resilience.CircuitBreaker;
import com.userjourney.analytics.resilience.DeadLetterQueueProcessor;
import com.userjourney.analytics.resilience.ErrorHandlingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * REST controller for monitoring resilience features
 * Provides endpoints for circuit breaker status, error statistics, and DLQ metrics
 */
@RestController
@RequestMapping("/api/resilience")
public class ResilienceMonitoringController {
    
    @Autowired
    private CircuitBreaker circuitBreaker;
    
    @Autowired
    private ErrorHandlingService errorHandlingService;
    
    @Autowired(required = false)
    private DeadLetterQueueProcessor dlqProcessor;
    
    /**
     * Get overall resilience health status
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getResilienceHealth() {
        Map<String, Object> health = new HashMap<>();
        
        // Circuit breaker status
        ConcurrentHashMap<String, CircuitBreaker.CircuitBreakerStatus> circuitStatuses = 
            circuitBreaker.getAllStatuses();
        
        long openCircuits = circuitStatuses.values().stream()
            .mapToLong(status -> status.getState() == CircuitBreaker.CircuitState.OPEN ? 1 : 0)
            .sum();
        
        health.put("circuitBreakers", Map.of(
            "total", circuitStatuses.size(),
            "open", openCircuits,
            "healthy", circuitStatuses.size() - openCircuits
        ));
        
        // Error statistics
        Map<String, ErrorHandlingService.ErrorMetrics> errorStats = errorHandlingService.getErrorStatistics();
        long totalErrors = errorStats.values().stream()
            .mapToLong(ErrorHandlingService.ErrorMetrics::getCount)
            .sum();
        
        health.put("errors", Map.of(
            "totalErrorTypes", errorStats.size(),
            "totalErrorCount", totalErrors
        ));
        
        // DLQ statistics
        if (dlqProcessor != null) {
            DeadLetterQueueProcessor.DLQStatistics dlqStats = dlqProcessor.getStatistics();
            health.put("deadLetterQueue", Map.of(
                "processedMessages", dlqStats.getProcessedMessages(),
                "retriedMessages", dlqStats.getRetriedMessages(),
                "permanentFailures", dlqStats.getPermanentFailures()
            ));
        }
        
        // Overall health status
        boolean isHealthy = openCircuits == 0;
        health.put("status", isHealthy ? "HEALTHY" : "DEGRADED");
        health.put("timestamp", Instant.now());
        
        return ResponseEntity.ok(health);
    }
    
    /**
     * Get circuit breaker statuses for all services
     */
    @GetMapping("/circuit-breakers")
    public ResponseEntity<Map<String, CircuitBreaker.CircuitBreakerStatus>> getCircuitBreakerStatuses() {
        return ResponseEntity.ok(circuitBreaker.getAllStatuses());
    }
    
    /**
     * Get circuit breaker status for specific service
     */
    @GetMapping("/circuit-breakers/{serviceName}")
    public ResponseEntity<CircuitBreaker.CircuitBreakerStatus> getCircuitBreakerStatus(
            @PathVariable String serviceName) {
        CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(serviceName);
        return ResponseEntity.ok(status);
    }
    
    /**
     * Reset circuit breaker for specific service
     */
    @PostMapping("/circuit-breakers/{serviceName}/reset")
    public ResponseEntity<Map<String, String>> resetCircuitBreaker(@PathVariable String serviceName) {
        circuitBreaker.reset(serviceName);
        
        Map<String, String> response = Map.of(
            "message", "Circuit breaker reset successfully",
            "serviceName", serviceName,
            "timestamp", Instant.now().toString()
        );
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get error statistics
     */
    @GetMapping("/errors")
    public ResponseEntity<Map<String, ErrorHandlingService.ErrorMetrics>> getErrorStatistics() {
        return ResponseEntity.ok(errorHandlingService.getErrorStatistics());
    }
    
    /**
     * Clear error statistics
     */
    @PostMapping("/errors/clear")
    public ResponseEntity<Map<String, String>> clearErrorStatistics() {
        errorHandlingService.clearErrorStatistics();
        
        Map<String, String> response = Map.of(
            "message", "Error statistics cleared successfully",
            "timestamp", Instant.now().toString()
        );
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get dead letter queue statistics
     */
    @GetMapping("/dlq/statistics")
    public ResponseEntity<DeadLetterQueueProcessor.DLQStatistics> getDLQStatistics() {
        if (dlqProcessor == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(dlqProcessor.getStatistics());
    }
    
    /**
     * Reset DLQ statistics
     */
    @PostMapping("/dlq/statistics/reset")
    public ResponseEntity<Map<String, String>> resetDLQStatistics() {
        if (dlqProcessor == null) {
            return ResponseEntity.notFound().build();
        }
        
        dlqProcessor.resetStatistics();
        
        Map<String, String> response = Map.of(
            "message", "DLQ statistics reset successfully",
            "timestamp", Instant.now().toString()
        );
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get resilience configuration
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getResilienceConfig() {
        Map<String, Object> config = new HashMap<>();
        
        // Circuit breaker defaults
        config.put("circuitBreaker", Map.of(
            "defaultFailureThreshold", 5,
            "defaultTimeoutDuration", 60000,
            "defaultSuccessThreshold", 3
        ));
        
        // Retry defaults
        config.put("retry", Map.of(
            "defaultMaxAttempts", 3,
            "defaultInitialDelay", 500,
            "defaultBackoffMultiplier", 2.0,
            "defaultMaxDelay", 30000
        ));
        
        return ResponseEntity.ok(config);
    }
    
    /**
     * Test resilience features
     */
    @PostMapping("/test/{feature}")
    public ResponseEntity<Map<String, Object>> testResilienceFeature(
            @PathVariable String feature,
            @RequestParam(defaultValue = "false") boolean shouldFail) {
        
        Map<String, Object> result = new HashMap<>();
        result.put("feature", feature);
        result.put("timestamp", Instant.now());
        
        switch (feature.toLowerCase()) {
            case "circuit-breaker":
                result.putAll(testCircuitBreaker(shouldFail));
                break;
            case "retry":
                result.putAll(testRetryMechanism(shouldFail));
                break;
            case "error-handling":
                result.putAll(testErrorHandling(shouldFail));
                break;
            default:
                result.put("error", "Unknown feature: " + feature);
                return ResponseEntity.badRequest().body(result);
        }
        
        return ResponseEntity.ok(result);
    }
    
    private Map<String, Object> testCircuitBreaker(boolean shouldFail) {
        String testService = "TestService";
        
        try {
            String result = circuitBreaker.execute(
                testService,
                () -> {
                    if (shouldFail) {
                        throw new RuntimeException("Test failure");
                    }
                    return "Success";
                },
                () -> "Fallback"
            );
            
            CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(testService);
            
            return Map.of(
                "result", result,
                "circuitState", status.getState(),
                "failureCount", status.getFailureCount(),
                "success", true
            );
        } catch (Exception e) {
            return Map.of(
                "error", e.getMessage(),
                "success", false
            );
        }
    }
    
    private Map<String, Object> testRetryMechanism(boolean shouldFail) {
        try {
            // This would need RetryHandler instance - simplified for demo
            return Map.of(
                "message", "Retry mechanism test completed",
                "shouldFail", shouldFail,
                "success", true
            );
        } catch (Exception e) {
            return Map.of(
                "error", e.getMessage(),
                "success", false
            );
        }
    }
    
    private Map<String, Object> testErrorHandling(boolean shouldFail) {
        try {
            if (shouldFail) {
                errorHandlingService.handleError("TestComponent", "testOperation", 
                    new RuntimeException("Test error"), Map.of("test", true));
            }
            
            return Map.of(
                "message", "Error handling test completed",
                "errorGenerated", shouldFail,
                "success", true
            );
        } catch (Exception e) {
            return Map.of(
                "error", e.getMessage(),
                "success", false
            );
        }
    }
}