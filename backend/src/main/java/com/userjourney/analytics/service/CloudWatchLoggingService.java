package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CloudWatchLoggingService {
    
    private static final Logger logger = LoggerFactory.getLogger(CloudWatchLoggingService.class);
    
    // CloudWatch log groups
    private static final String USER_EVENTS_LOG_GROUP = "/aws/lambda/user-events";
    private static final String API_REQUESTS_LOG_GROUP = "/aws/lambda/api-requests";
    private static final String ERROR_LOG_GROUP = "/aws/lambda/errors";
    private static final String PERFORMANCE_LOG_GROUP = "/aws/lambda/performance";
    
    // Metrics tracking
    private final Map<String, Long> logCounts = new ConcurrentHashMap<>();
    private final Map<String, Double> performanceMetrics = new ConcurrentHashMap<>();
    
    /**
     * Log user event to CloudWatch
     */
    public CompletableFuture<Boolean> logUserEvent(UserEvent event, String eventId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Logging user event to CloudWatch: {} for user: {}", event.getEventType(), event.getUserId());
                
                Map<String, Object> logEntry = createUserEventLogEntry(event, eventId);
                
                boolean success = sendToCloudWatch(USER_EVENTS_LOG_GROUP, logEntry);
                
                if (success) {
                    incrementLogCount("user_events");
                    logger.debug("Successfully logged user event to CloudWatch: {}", eventId);
                } else {
                    logger.error("Failed to log user event to CloudWatch: {}", eventId);
                }
                
                return success;
                
            } catch (Exception e) {
                logger.error("Error logging user event to CloudWatch: {}", e.getMessage(), e);
                return false;
            }
        });
    }
    
    /**
     * Log API request to CloudWatch
     */
    public CompletableFuture<Boolean> logApiRequest(String method, String endpoint, int statusCode, 
                                                   long responseTime, String userId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Logging API request to CloudWatch: {} {} - {}", method, endpoint, statusCode);
                
                Map<String, Object> logEntry = createApiRequestLogEntry(method, endpoint, statusCode, responseTime, userId);
                
                boolean success = sendToCloudWatch(API_REQUESTS_LOG_GROUP, logEntry);
                
                if (success) {
                    incrementLogCount("api_requests");
                    updatePerformanceMetric("api_response_time", responseTime);
                    logger.debug("Successfully logged API request to CloudWatch: {} {}", method, endpoint);
                } else {
                    logger.error("Failed to log API request to CloudWatch: {} {}", method, endpoint);
                }
                
                return success;
                
            } catch (Exception e) {
                logger.error("Error logging API request to CloudWatch: {}", e.getMessage(), e);
                return false;
            }
        });
    }
    
    /**
     * Log error to CloudWatch
     */
    public CompletableFuture<Boolean> logError(String errorType, String errorMessage, String stackTrace, 
                                              String userId, String sessionId, Map<String, Object> context) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Logging error to CloudWatch: {} for user: {}", errorType, userId);
                
                Map<String, Object> logEntry = createErrorLogEntry(errorType, errorMessage, stackTrace, 
                                                                  userId, sessionId, context);
                
                boolean success = sendToCloudWatch(ERROR_LOG_GROUP, logEntry);
                
                if (success) {
                    incrementLogCount("errors");
                    logger.debug("Successfully logged error to CloudWatch: {}", errorType);
                } else {
                    logger.error("Failed to log error to CloudWatch: {}", errorType);
                }
                
                return success;
                
            } catch (Exception e) {
                logger.error("Error logging error to CloudWatch: {}", e.getMessage(), e);
                return false;
            }
        });
    }
    
    /**
     * Log performance metrics to CloudWatch
     */
    public CompletableFuture<Boolean> logPerformanceMetrics(String operation, long duration, 
                                                           Map<String, Object> metrics) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Logging performance metrics to CloudWatch: {} - {}ms", operation, duration);
                
                Map<String, Object> logEntry = createPerformanceLogEntry(operation, duration, metrics);
                
                boolean success = sendToCloudWatch(PERFORMANCE_LOG_GROUP, logEntry);
                
                if (success) {
                    incrementLogCount("performance");
                    updatePerformanceMetric(operation + "_duration", duration);
                    logger.debug("Successfully logged performance metrics to CloudWatch: {}", operation);
                } else {
                    logger.error("Failed to log performance metrics to CloudWatch: {}", operation);
                }
                
                return success;
                
            } catch (Exception e) {
                logger.error("Error logging performance metrics to CloudWatch: {}", e.getMessage(), e);
                return false;
            }
        });
    }
    
    /**
     * Log batch events to CloudWatch
     */
    public CompletableFuture<Map<String, Boolean>> logBatchEvents(List<UserEvent> events, List<String> eventIds) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Logging batch of {} events to CloudWatch", events.size());
            
            Map<String, Boolean> results = new HashMap<>();
            
            for (int i = 0; i < events.size() && i < eventIds.size(); i++) {
                UserEvent event = events.get(i);
                String eventId = eventIds.get(i);
                
                try {
                    Map<String, Object> logEntry = createUserEventLogEntry(event, eventId);
                    boolean success = sendToCloudWatch(USER_EVENTS_LOG_GROUP, logEntry);
                    results.put(eventId, success);
                    
                    if (success) {
                        incrementLogCount("user_events");
                    }
                    
                } catch (Exception e) {
                    logger.error("Error in batch CloudWatch logging for event {}: {}", eventId, e.getMessage(), e);
                    results.put(eventId, false);
                }
            }
            
            long successCount = results.values().stream().mapToLong(success -> success ? 1 : 0).sum();
            logger.info("CloudWatch batch logging completed: {}/{} events successful", successCount, events.size());
            
            return results;
        });
    }
    
    /**
     * Create user event log entry
     */
    private Map<String, Object> createUserEventLogEntry(UserEvent event, String eventId) {
        Map<String, Object> logEntry = new HashMap<>();
        
        // Standard fields
        logEntry.put("timestamp", formatTimestamp(event.getTimestamp()));
        logEntry.put("eventId", eventId);
        logEntry.put("eventType", event.getEventType());
        logEntry.put("userId", event.getUserId());
        logEntry.put("sessionId", event.getSessionId());
        logEntry.put("source", "user-journey-analytics");
        logEntry.put("logLevel", "INFO");
        
        // Event data
        if (event.getEventData() != null) {
            Map<String, Object> eventData = new HashMap<>();
            if (event.getEventData().getFeature() != null) {
                eventData.put("feature", event.getEventData().getFeature());
            }
            if (event.getEventData().getVideoId() != null) {
                eventData.put("videoId", event.getEventData().getVideoId());
            }
            if (event.getEventData().getDuration() != null) {
                eventData.put("duration", event.getEventData().getDuration());
            }
            if (event.getEventData().getCompletionRate() != null) {
                eventData.put("completionRate", event.getEventData().getCompletionRate());
            }
            if (event.getEventData().getAttemptCount() != null) {
                eventData.put("attemptCount", event.getEventData().getAttemptCount());
            }
            if (event.getEventData().getErrorType() != null) {
                eventData.put("errorType", event.getEventData().getErrorType());
            }
            
            if (!eventData.isEmpty()) {
                logEntry.put("eventData", eventData);
            }
        }
        
        // Device info
        if (event.getDeviceInfo() != null) {
            Map<String, Object> deviceInfo = new HashMap<>();
            if (event.getDeviceInfo().getPlatform() != null) {
                deviceInfo.put("platform", event.getDeviceInfo().getPlatform());
            }
            if (event.getDeviceInfo().getAppVersion() != null) {
                deviceInfo.put("appVersion", event.getDeviceInfo().getAppVersion());
            }
            if (event.getDeviceInfo().getDeviceModel() != null) {
                deviceInfo.put("deviceModel", event.getDeviceInfo().getDeviceModel());
            }
            
            if (!deviceInfo.isEmpty()) {
                logEntry.put("deviceInfo", deviceInfo);
            }
        }
        
        // User context
        if (event.getUserContext() != null) {
            Map<String, Object> userContext = new HashMap<>();
            if (event.getUserContext().getUserSegment() != null) {
                userContext.put("userSegment", event.getUserContext().getUserSegment());
            }
            if (event.getUserContext().getSessionStage() != null) {
                userContext.put("sessionStage", event.getUserContext().getSessionStage());
            }
            
            if (!userContext.isEmpty()) {
                logEntry.put("userContext", userContext);
            }
        }
        
        return logEntry;
    }
    
    /**
     * Create API request log entry
     */
    private Map<String, Object> createApiRequestLogEntry(String method, String endpoint, int statusCode, 
                                                        long responseTime, String userId) {
        Map<String, Object> logEntry = new HashMap<>();
        
        logEntry.put("timestamp", formatTimestamp(System.currentTimeMillis()));
        logEntry.put("requestId", UUID.randomUUID().toString());
        logEntry.put("method", method);
        logEntry.put("endpoint", endpoint);
        logEntry.put("statusCode", statusCode);
        logEntry.put("responseTime", responseTime);
        logEntry.put("userId", userId);
        logEntry.put("source", "api-gateway");
        logEntry.put("logLevel", statusCode >= 400 ? "ERROR" : "INFO");
        
        return logEntry;
    }
    
    /**
     * Create error log entry
     */
    private Map<String, Object> createErrorLogEntry(String errorType, String errorMessage, String stackTrace,
                                                   String userId, String sessionId, Map<String, Object> context) {
        Map<String, Object> logEntry = new HashMap<>();
        
        logEntry.put("timestamp", formatTimestamp(System.currentTimeMillis()));
        logEntry.put("errorId", UUID.randomUUID().toString());
        logEntry.put("errorType", errorType);
        logEntry.put("errorMessage", errorMessage);
        logEntry.put("stackTrace", stackTrace);
        logEntry.put("userId", userId);
        logEntry.put("sessionId", sessionId);
        logEntry.put("source", "error-handler");
        logEntry.put("logLevel", "ERROR");
        
        if (context != null && !context.isEmpty()) {
            logEntry.put("context", context);
        }
        
        return logEntry;
    }
    
    /**
     * Create performance log entry
     */
    private Map<String, Object> createPerformanceLogEntry(String operation, long duration, 
                                                         Map<String, Object> metrics) {
        Map<String, Object> logEntry = new HashMap<>();
        
        logEntry.put("timestamp", formatTimestamp(System.currentTimeMillis()));
        logEntry.put("performanceId", UUID.randomUUID().toString());
        logEntry.put("operation", operation);
        logEntry.put("duration", duration);
        logEntry.put("source", "performance-monitor");
        logEntry.put("logLevel", "INFO");
        
        if (metrics != null && !metrics.isEmpty()) {
            logEntry.put("metrics", metrics);
        }
        
        return logEntry;
    }
    
    /**
     * Send log entry to CloudWatch (simulated)
     */
    private boolean sendToCloudWatch(String logGroup, Map<String, Object> logEntry) {
        try {
            // Simulate network delay
            Thread.sleep(10 + (int) (Math.random() * 30));
            
            // Simulate 99% success rate
            boolean success = Math.random() < 0.99;
            
            if (success) {
                logger.debug("CloudWatch Log Sent to {}: {}", logGroup, logEntry.get("timestamp"));
            } else {
                logger.warn("CloudWatch Log Failed for {}: {}", logGroup, logEntry.get("timestamp"));
            }
            
            return success;
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
    
    /**
     * Format timestamp for CloudWatch
     */
    private String formatTimestamp(long timestamp) {
        return Instant.ofEpochMilli(timestamp)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ISO_INSTANT);
    }
    
    /**
     * Increment log count
     */
    private void incrementLogCount(String logType) {
        logCounts.merge(logType, 1L, Long::sum);
    }
    
    /**
     * Update performance metric
     */
    private void updatePerformanceMetric(String metricName, double value) {
        performanceMetrics.put(metricName, value);
    }
    
    /**
     * Get CloudWatch logging statistics
     */
    public Map<String, Object> getLoggingStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        stats.put("logCounts", new HashMap<>(logCounts));
        stats.put("performanceMetrics", new HashMap<>(performanceMetrics));
        stats.put("totalLogs", logCounts.values().stream().mapToLong(Long::longValue).sum());
        stats.put("lastLogTime", System.currentTimeMillis());
        stats.put("loggingStatus", "active");
        
        // Calculate success rates (simulated)
        Map<String, Double> successRates = new HashMap<>();
        for (String logType : logCounts.keySet()) {
            successRates.put(logType, 0.99 + (Math.random() * 0.009)); // 99-99.9%
        }
        stats.put("successRates", successRates);
        
        return stats;
    }
    
    /**
     * Clear statistics (for testing/reset purposes)
     */
    public void clearStatistics() {
        logCounts.clear();
        performanceMetrics.clear();
        logger.info("CloudWatch logging statistics cleared");
    }
}