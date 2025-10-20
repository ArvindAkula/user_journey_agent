package com.userjourney.analytics.service;

import io.micrometer.core.instrument.*;
import io.micrometer.core.instrument.Timer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service for collecting and exposing custom application metrics
 */
@Service
public class MetricsCollectionService {

    @Autowired
    private MeterRegistry meterRegistry;

    // Custom counters
    private final Counter userEventsProcessed;
    private final Counter struggleSignalsDetected;
    private final Counter interventionsExecuted;
    private final Counter interventionsSuccessful;
    private final Counter authenticationFailures;
    private final Counter rateLimitExceeded;
    private final Counter securityEvents;

    // Custom gauges
    private final AtomicLong activeUsers = new AtomicLong(0);
    private final AtomicLong processingQueueSize = new AtomicLong(0);
    private final AtomicLong circuitBreakerOpenCount = new AtomicLong(0);

    // Custom timers
    private final Timer dataProcessingTimer;
    private final Timer aiServiceTimer;
    private final Timer databaseOperationTimer;

    // Business metrics
    private final Map<String, AtomicLong> featureUsageCounters = new ConcurrentHashMap<>();
    private final Map<String, Timer> featureResponseTimes = new ConcurrentHashMap<>();

    public MetricsCollectionService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;

        // Initialize counters
        this.userEventsProcessed = Counter.builder("user_events_processed_total")
                .description("Total number of user events processed")
                .register(meterRegistry);

        this.struggleSignalsDetected = Counter.builder("struggle_signals_detected_total")
                .description("Total number of struggle signals detected")
                .tag("signal_type", "all")
                .register(meterRegistry);

        this.interventionsExecuted = Counter.builder("interventions_executed_total")
                .description("Total number of interventions executed")
                .register(meterRegistry);

        this.interventionsSuccessful = Counter.builder("interventions_successful_total")
                .description("Total number of successful interventions")
                .register(meterRegistry);

        this.authenticationFailures = Counter.builder("authentication_failures_total")
                .description("Total number of authentication failures")
                .register(meterRegistry);

        this.rateLimitExceeded = Counter.builder("rate_limit_exceeded_total")
                .description("Total number of rate limit exceeded events")
                .register(meterRegistry);

        this.securityEvents = Counter.builder("security_events_total")
                .description("Total number of security events")
                .tag("event_type", "all")
                .register(meterRegistry);

        // Initialize gauges
        Gauge.builder("active_users", activeUsers, AtomicLong::get)
                .description("Number of currently active users")
                .register(meterRegistry);

        Gauge.builder("processing_queue_size", processingQueueSize, AtomicLong::get)
                .description("Current size of the processing queue")
                .register(meterRegistry);

        Gauge.builder("circuit_breaker_open_count", circuitBreakerOpenCount, AtomicLong::get)
                .description("Number of circuit breakers currently open")
                .register(meterRegistry);

        // Initialize timers
        this.dataProcessingTimer = Timer.builder("data_processing_duration_seconds")
                .description("Time taken to process data")
                .register(meterRegistry);

        this.aiServiceTimer = Timer.builder("ai_service_request_duration_seconds")
                .description("Time taken for AI service requests")
                .tag("service_name", "all")
                .register(meterRegistry);

        this.databaseOperationTimer = Timer.builder("database_operation_duration_seconds")
                .description("Time taken for database operations")
                .tag("operation", "all")
                .register(meterRegistry);

        // Register JVM and system metrics
        registerSystemMetrics();
    }

    /**
     * Increment user events processed counter
     */
    public void incrementUserEventsProcessed() {
        userEventsProcessed.increment();
    }

    /**
     * Increment user events processed counter with tags
     */
    public void incrementUserEventsProcessed(String eventType, String source) {
        Counter.builder("user_events_processed_total")
                .tag("event_type", eventType)
                .tag("source", source)
                .register(meterRegistry)
                .increment();
    }

    /**
     * Increment struggle signals detected counter
     */
    public void incrementStruggleSignalsDetected(String signalType, String featureName) {
        Counter.builder("struggle_signals_detected_total")
                .tag("signal_type", signalType)
                .tag("feature_name", featureName)
                .register(meterRegistry)
                .increment();
    }

    /**
     * Increment interventions executed counter
     */
    public void incrementInterventionsExecuted(String interventionType, boolean successful) {
        Counter.builder("interventions_executed_total")
                .tag("intervention_type", interventionType)
                .register(meterRegistry)
                .increment();

        if (successful) {
            Counter.builder("interventions_successful_total")
                    .tag("intervention_type", interventionType)
                    .register(meterRegistry)
                    .increment();
        }
    }

    /**
     * Record authentication failure
     */
    public void recordAuthenticationFailure(String reason, String userAgent) {
        Counter.builder("authentication_failures_total")
                .tag("reason", reason)
                .tag("user_agent", userAgent != null ? userAgent : "unknown")
                .register(meterRegistry)
                .increment();
    }

    /**
     * Record rate limit exceeded event
     */
    public void recordRateLimitExceeded(String endpoint, String clientId) {
        Counter.builder("rate_limit_exceeded_total")
                .tag("endpoint", endpoint)
                .tag("client_id", clientId != null ? clientId : "unknown")
                .register(meterRegistry)
                .increment();
    }

    /**
     * Record security event
     */
    public void recordSecurityEvent(String eventType, String severity) {
        Counter.builder("security_events_total")
                .tag("event_type", eventType)
                .tag("severity", severity)
                .register(meterRegistry)
                .increment();
    }

    /**
     * Update active users count
     */
    public void setActiveUsers(long count) {
        activeUsers.set(count);
    }

    /**
     * Update processing queue size
     */
    public void setProcessingQueueSize(long size) {
        processingQueueSize.set(size);
    }

    /**
     * Update circuit breaker open count
     */
    public void setCircuitBreakerOpenCount(long count) {
        circuitBreakerOpenCount.set(count);
    }

    /**
     * Record data processing time
     */
    public void recordDataProcessingTime(Duration duration, String processingType) {
        Timer.builder("data_processing_duration_seconds")
                .tag("processing_type", processingType)
                .register(meterRegistry)
                .record(duration);
    }

    /**
     * Record AI service request time
     */
    public void recordAiServiceTime(Duration duration, String serviceName, boolean successful) {
        Timer.builder("ai_service_request_duration_seconds")
                .tag("service_name", serviceName)
                .tag("success", String.valueOf(successful))
                .register(meterRegistry)
                .record(duration);
    }

    /**
     * Record database operation time
     */
    public void recordDatabaseOperationTime(Duration duration, String operation, String table) {
        Timer.builder("database_operation_duration_seconds")
                .tag("operation", operation)
                .tag("table", table)
                .register(meterRegistry)
                .record(duration);
    }

    /**
     * Record feature usage
     */
    public void recordFeatureUsage(String featureName, String userId) {
        Counter.builder("feature_usage_total")
                .tag("feature_name", featureName)
                .register(meterRegistry)
                .increment();

        // Track unique users per feature (simplified)
        String key = "feature_unique_users_" + featureName;
        featureUsageCounters.computeIfAbsent(key, k -> {
            AtomicLong counter = new AtomicLong(0);
            Gauge.builder("feature_unique_users", counter, AtomicLong::get)
                    .tag("feature_name", featureName)
                    .register(meterRegistry);
            return counter;
        });
    }

    /**
     * Record feature response time
     */
    public void recordFeatureResponseTime(String featureName, Duration duration) {
        featureResponseTimes.computeIfAbsent(featureName, name ->
                Timer.builder("feature_response_time_seconds")
                        .tag("feature_name", name)
                        .register(meterRegistry)
        ).record(duration);
    }

    /**
     * Record user session metrics
     */
    public void recordUserSession(String action, Duration sessionDuration, int eventCount) {
        Counter.builder("user_sessions_total")
                .tag("action", action) // started, completed, abandoned
                .register(meterRegistry)
                .increment();

        if (sessionDuration != null) {
            Timer.builder("session_duration_seconds")
                    .register(meterRegistry)
                    .record(sessionDuration);
        }

        if (eventCount > 0) {
            DistributionSummary.builder("session_event_count")
                    .register(meterRegistry)
                    .record(eventCount);
        }
    }

    /**
     * Record user engagement score
     */
    public void recordUserEngagementScore(double score, String userId) {
        DistributionSummary.builder("user_engagement_score")
                .register(meterRegistry)
                .record(score);
    }

    /**
     * Record business KPI metrics
     */
    public void recordBusinessKPI(String kpiName, double value, Map<String, String> tags) {
        Gauge.Builder<MetricsCollectionService> builder = Gauge.builder("business_kpi_" + kpiName.toLowerCase().replace(" ", "_"), this, service -> value)
                .description("Business KPI: " + kpiName);

        if (tags != null) {
            tags.forEach(builder::tag);
        }

        builder.register(meterRegistry);
    }

    /**
     * Get current metrics summary
     */
    public Map<String, Object> getMetricsSummary() {
        Map<String, Object> summary = new HashMap<>();
        
        summary.put("userEventsProcessed", userEventsProcessed.count());
        summary.put("struggleSignalsDetected", struggleSignalsDetected.count());
        summary.put("interventionsExecuted", interventionsExecuted.count());
        summary.put("interventionsSuccessful", interventionsSuccessful.count());
        summary.put("authenticationFailures", authenticationFailures.count());
        summary.put("activeUsers", activeUsers.get());
        summary.put("processingQueueSize", processingQueueSize.get());
        summary.put("circuitBreakerOpenCount", circuitBreakerOpenCount.get());
        
        return summary;
    }

    /**
     * Register additional system metrics
     */
    private void registerSystemMetrics() {
        // JVM Memory metrics are automatically registered by Micrometer
        
        // Custom application health metric
        Gauge.builder("application_health", this, service -> isApplicationHealthy() ? 1.0 : 0.0)
                .description("Application health status (1 = healthy, 0 = unhealthy)")
                .register(meterRegistry);

        // Custom business health metric
        Gauge.builder("business_health", this, service -> calculateBusinessHealth())
                .description("Business process health status")
                .register(meterRegistry);
    }

    /**
     * Check if application is healthy
     */
    private boolean isApplicationHealthy() {
        // Implement health check logic
        return circuitBreakerOpenCount.get() < 3 && processingQueueSize.get() < 1000;
    }

    /**
     * Calculate business health score
     */
    private double calculateBusinessHealth() {
        // Implement business health calculation
        double interventionSuccessRate = interventionsExecuted.count() > 0 ? 
                interventionsSuccessful.count() / interventionsExecuted.count() : 1.0;
        
        return Math.min(1.0, interventionSuccessRate);
    }
}