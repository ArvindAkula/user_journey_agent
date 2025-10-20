package com.userjourney.analytics.controller;

import com.userjourney.analytics.resilience.CircuitBreaker;
import com.userjourney.analytics.resilience.ErrorHandlingService;
import com.userjourney.analytics.service.CircuitBreakerIntegrationService;
import com.userjourney.analytics.service.MonitoringService;
import com.userjourney.analytics.service.StructuredLoggingService;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Controller for monitoring endpoints including Prometheus metrics and circuit breaker status
 */
@RestController
@RequestMapping("/api/monitoring")
@CrossOrigin(origins = "*")
public class MonitoringController {

    private static final Logger logger = LoggerFactory.getLogger(MonitoringController.class);

    @Autowired
    private MonitoringService monitoringService;

    @Autowired
    private CircuitBreakerIntegrationService circuitBreakerService;

    @Autowired
    private ErrorHandlingService errorHandlingService;

    @Autowired
    private StructuredLoggingService structuredLoggingService;

    @Autowired
    private MeterRegistry meterRegistry;

    @Autowired
    private com.userjourney.analytics.service.LogAggregationService logAggregationService;

    @Autowired
    private com.userjourney.analytics.service.MetricsCollectionService metricsCollectionService;

    /**
     * Metrics endpoint - returns available metrics information
     */
    @GetMapping(value = "/metrics", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> metricsInfo() {
        structuredLoggingService.logBusinessEvent("METRICS_REQUEST", 
            "Metrics information requested", 
            Map.of("endpoint", "/metrics"));

        try {
            Map<String, Object> metricsInfo = new HashMap<>();
            metricsInfo.put("timestamp", Instant.now().toString());
            metricsInfo.put("message", "Metrics are available via Spring Boot Actuator endpoints");
            metricsInfo.put("actuatorEndpoints", Map.of(
                "metrics", "/actuator/metrics",
                "prometheus", "/actuator/prometheus",
                "health", "/actuator/health"
            ));
            metricsInfo.put("meterRegistryType", meterRegistry.getClass().getSimpleName());
            
            return ResponseEntity.ok(metricsInfo);
        } catch (Exception e) {
            logger.error("Failed to get metrics info", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get metrics info: " + e.getMessage()));
        }
    }

    /**
     * Custom metrics endpoint for Prometheus scraping
     */
    @GetMapping(value = "/metrics/prometheus", produces = "text/plain")
    public ResponseEntity<String> prometheusMetrics() {
        try {
            Map<String, Object> summary = metricsCollectionService.getMetricsSummary();
            
            StringBuilder metrics = new StringBuilder();
            metrics.append("# HELP user_journey_analytics_info Application information\n");
            metrics.append("# TYPE user_journey_analytics_info gauge\n");
            metrics.append("user_journey_analytics_info{version=\"1.0.0\",environment=\"production\"} 1\n");
            
            // Add custom metrics in Prometheus format
            summary.forEach((key, value) -> {
                metrics.append("# HELP ").append(key).append(" ").append(key.replace("_", " ")).append("\n");
                metrics.append("# TYPE ").append(key).append(" gauge\n");
                metrics.append(key).append(" ").append(value).append("\n");
            });
            
            return ResponseEntity.ok(metrics.toString());
        } catch (Exception e) {
            logger.error("Failed to generate Prometheus metrics", e);
            return ResponseEntity.internalServerError().body("# Error generating metrics");
        }
    }

    /**
     * Circuit breaker status endpoint
     */
    @GetMapping("/circuit-breakers")
    public ResponseEntity<Map<String, Object>> getCircuitBreakerStatus() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("CIRCUIT_BREAKER_STATUS_REQUEST", 
            "Circuit breaker status requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            Map<String, CircuitBreaker.CircuitBreakerStatus> statuses = circuitBreakerService.getCircuitBreakerStatuses();
            
            Map<String, Object> response = new HashMap<>();
            response.put("timestamp", Instant.now().toString());
            response.put("circuitBreakers", statuses);
            response.put("totalServices", statuses.size());
            
            // Count services by state
            Map<String, Integer> stateCount = new HashMap<>();
            for (CircuitBreaker.CircuitBreakerStatus status : statuses.values()) {
                String state = status.getState().toString();
                stateCount.merge(state, 1, Integer::sum);
            }
            response.put("stateDistribution", stateCount);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to get circuit breaker status", e);
            structuredLoggingService.logError("MonitoringController", "getCircuitBreakerStatus", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get circuit breaker status: " + e.getMessage()));
        }
    }

    /**
     * Reset circuit breaker for a specific service
     */
    @PostMapping("/circuit-breakers/{serviceName}/reset")
    public ResponseEntity<Map<String, Object>> resetCircuitBreaker(@PathVariable String serviceName) {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("CIRCUIT_BREAKER_RESET", 
            "Circuit breaker reset requested", 
            Map.of("serviceName", serviceName, "correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            circuitBreakerService.resetCircuitBreaker(serviceName);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Circuit breaker reset successfully");
            response.put("serviceName", serviceName);
            response.put("timestamp", Instant.now().toString());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to reset circuit breaker for service: {}", serviceName, e);
            structuredLoggingService.logError("MonitoringController", "resetCircuitBreaker", e, 
                Map.of("serviceName", serviceName, "correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to reset circuit breaker: " + e.getMessage()));
        }
    }

    /**
     * Error statistics endpoint
     */
    @GetMapping("/errors")
    public ResponseEntity<Map<String, Object>> getErrorStatistics() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("ERROR_STATISTICS_REQUEST", 
            "Error statistics requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            Map<String, ErrorHandlingService.ErrorMetrics> errorStats = errorHandlingService.getErrorStatistics();
            
            Map<String, Object> response = new HashMap<>();
            response.put("timestamp", Instant.now().toString());
            response.put("errorStatistics", errorStats);
            response.put("totalErrorTypes", errorStats.size());
            
            // Calculate total error count
            long totalErrors = errorStats.values().stream()
                .mapToLong(ErrorHandlingService.ErrorMetrics::getCount)
                .sum();
            response.put("totalErrorCount", totalErrors);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to get error statistics", e);
            structuredLoggingService.logError("MonitoringController", "getErrorStatistics", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get error statistics: " + e.getMessage()));
        }
    }

    /**
     * Application metrics summary
     */
    @GetMapping("/metrics/summary")
    public ResponseEntity<Map<String, Object>> getMetricsSummary() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("METRICS_SUMMARY_REQUEST", 
            "Metrics summary requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            Map<String, Object> summary = new HashMap<>();
            summary.put("timestamp", Instant.now().toString());
            
            // Application health
            summary.put("applicationHealthy", monitoringService.isHealthy());
            
            // Active users
            summary.put("activeUsers", monitoringService.getActiveUsers());
            
            // Processing queue size
            summary.put("processingQueueSize", monitoringService.getProcessingQueueSize());
            
            // AI service health
            summary.put("aiServiceHealthy", monitoringService.getAiServiceHealth() == 1.0);
            
            // Circuit breaker summary
            Map<String, CircuitBreaker.CircuitBreakerStatus> cbStatuses = circuitBreakerService.getCircuitBreakerStatuses();
            long openCircuitBreakers = cbStatuses.values().stream()
                .mapToLong(status -> status.getState() == CircuitBreaker.CircuitState.OPEN ? 1 : 0)
                .sum();
            summary.put("openCircuitBreakers", openCircuitBreakers);
            summary.put("totalCircuitBreakers", cbStatuses.size());
            
            // JVM metrics
            Runtime runtime = Runtime.getRuntime();
            Map<String, Object> jvmMetrics = new HashMap<>();
            jvmMetrics.put("maxMemory", runtime.maxMemory());
            jvmMetrics.put("totalMemory", runtime.totalMemory());
            jvmMetrics.put("freeMemory", runtime.freeMemory());
            jvmMetrics.put("usedMemory", runtime.totalMemory() - runtime.freeMemory());
            jvmMetrics.put("memoryUsagePercent", 
                ((double)(runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory()) * 100);
            summary.put("jvm", jvmMetrics);
            
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            logger.error("Failed to get metrics summary", e);
            structuredLoggingService.logError("MonitoringController", "getMetricsSummary", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get metrics summary: " + e.getMessage()));
        }
    }

    /**
     * Clear error statistics (for testing/maintenance)
     */
    @PostMapping("/errors/clear")
    public ResponseEntity<Map<String, Object>> clearErrorStatistics() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("CLEAR_ERROR_STATISTICS", 
            "Error statistics cleared", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            errorHandlingService.clearErrorStatistics();
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Error statistics cleared successfully");
            response.put("timestamp", Instant.now().toString());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to clear error statistics", e);
            structuredLoggingService.logError("MonitoringController", "clearErrorStatistics", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to clear error statistics: " + e.getMessage()));
        }
    }

    /**
     * Get log aggregation statistics
     */
    @GetMapping("/logs/statistics")
    public ResponseEntity<Map<String, Object>> getLogStatistics() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("LOG_STATISTICS_REQUEST", 
            "Log statistics requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            Map<String, Object> stats = logAggregationService.getLogStatistics();
            
            Map<String, Object> response = new HashMap<>();
            response.put("timestamp", Instant.now().toString());
            response.put("statistics", stats);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to get log statistics", e);
            structuredLoggingService.logError("MonitoringController", "getLogStatistics", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get log statistics: " + e.getMessage()));
        }
    }

    /**
     * Query logs for specific patterns
     */
    @PostMapping("/logs/query")
    public ResponseEntity<Map<String, Object>> queryLogs(@RequestBody Map<String, Object> queryRequest) {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("LOG_QUERY_REQUEST", 
            "Log query requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown", 
                   "queryRequest", queryRequest));

        try {
            String pattern = (String) queryRequest.get("pattern");
            if (pattern == null || pattern.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Pattern is required"));
            }
            
            // Default to last hour if no time range specified
            Instant endTime = Instant.now();
            Instant startTime = endTime.minusSeconds(3600);
            
            if (queryRequest.containsKey("startTime")) {
                startTime = Instant.parse((String) queryRequest.get("startTime"));
            }
            if (queryRequest.containsKey("endTime")) {
                endTime = Instant.parse((String) queryRequest.get("endTime"));
            }
            
            // Start async query
            logAggregationService.queryLogsForPattern(pattern, startTime, endTime);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Log query started");
            response.put("pattern", pattern);
            response.put("startTime", startTime.toString());
            response.put("endTime", endTime.toString());
            response.put("timestamp", Instant.now().toString());
            
            return ResponseEntity.accepted().body(response);
        } catch (Exception e) {
            logger.error("Failed to start log query", e);
            structuredLoggingService.logError("MonitoringController", "queryLogs", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to start log query: " + e.getMessage()));
        }
    }

    /**
     * Trigger critical pattern check
     */
    @PostMapping("/logs/check-patterns")
    public ResponseEntity<Map<String, Object>> checkCriticalPatterns() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("CHECK_CRITICAL_PATTERNS", 
            "Critical pattern check requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            logAggregationService.checkForCriticalPatterns();
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Critical pattern check initiated");
            response.put("timestamp", Instant.now().toString());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to check critical patterns", e);
            structuredLoggingService.logError("MonitoringController", "checkCriticalPatterns", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to check critical patterns: " + e.getMessage()));
        }
    }

    /**
     * Create CloudWatch metric filters
     */
    @PostMapping("/logs/metric-filters")
    public ResponseEntity<Map<String, Object>> createMetricFilters() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("CREATE_METRIC_FILTERS", 
            "Metric filter creation requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            logAggregationService.createMetricFilters();
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "CloudWatch metric filters created");
            response.put("timestamp", Instant.now().toString());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create metric filters", e);
            structuredLoggingService.logError("MonitoringController", "createMetricFilters", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to create metric filters: " + e.getMessage()));
        }
    }

    /**
     * Test endpoint to generate sample metrics (for testing)
     */
    @PostMapping("/test/generate-metrics")
    public ResponseEntity<Map<String, Object>> generateTestMetrics() {
        String correlationId = MDC.get("correlationId");
        
        structuredLoggingService.logBusinessEvent("GENERATE_TEST_METRICS", 
            "Test metrics generation requested", 
            Map.of("correlationId", correlationId != null ? correlationId : "unknown"));

        try {
            // Generate some test metrics
            monitoringService.incrementUserEventsProcessed();
            monitoringService.incrementStruggleSignalsDetected();
            monitoringService.incrementInterventionsExecuted();
            monitoringService.recordDataProcessingTime(java.time.Duration.ofMillis(150));
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Test metrics generated successfully");
            response.put("timestamp", Instant.now().toString());
            response.put("metricsGenerated", 4);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to generate test metrics", e);
            structuredLoggingService.logError("MonitoringController", "generateTestMetrics", e, 
                Map.of("correlationId", correlationId != null ? correlationId : "unknown"));
            
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to generate test metrics: " + e.getMessage()));
        }
    }
}