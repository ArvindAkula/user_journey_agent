package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Service for structured logging with correlation IDs and context information
 */
@Service
public class StructuredLoggingService {

    private static final Logger logger = LoggerFactory.getLogger(StructuredLoggingService.class);

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Log business event with structured data
     */
    public void logBusinessEvent(String eventType, String message, Map<String, Object> context) {
        Map<String, Object> logEntry = createBaseLogEntry("BUSINESS_EVENT", message);
        logEntry.put("eventType", eventType);
        if (context != null) {
            logEntry.put("context", context);
        }
        
        logger.info("BUSINESS_EVENT: {}", formatLogEntry(logEntry));
    }

    /**
     * Log performance metric with timing information
     */
    public void logPerformanceMetric(String operation, long durationMs, boolean success, Map<String, Object> metadata) {
        Map<String, Object> logEntry = createBaseLogEntry("PERFORMANCE_METRIC", 
            String.format("Operation %s completed in %dms", operation, durationMs));
        
        logEntry.put("operation", operation);
        logEntry.put("durationMs", durationMs);
        logEntry.put("success", success);
        logEntry.put("performanceCategory", categorizePerformance(durationMs));
        
        if (metadata != null) {
            logEntry.put("metadata", metadata);
        }
        
        if (success) {
            logger.info("PERFORMANCE_METRIC: {}", formatLogEntry(logEntry));
        } else {
            logger.warn("PERFORMANCE_METRIC: {}", formatLogEntry(logEntry));
        }
    }

    /**
     * Log security event
     */
    public void logSecurityEvent(String eventType, String message, String userId, Map<String, Object> securityContext) {
        Map<String, Object> logEntry = createBaseLogEntry("SECURITY_EVENT", message);
        logEntry.put("eventType", eventType);
        logEntry.put("userId", userId);
        logEntry.put("securityLevel", "HIGH");
        
        if (securityContext != null) {
            logEntry.put("securityContext", securityContext);
        }
        
        logger.warn("SECURITY_EVENT: {}", formatLogEntry(logEntry));
    }

    /**
     * Log error with full context
     */
    public void logError(String component, String operation, Exception error, Map<String, Object> context) {
        Map<String, Object> logEntry = createBaseLogEntry("ERROR", error.getMessage());
        logEntry.put("component", component);
        logEntry.put("operation", operation);
        logEntry.put("errorType", error.getClass().getSimpleName());
        logEntry.put("errorMessage", error.getMessage());
        
        if (context != null) {
            logEntry.put("context", context);
        }
        
        // Add stack trace for debugging (but not in production logs)
        String activeProfile = System.getProperty("spring.profiles.active", "");
        if (!activeProfile.equals("production")) {
            logEntry.put("stackTrace", getStackTraceString(error));
        }
        
        logger.error("ERROR: {}", formatLogEntry(logEntry), error);
    }

    /**
     * Log user journey event
     */
    public void logUserJourneyEvent(String userId, String sessionId, String eventType, 
                                  String feature, Map<String, Object> eventData) {
        Map<String, Object> logEntry = createBaseLogEntry("USER_JOURNEY", 
            String.format("User %s performed %s on %s", userId, eventType, feature));
        
        logEntry.put("userId", userId);
        logEntry.put("sessionId", sessionId);
        logEntry.put("eventType", eventType);
        logEntry.put("feature", feature);
        
        if (eventData != null) {
            logEntry.put("eventData", eventData);
        }
        
        logger.info("USER_JOURNEY: {}", formatLogEntry(logEntry));
    }

    /**
     * Log AI service interaction
     */
    public void logAIServiceInteraction(String service, String operation, long durationMs, 
                                      boolean success, Map<String, Object> aiContext) {
        Map<String, Object> logEntry = createBaseLogEntry("AI_SERVICE", 
            String.format("%s %s completed in %dms", service, operation, durationMs));
        
        logEntry.put("service", service);
        logEntry.put("operation", operation);
        logEntry.put("durationMs", durationMs);
        logEntry.put("success", success);
        logEntry.put("serviceCategory", "AI");
        
        if (aiContext != null) {
            logEntry.put("aiContext", aiContext);
        }
        
        if (success) {
            logger.info("AI_SERVICE: {}", formatLogEntry(logEntry));
        } else {
            logger.warn("AI_SERVICE: {}", formatLogEntry(logEntry));
        }
    }

    /**
     * Log circuit breaker event
     */
    public void logCircuitBreakerEvent(String serviceName, String state, String reason, 
                                     Map<String, Object> circuitBreakerContext) {
        Map<String, Object> logEntry = createBaseLogEntry("CIRCUIT_BREAKER", 
            String.format("Circuit breaker for %s changed to %s", serviceName, state));
        
        logEntry.put("serviceName", serviceName);
        logEntry.put("state", state);
        logEntry.put("reason", reason);
        logEntry.put("resilienceCategory", "CIRCUIT_BREAKER");
        
        if (circuitBreakerContext != null) {
            logEntry.put("circuitBreakerContext", circuitBreakerContext);
        }
        
        if ("OPEN".equals(state)) {
            logger.warn("CIRCUIT_BREAKER: {}", formatLogEntry(logEntry));
        } else {
            logger.info("CIRCUIT_BREAKER: {}", formatLogEntry(logEntry));
        }
    }

    /**
     * Log data processing event
     */
    public void logDataProcessingEvent(String eventId, String processingStage, boolean success, 
                                     long durationMs, Map<String, Object> processingContext) {
        Map<String, Object> logEntry = createBaseLogEntry("DATA_PROCESSING", 
            String.format("Event %s processed at stage %s in %dms", eventId, processingStage, durationMs));
        
        logEntry.put("eventId", eventId);
        logEntry.put("processingStage", processingStage);
        logEntry.put("success", success);
        logEntry.put("durationMs", durationMs);
        logEntry.put("dataCategory", "EVENT_PROCESSING");
        
        if (processingContext != null) {
            logEntry.put("processingContext", processingContext);
        }
        
        if (success) {
            logger.info("DATA_PROCESSING: {}", formatLogEntry(logEntry));
        } else {
            logger.error("DATA_PROCESSING: {}", formatLogEntry(logEntry));
        }
    }

    /**
     * Create base log entry with common fields
     */
    private Map<String, Object> createBaseLogEntry(String logType, String message) {
        Map<String, Object> logEntry = new HashMap<>();
        
        // Add timestamp
        logEntry.put("timestamp", Instant.now().toString());
        logEntry.put("logType", logType);
        logEntry.put("message", message);
        
        // Add correlation information from MDC
        String correlationId = MDC.get("correlationId");
        if (correlationId != null) {
            logEntry.put("correlationId", correlationId);
        }
        
        String requestId = MDC.get("requestId");
        if (requestId != null) {
            logEntry.put("requestId", requestId);
        }
        
        String userId = MDC.get("userId");
        if (userId != null) {
            logEntry.put("userId", userId);
        }
        
        String sessionId = MDC.get("sessionId");
        if (sessionId != null) {
            logEntry.put("sessionId", sessionId);
        }
        
        // Add application context
        logEntry.put("application", "user-journey-analytics");
        logEntry.put("environment", System.getProperty("spring.profiles.active", "unknown"));
        
        return logEntry;
    }

    /**
     * Format log entry as JSON string
     */
    private String formatLogEntry(Map<String, Object> logEntry) {
        try {
            return objectMapper.writeValueAsString(logEntry);
        } catch (Exception e) {
            // Fallback to simple string representation if JSON serialization fails
            return logEntry.toString();
        }
    }

    /**
     * Categorize performance based on duration
     */
    private String categorizePerformance(long durationMs) {
        if (durationMs < 100) {
            return "FAST";
        } else if (durationMs < 1000) {
            return "NORMAL";
        } else if (durationMs < 5000) {
            return "SLOW";
        } else {
            return "VERY_SLOW";
        }
    }

    /**
     * Get stack trace as string
     */
    private String getStackTraceString(Exception e) {
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }

    /**
     * Add context to current MDC
     */
    public void addContext(String key, String value) {
        if (key != null && value != null) {
            MDC.put(key, value);
        }
    }

    /**
     * Remove context from current MDC
     */
    public void removeContext(String key) {
        if (key != null) {
            MDC.remove(key);
        }
    }

    /**
     * Get current correlation ID
     */
    public String getCurrentCorrelationId() {
        return MDC.get("correlationId");
    }

    /**
     * Get current request ID
     */
    public String getCurrentRequestId() {
        return MDC.get("requestId");
    }
}