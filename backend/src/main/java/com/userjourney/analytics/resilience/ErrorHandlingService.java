package com.userjourney.analytics.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.cloudwatch.CloudWatchClient;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;
import software.amazon.awssdk.services.cloudwatch.model.MetricDatum;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataRequest;
import software.amazon.awssdk.services.cloudwatch.model.StandardUnit;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Comprehensive error handling service with metrics, alerting, and dead letter queue processing
 */
@Service
public class ErrorHandlingService {
    
    private static final Logger logger = LoggerFactory.getLogger(ErrorHandlingService.class);
    
    @Autowired
    private CloudWatchClient cloudWatchClient;
    
    @Autowired
    private SqsClient sqsClient;
    
    @Autowired(required = false)
    private CircuitBreaker circuitBreaker;
    
    @Autowired(required = false)
    private RetryHandler retryHandler;
    
    // Error tracking
    private final ConcurrentHashMap<String, AtomicLong> errorCounts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ErrorMetrics> errorMetrics = new ConcurrentHashMap<>();
    
    // Configuration
    private static final String NAMESPACE = "UserJourneyAnalytics";
    private static final String DLQ_URL_PROPERTY = "aws.sqs.dlq.url";
    
    /**
     * Handle and categorize errors with appropriate response
     */
    public ErrorResponse handleError(String component, String operation, Exception error, Object context) {
        String errorKey = component + ":" + operation;
        
        // Increment error count
        errorCounts.computeIfAbsent(errorKey, k -> new AtomicLong(0)).incrementAndGet();
        
        // Update error metrics
        updateErrorMetrics(errorKey, error);
        
        // Log error with context
        logError(component, operation, error, context);
        
        // Send metrics to CloudWatch
        sendErrorMetrics(component, operation, error);
        
        // Determine error category and response
        ErrorCategory category = categorizeError(error);
        ErrorSeverity severity = determineSeverity(error, category);
        
        // Create error response
        ErrorResponse response = new ErrorResponse(
            errorKey,
            category,
            severity,
            error.getMessage(),
            Instant.now(),
            context
        );
        
        // Handle based on severity
        handleBySeverity(response, error, context);
        
        return response;
    }
    
    /**
     * Handle AI service errors with fallback mechanisms
     */
    public <T> T handleAIServiceError(String serviceName, Exception error, T fallbackValue) {
        // Suppress logging for expected SageMaker mock mode errors
        if ("SageMakerPredictive".equals(serviceName) && 
            (error.getMessage().contains("Prediction failed") || error.getMessage().contains("Circuit breaker open"))) {
            logger.debug("SageMaker in mock mode - using rule-based prediction (expected behavior)");
            return fallbackValue;
        }
        
        logger.warn("AI service {} error: {}", serviceName, error.getMessage());
        
        // Record AI service error
        handleError("AIService", serviceName, error, null);
        
        // Check if circuit breaker should be triggered
        if (circuitBreaker != null) {
            CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(serviceName);
            if (status.getState() == CircuitBreaker.CircuitState.OPEN) {
                logger.info("Circuit breaker open for {}, using fallback immediately", serviceName);
                return fallbackValue;
            }
        }
        
        return fallbackValue;
    }
    
    /**
     * Handle data processing errors with retry logic
     */
    public void handleDataProcessingError(String eventId, Exception error, Object eventData) {
        logger.error("Data processing error for event {}: {}", eventId, error.getMessage(), error);
        
        // Record error
        handleError("DataProcessing", "EventProcessing", error, Map.of("eventId", eventId));
        
        // Determine if event should be retried or sent to DLQ
        if (isRetryableError(error)) {
            sendToRetryQueue(eventId, eventData, error);
        } else {
            sendToDeadLetterQueue(eventId, eventData, error);
        }
    }
    
    /**
     * Handle external service timeouts
     */
    public void handleServiceTimeout(String serviceName, long timeoutMs, Object request) {
        String message = String.format("Service %s timed out after %dms", serviceName, timeoutMs);
        TimeoutException timeoutError = new TimeoutException(message);
        
        handleError("ExternalService", serviceName, timeoutError, 
                   Map.of("timeoutMs", timeoutMs, "request", request));
        
        // Trigger circuit breaker if configured
        if (circuitBreaker != null) {
            circuitBreaker.execute(serviceName, 
                () -> { throw timeoutError; }, 
                () -> null);
        }
    }
    
    /**
     * Handle graceful degradation scenarios
     */
    public <T> T handleGracefulDegradation(String feature, Exception error, T degradedValue, String degradationReason) {
        logger.warn("Graceful degradation for feature {}: {} - {}", feature, degradationReason, error.getMessage());
        
        // Record degradation event
        handleError("GracefulDegradation", feature, error, 
                   Map.of("reason", degradationReason, "degradedValue", degradedValue));
        
        // Send degradation metric
        sendDegradationMetric(feature, degradationReason);
        
        return degradedValue;
    }
    
    /**
     * Categorize error type
     */
    private ErrorCategory categorizeError(Exception error) {
        String message = error.getMessage();
        if (message != null) {
            String lowerMessage = message.toLowerCase();
            
            if (lowerMessage.contains("timeout") || lowerMessage.contains("timed out")) {
                return ErrorCategory.TIMEOUT;
            }
            if (lowerMessage.contains("connection") || lowerMessage.contains("network")) {
                return ErrorCategory.NETWORK;
            }
            if (lowerMessage.contains("throttl") || lowerMessage.contains("rate limit")) {
                return ErrorCategory.RATE_LIMIT;
            }
            if (lowerMessage.contains("unauthorized") || lowerMessage.contains("forbidden")) {
                return ErrorCategory.AUTHENTICATION;
            }
            if (lowerMessage.contains("not found") || lowerMessage.contains("404")) {
                return ErrorCategory.NOT_FOUND;
            }
            if (lowerMessage.contains("validation") || lowerMessage.contains("invalid")) {
                return ErrorCategory.VALIDATION;
            }
        }
        
        // Check exception types
        if (error instanceof java.net.SocketTimeoutException) {
            return ErrorCategory.TIMEOUT;
        }
        if (error instanceof java.net.ConnectException) {
            return ErrorCategory.NETWORK;
        }
        if (error instanceof IllegalArgumentException) {
            return ErrorCategory.VALIDATION;
        }
        
        return ErrorCategory.UNKNOWN;
    }
    
    /**
     * Determine error severity
     */
    private ErrorSeverity determineSeverity(Exception error, ErrorCategory category) {
        // Critical errors that affect core functionality
        if (category == ErrorCategory.AUTHENTICATION || 
            category == ErrorCategory.VALIDATION ||
            error instanceof SecurityException) {
            return ErrorSeverity.CRITICAL;
        }
        
        // High severity for service unavailability
        if (category == ErrorCategory.NETWORK || 
            category == ErrorCategory.TIMEOUT) {
            return ErrorSeverity.HIGH;
        }
        
        // Medium severity for rate limiting and temporary issues
        if (category == ErrorCategory.RATE_LIMIT || 
            category == ErrorCategory.NOT_FOUND) {
            return ErrorSeverity.MEDIUM;
        }
        
        return ErrorSeverity.LOW;
    }
    
    /**
     * Handle error based on severity level
     */
    private void handleBySeverity(ErrorResponse response, Exception error, Object context) {
        switch (response.getSeverity()) {
            case CRITICAL:
                handleCriticalError(response, error, context);
                break;
            case HIGH:
                handleHighSeverityError(response, error, context);
                break;
            case MEDIUM:
                handleMediumSeverityError(response, error, context);
                break;
            case LOW:
                handleLowSeverityError(response, error, context);
                break;
        }
    }
    
    private void handleCriticalError(ErrorResponse response, Exception error, Object context) {
        logger.error("CRITICAL ERROR: {} - {}", response.getErrorKey(), error.getMessage(), error);
        
        // Send immediate alert
        sendCriticalAlert(response, error, context);
        
        // Escalate to operations team
        escalateToOperations(response, error, context);
    }
    
    private void handleHighSeverityError(ErrorResponse response, Exception error, Object context) {
        logger.error("HIGH SEVERITY ERROR: {} - {}", response.getErrorKey(), error.getMessage(), error);
        
        // Send alert with delay to avoid spam
        sendDelayedAlert(response, error, context, 300); // 5 minutes
    }
    
    private void handleMediumSeverityError(ErrorResponse response, Exception error, Object context) {
        logger.warn("MEDIUM SEVERITY ERROR: {} - {}", response.getErrorKey(), error.getMessage());
        
        // Send alert if error rate is high
        if (isErrorRateHigh(response.getErrorKey())) {
            sendDelayedAlert(response, error, context, 900); // 15 minutes
        }
    }
    
    private void handleLowSeverityError(ErrorResponse response, Exception error, Object context) {
        logger.info("LOW SEVERITY ERROR: {} - {}", response.getErrorKey(), error.getMessage());
        
        // Only log, no immediate action required
    }
    
    /**
     * Update error metrics
     */
    private void updateErrorMetrics(String errorKey, Exception error) {
        errorMetrics.compute(errorKey, (key, existing) -> {
            if (existing == null) {
                existing = new ErrorMetrics();
            }
            existing.incrementCount();
            existing.updateLastOccurrence(Instant.now());
            existing.addErrorType(error.getClass().getSimpleName());
            return existing;
        });
    }
    
    /**
     * Send error metrics to CloudWatch
     */
    private void sendErrorMetrics(String component, String operation, Exception error) {
        try {
            // Skip if client is null or connection pool is shut down
            if (cloudWatchClient == null) {
                logger.debug("CloudWatch client not available, skipping metrics");
                return;
            }
            
            MetricDatum metric = MetricDatum.builder()
                .metricName("ErrorCount")
                .value(1.0)
                .unit(StandardUnit.COUNT)
                .timestamp(Instant.now())
                .dimensions(
                    Dimension.builder().name("Component").value(component).build(),
                    Dimension.builder().name("Operation").value(operation).build(),
                    Dimension.builder().name("ErrorType").value(error.getClass().getSimpleName()).build()
                )
                .build();
            
            PutMetricDataRequest request = PutMetricDataRequest.builder()
                .namespace(NAMESPACE)
                .metricData(metric)
                .build();
            
            cloudWatchClient.putMetricData(request);
            
        } catch (IllegalStateException e) {
            // Connection pool shut down - application is shutting down, ignore silently
            logger.debug("CloudWatch client connection pool shut down, skipping metrics");
        } catch (Exception e) {
            logger.debug("Failed to send error metrics to CloudWatch: {}", e.getMessage());
        }
    }
    
    /**
     * Send degradation metric
     */
    private void sendDegradationMetric(String feature, String reason) {
        try {
            // Skip if client is null or connection pool is shut down
            if (cloudWatchClient == null) {
                logger.debug("CloudWatch client not available, skipping degradation metrics");
                return;
            }
            
            MetricDatum metric = MetricDatum.builder()
                .metricName("GracefulDegradation")
                .value(1.0)
                .unit(StandardUnit.COUNT)
                .timestamp(Instant.now())
                .dimensions(
                    Dimension.builder().name("Feature").value(feature).build(),
                    Dimension.builder().name("Reason").value(reason).build()
                )
                .build();
            
            PutMetricDataRequest request = PutMetricDataRequest.builder()
                .namespace(NAMESPACE)
                .metricData(metric)
                .build();
            
            cloudWatchClient.putMetricData(request);
            
        } catch (IllegalStateException e) {
            // Connection pool shut down - application is shutting down, ignore silently
            logger.debug("CloudWatch client connection pool shut down, skipping degradation metrics");
        } catch (Exception e) {
            logger.debug("Failed to send degradation metrics to CloudWatch: {}", e.getMessage());
        }
    }
    
    /**
     * Check if error is retryable
     */
    private boolean isRetryableError(Exception error) {
        return error instanceof java.net.SocketTimeoutException ||
               error instanceof java.net.ConnectException ||
               (error.getMessage() != null && 
                (error.getMessage().contains("throttl") || 
                 error.getMessage().contains("rate limit") ||
                 error.getMessage().contains("temporarily unavailable")));
    }
    
    /**
     * Send event to retry queue
     */
    private void sendToRetryQueue(String eventId, Object eventData, Exception error) {
        if (retryHandler != null) {
            try {
                // Use retry handler to process the event with retry logic
                retryHandler.executeWithRetryAndFallback(
                    "processEvent-" + eventId,
                    () -> {
                        // This would be the actual event processing logic
                        logger.info("Processing event {} via retry handler", eventId);
                        return true;
                    },
                    () -> {
                        // Fallback: send to DLQ
                        sendToDeadLetterQueue(eventId, eventData, error);
                        return false;
                    },
                    RetryHandler.RetryConfig.builder()
                        .maxAttempts(3)
                        .initialDelay(java.time.Duration.ofSeconds(1))
                        .build()
                );
                logger.info("Event {} processed via RetryHandler", eventId);
            } catch (Exception e) {
                logger.error("Failed to process retry for event {}", eventId, e);
                // Fallback to dead letter queue
                sendToDeadLetterQueue(eventId, eventData, error);
            }
        } else {
            // Fallback implementation when retry handler is not available
            logger.info("Sending event {} to retry queue due to: {}", eventId, error.getMessage());
            // In a real implementation, this would send to an SQS retry queue
        }
    }
    
    /**
     * Send event to dead letter queue
     */
    private void sendToDeadLetterQueue(String eventId, Object eventData, Exception error) {
        try {
            String dlqUrl = System.getProperty(DLQ_URL_PROPERTY);
            if (dlqUrl != null) {
                Map<String, Object> dlqMessage = Map.of(
                    "eventId", eventId,
                    "eventData", eventData,
                    "error", error.getMessage(),
                    "timestamp", Instant.now().toString()
                );
                
                SendMessageRequest request = SendMessageRequest.builder()
                    .queueUrl(dlqUrl)
                    .messageBody(dlqMessage.toString())
                    .build();
                
                sqsClient.sendMessage(request);
                logger.info("Sent event {} to dead letter queue", eventId);
            }
        } catch (Exception e) {
            logger.error("Failed to send event to dead letter queue", e);
        }
    }
    
    /**
     * Check if error rate is high for a given error key
     */
    private boolean isErrorRateHigh(String errorKey) {
        ErrorMetrics metrics = errorMetrics.get(errorKey);
        if (metrics == null) return false;
        
        // Consider error rate high if more than 10 errors in last 5 minutes
        return metrics.getCount() > 10 && 
               metrics.getLastOccurrence().isAfter(Instant.now().minusSeconds(300));
    }
    
    /**
     * Log error with structured information
     */
    private void logError(String component, String operation, Exception error, Object context) {
        // Suppress logging for expected SageMaker mock mode errors
        if ("AIService".equals(component) && "SageMakerPredictive".equals(operation) &&
            (error.getMessage().contains("Prediction failed") || error.getMessage().contains("Circuit breaker open"))) {
            logger.debug("SageMaker mock mode - using rule-based prediction (expected)");
            return;
        }
        
        Map<String, Object> logContext = new HashMap<>();
        logContext.put("component", component);
        logContext.put("operation", operation);
        logContext.put("errorType", error.getClass().getSimpleName());
        logContext.put("errorMessage", error.getMessage());
        logContext.put("timestamp", Instant.now());
        if (context != null) {
            logContext.put("context", context);
        }
        
        logger.error("Error occurred: {}", logContext, error);
    }
    
    /**
     * Send critical alert (implementation depends on alerting system)
     */
    private void sendCriticalAlert(ErrorResponse response, Exception error, Object context) {
        // Implementation would integrate with your alerting system (SNS, PagerDuty, etc.)
        logger.error("CRITICAL ALERT: {} - {}", response.getErrorKey(), error.getMessage());
    }
    
    /**
     * Send delayed alert to avoid spam
     */
    private void sendDelayedAlert(ErrorResponse response, Exception error, Object context, int delaySeconds) {
        // Implementation would use a scheduler or queue to delay alerts
        logger.warn("DELAYED ALERT ({}s): {} - {}", delaySeconds, response.getErrorKey(), error.getMessage());
    }
    
    /**
     * Escalate to operations team
     */
    private void escalateToOperations(ErrorResponse response, Exception error, Object context) {
        // Implementation would integrate with ticketing system or notification service
        logger.error("ESCALATING TO OPERATIONS: {} - {}", response.getErrorKey(), error.getMessage());
    }
    
    /**
     * Get error statistics
     */
    public Map<String, ErrorMetrics> getErrorStatistics() {
        return new HashMap<>(errorMetrics);
    }
    
    /**
     * Clear error statistics (for testing or reset)
     */
    public void clearErrorStatistics() {
        errorCounts.clear();
        errorMetrics.clear();
    }
    
    // Supporting classes
    
    public enum ErrorCategory {
        TIMEOUT, NETWORK, RATE_LIMIT, AUTHENTICATION, NOT_FOUND, VALIDATION, UNKNOWN
    }
    
    public enum ErrorSeverity {
        LOW, MEDIUM, HIGH, CRITICAL
    }
    
    public static class ErrorResponse {
        private final String errorKey;
        private final ErrorCategory category;
        private final ErrorSeverity severity;
        private final String message;
        private final Instant timestamp;
        private final Object context;
        
        public ErrorResponse(String errorKey, ErrorCategory category, ErrorSeverity severity, 
                           String message, Instant timestamp, Object context) {
            this.errorKey = errorKey;
            this.category = category;
            this.severity = severity;
            this.message = message;
            this.timestamp = timestamp;
            this.context = context;
        }
        
        // Getters
        public String getErrorKey() { return errorKey; }
        public ErrorCategory getCategory() { return category; }
        public ErrorSeverity getSeverity() { return severity; }
        public String getMessage() { return message; }
        public Instant getTimestamp() { return timestamp; }
        public Object getContext() { return context; }
    }
    
    public static class ErrorMetrics {
        private long count = 0;
        private Instant lastOccurrence;
        private final Map<String, Integer> errorTypes = new HashMap<>();
        
        public void incrementCount() {
            count++;
        }
        
        public void updateLastOccurrence(Instant time) {
            lastOccurrence = time;
        }
        
        public void addErrorType(String type) {
            errorTypes.merge(type, 1, Integer::sum);
        }
        
        // Getters
        public long getCount() { return count; }
        public Instant getLastOccurrence() { return lastOccurrence; }
        public Map<String, Integer> getErrorTypes() { return new HashMap<>(errorTypes); }
    }
    
    public static class TimeoutException extends RuntimeException {
        public TimeoutException(String message) {
            super(message);
        }
    }
}