package com.userjourney.analytics.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.cloudwatchlogs.CloudWatchLogsClient;
import software.amazon.awssdk.services.cloudwatchlogs.model.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service for aggregating and managing log data across different categories
 */
@Service
public class LogAggregationService {

    private static final Logger logger = LoggerFactory.getLogger(LogAggregationService.class);

    @Autowired
    private StructuredLoggingService structuredLoggingService;

    @Autowired(required = false)
    private CloudWatchLogsClient cloudWatchLogsClient;

    @Value("${logging.cloudwatch.log-group:/aws/user-journey-analytics/application}")
    private String baseLogGroup;

    @Value("${logging.cloudwatch.enabled:true}")
    private boolean cloudWatchEnabled;

    // Log aggregation counters
    private final Map<String, AtomicLong> logCounters = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> errorCounters = new ConcurrentHashMap<>();
    private final Map<String, List<Long>> performanceMetrics = new ConcurrentHashMap<>();

    /**
     * Aggregate business event logs
     */
    public void aggregateBusinessEvent(String eventType, String component, boolean success) {
        String key = String.format("business.%s.%s", component, eventType);
        logCounters.computeIfAbsent(key, k -> new AtomicLong(0)).incrementAndGet();
        
        if (!success) {
            errorCounters.computeIfAbsent(key, k -> new AtomicLong(0)).incrementAndGet();
        }
        
        // Log aggregation event
        Map<String, Object> context = new HashMap<>();
        context.put("component", component);
        context.put("success", success);
        context.put("aggregationKey", key);
        
        structuredLoggingService.logBusinessEvent("LOG_AGGREGATION", 
            String.format("Aggregated %s event for %s", eventType, component), context);
    }

    /**
     * Aggregate performance metrics
     */
    public void aggregatePerformanceMetric(String operation, long durationMs, String component) {
        String key = String.format("performance.%s.%s", component, operation);
        
        performanceMetrics.computeIfAbsent(key, k -> new ArrayList<>()).add(durationMs);
        
        // Keep only last 1000 measurements per key to prevent memory issues
        List<Long> metrics = performanceMetrics.get(key);
        if (metrics.size() > 1000) {
            metrics.subList(0, metrics.size() - 1000).clear();
        }
        
        // Log performance aggregation
        Map<String, Object> context = new HashMap<>();
        context.put("component", component);
        context.put("operation", operation);
        context.put("durationMs", durationMs);
        context.put("aggregationKey", key);
        
        structuredLoggingService.logPerformanceMetric("PERFORMANCE_AGGREGATION", durationMs, true, context);
    }

    /**
     * Aggregate error events
     */
    public void aggregateError(String component, String errorType, String operation) {
        String key = String.format("error.%s.%s.%s", component, errorType, operation);
        errorCounters.computeIfAbsent(key, k -> new AtomicLong(0)).incrementAndGet();
        
        // Log error aggregation
        Map<String, Object> context = new HashMap<>();
        context.put("component", component);
        context.put("errorType", errorType);
        context.put("operation", operation);
        context.put("aggregationKey", key);
        
        structuredLoggingService.logError("LOG_AGGREGATION", "ERROR_AGGREGATION", 
            new RuntimeException("Aggregated error: " + errorType), context);
    }

    /**
     * Get aggregated log statistics
     */
    public Map<String, Object> getLogStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        // Business event statistics
        Map<String, Long> businessStats = new HashMap<>();
        logCounters.entrySet().stream()
            .filter(entry -> entry.getKey().startsWith("business."))
            .forEach(entry -> businessStats.put(entry.getKey(), entry.getValue().get()));
        stats.put("businessEvents", businessStats);
        
        // Error statistics
        Map<String, Long> errorStats = new HashMap<>();
        errorCounters.entrySet().forEach(entry -> errorStats.put(entry.getKey(), entry.getValue().get()));
        stats.put("errors", errorStats);
        
        // Performance statistics
        Map<String, Map<String, Object>> perfStats = new HashMap<>();
        performanceMetrics.entrySet().forEach(entry -> {
            List<Long> metrics = entry.getValue();
            if (!metrics.isEmpty()) {
                Map<String, Object> metricStats = new HashMap<>();
                metricStats.put("count", metrics.size());
                metricStats.put("average", metrics.stream().mapToLong(Long::longValue).average().orElse(0.0));
                metricStats.put("min", metrics.stream().mapToLong(Long::longValue).min().orElse(0));
                metricStats.put("max", metrics.stream().mapToLong(Long::longValue).max().orElse(0));
                perfStats.put(entry.getKey(), metricStats);
            }
        });
        stats.put("performance", perfStats);
        
        return stats;
    }

    /**
     * Create log-based alerts for critical patterns
     */
    @Async
    public void checkForCriticalPatterns() {
        try {
            // Check error rates
            checkErrorRates();
            
            // Check performance degradation
            checkPerformanceDegradation();
            
            // Check for unusual patterns
            checkUnusualPatterns();
            
        } catch (Exception e) {
            logger.error("Failed to check for critical log patterns", e);
        }
    }

    /**
     * Check error rates and trigger alerts if thresholds are exceeded
     */
    private void checkErrorRates() {
        errorCounters.entrySet().forEach(entry -> {
            String key = entry.getKey();
            long errorCount = entry.getValue().get();
            long totalCount = logCounters.getOrDefault(key.replace("error.", "business."), new AtomicLong(0)).get();
            
            if (totalCount > 0) {
                double errorRate = (double) errorCount / totalCount;
                
                // Alert if error rate > 5%
                if (errorRate > 0.05) {
                    Map<String, Object> alertContext = new HashMap<>();
                    alertContext.put("errorRate", errorRate);
                    alertContext.put("errorCount", errorCount);
                    alertContext.put("totalCount", totalCount);
                    alertContext.put("component", key);
                    alertContext.put("alertType", "HIGH_ERROR_RATE");
                    
                    structuredLoggingService.logSecurityEvent("HIGH_ERROR_RATE", 
                        String.format("High error rate detected: %.2f%% for %s", errorRate * 100, key), 
                        "system", alertContext);
                }
            }
        });
    }

    /**
     * Check for performance degradation
     */
    private void checkPerformanceDegradation() {
        performanceMetrics.entrySet().forEach(entry -> {
            String key = entry.getKey();
            List<Long> metrics = entry.getValue();
            
            if (metrics.size() >= 10) {
                // Get recent metrics (last 10)
                List<Long> recentMetrics = metrics.subList(Math.max(0, metrics.size() - 10), metrics.size());
                double recentAverage = recentMetrics.stream().mapToLong(Long::longValue).average().orElse(0.0);
                
                // Get historical average (excluding recent)
                if (metrics.size() > 10) {
                    List<Long> historicalMetrics = metrics.subList(0, metrics.size() - 10);
                    double historicalAverage = historicalMetrics.stream().mapToLong(Long::longValue).average().orElse(0.0);
                    
                    // Alert if recent performance is 50% worse than historical
                    if (historicalAverage > 0 && recentAverage > historicalAverage * 1.5) {
                        Map<String, Object> alertContext = new HashMap<>();
                        alertContext.put("recentAverage", recentAverage);
                        alertContext.put("historicalAverage", historicalAverage);
                        alertContext.put("degradationPercent", ((recentAverage - historicalAverage) / historicalAverage) * 100);
                        alertContext.put("component", key);
                        alertContext.put("alertType", "PERFORMANCE_DEGRADATION");
                        
                        structuredLoggingService.logPerformanceMetric("PERFORMANCE_DEGRADATION", 
                            (long) recentAverage, false, alertContext);
                    }
                }
            }
        });
    }

    /**
     * Check for unusual patterns in log data
     */
    private void checkUnusualPatterns() {
        // Check for sudden spikes in log volume
        long currentHourLogs = logCounters.values().stream().mapToLong(AtomicLong::get).sum();
        
        // This is a simplified check - in production, you'd want to compare with historical data
        if (currentHourLogs > 10000) { // Threshold for high log volume
            Map<String, Object> alertContext = new HashMap<>();
            alertContext.put("logVolume", currentHourLogs);
            alertContext.put("alertType", "HIGH_LOG_VOLUME");
            
            structuredLoggingService.logBusinessEvent("HIGH_LOG_VOLUME", 
                String.format("Unusually high log volume detected: %d logs", currentHourLogs), alertContext);
        }
    }

    /**
     * Scheduled task to reset counters and publish aggregated metrics
     */
    @Scheduled(fixedRate = 3600000) // Every hour
    public void publishAggregatedMetrics() {
        try {
            Map<String, Object> stats = getLogStatistics();
            
            // Log aggregated statistics
            structuredLoggingService.logBusinessEvent("LOG_STATISTICS", 
                "Hourly log aggregation statistics", stats);
            
            // Check for critical patterns
            checkForCriticalPatterns();
            
            // Reset counters for next hour (keep performance metrics for trending)
            logCounters.clear();
            errorCounters.clear();
            
            logger.info("Published aggregated log metrics and reset counters");
            
        } catch (Exception e) {
            logger.error("Failed to publish aggregated metrics", e);
        }
    }

    /**
     * Query CloudWatch logs for specific patterns
     */
    @Async
    public void queryLogsForPattern(String pattern, Instant startTime, Instant endTime) {
        if (!cloudWatchEnabled || cloudWatchLogsClient == null) {
            return;
        }
        
        try {
            StartQueryRequest queryRequest = StartQueryRequest.builder()
                    .logGroupName(baseLogGroup)
                    .startTime(startTime.getEpochSecond())
                    .endTime(endTime.getEpochSecond())
                    .queryString(String.format("fields @timestamp, @message | filter @message like /%s/", pattern))
                    .build();
            
            StartQueryResponse queryResponse = cloudWatchLogsClient.startQuery(queryRequest);
            String queryId = queryResponse.queryId();
            
            // Poll for query results
            GetQueryResultsRequest resultsRequest = GetQueryResultsRequest.builder()
                    .queryId(queryId)
                    .build();
            
            GetQueryResultsResponse results;
            do {
                Thread.sleep(1000); // Wait 1 second between polls
                results = cloudWatchLogsClient.getQueryResults(resultsRequest);
            } while (results.status() == QueryStatus.RUNNING);
            
            if (results.status() == QueryStatus.COMPLETE) {
                Map<String, Object> queryContext = new HashMap<>();
                queryContext.put("pattern", pattern);
                queryContext.put("resultCount", results.results().size());
                queryContext.put("queryId", queryId);
                
                structuredLoggingService.logBusinessEvent("LOG_QUERY_COMPLETE", 
                    String.format("CloudWatch log query completed for pattern: %s", pattern), queryContext);
            }
            
        } catch (Exception e) {
            logger.error("Failed to query CloudWatch logs for pattern: " + pattern, e);
        }
    }

    /**
     * Create CloudWatch metric filters for automated alerting
     */
    public void createMetricFilters() {
        if (!cloudWatchEnabled || cloudWatchLogsClient == null) {
            return;
        }
        
        try {
            // Create metric filter for error rates
            createMetricFilter("ErrorRate", 
                "[timestamp, level=\"ERROR\", logger, message]",
                "UserJourneyAnalytics/Errors", "ErrorCount");
            
            // Create metric filter for performance issues
            createMetricFilter("SlowRequests", 
                "[timestamp, level, logger, message=\"*completed in*ms*\" && message=\"*SLOW*\"]",
                "UserJourneyAnalytics/Performance", "SlowRequestCount");
            
            // Create metric filter for security events
            createMetricFilter("SecurityEvents", 
                "[timestamp, level, logger, message=\"SECURITY_EVENT:*\"]",
                "UserJourneyAnalytics/Security", "SecurityEventCount");
            
            logger.info("Created CloudWatch metric filters for automated alerting");
            
        } catch (Exception e) {
            logger.error("Failed to create CloudWatch metric filters", e);
        }
    }

    /**
     * Create a CloudWatch metric filter
     */
    private void createMetricFilter(String filterName, String filterPattern, 
                                  String metricNamespace, String metricName) {
        try {
            MetricTransformation transformation = MetricTransformation.builder()
                    .metricName(metricName)
                    .metricNamespace(metricNamespace)
                    .metricValue("1")
                    .build();
            
            PutMetricFilterRequest request = PutMetricFilterRequest.builder()
                    .logGroupName(baseLogGroup)
                    .filterName(filterName)
                    .filterPattern(filterPattern)
                    .metricTransformations(transformation)
                    .build();
            
            cloudWatchLogsClient.putMetricFilter(request);
            
        } catch (ResourceAlreadyExistsException e) {
            // Filter already exists, which is fine
        } catch (Exception e) {
            logger.warn("Failed to create metric filter: " + filterName, e);
        }
    }
}