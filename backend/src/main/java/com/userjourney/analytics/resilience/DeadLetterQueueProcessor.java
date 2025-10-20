package com.userjourney.analytics.resilience;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Dead Letter Queue processor for handling failed events
 * Provides retry mechanisms and failure analysis
 */
@Component
public class DeadLetterQueueProcessor {
    
    private static final Logger logger = LoggerFactory.getLogger(DeadLetterQueueProcessor.class);
    
    @Autowired
    private SqsClient sqsClient;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Autowired
    private ErrorHandlingService errorHandlingService;
    
    @Value("${aws.sqs.dlq.url:}")
    private String dlqUrl;
    
    @Value("${aws.sqs.dlq.retry-queue.url:}")
    private String retryQueueUrl;
    
    @Value("${dlq.processing.enabled:true}")
    private boolean processingEnabled;
    
    @Value("${dlq.processing.batch-size:10}")
    private int batchSize;
    
    @Value("${dlq.max-retry-attempts:3}")
    private int maxRetryAttempts;
    
    // Statistics tracking
    private final AtomicLong processedMessages = new AtomicLong(0);
    private final AtomicLong retriedMessages = new AtomicLong(0);
    private final AtomicLong permanentFailures = new AtomicLong(0);
    private final ConcurrentHashMap<String, FailurePattern> failurePatterns = new ConcurrentHashMap<>();
    
    /**
     * Process dead letter queue messages periodically
     */
    @Scheduled(fixedDelayString = "${dlq.processing.interval:60000}") // Default: 1 minute
    public void processDLQMessages() {
        if (!processingEnabled || dlqUrl == null || dlqUrl.isEmpty()) {
            return;
        }
        
        // Skip if SQS client is not available
        if (sqsClient == null) {
            logger.debug("SQS client not available, skipping DLQ processing");
            return;
        }
        
        logger.debug("Processing DLQ messages from: {}", dlqUrl);
        
        try {
            ReceiveMessageRequest receiveRequest = ReceiveMessageRequest.builder()
                .queueUrl(dlqUrl)
                .maxNumberOfMessages(batchSize)
                .waitTimeSeconds(5)
                .messageAttributeNames("All")
                .build();
            
            ReceiveMessageResponse response = sqsClient.receiveMessage(receiveRequest);
            List<Message> messages = response.messages();
            
            if (!messages.isEmpty()) {
                logger.info("Processing {} DLQ messages", messages.size());
                
                for (Message message : messages) {
                    processMessage(message);
                }
            }
            
        } catch (IllegalStateException e) {
            // Connection pool shut down - application is shutting down, ignore silently
            logger.debug("SQS client connection pool shut down, skipping DLQ processing");
        } catch (Exception e) {
            logger.debug("Error processing DLQ messages: {}", e.getMessage());
            // Don't call errorHandlingService here as it might cause recursive errors
        }
    }
    
    /**
     * Process individual DLQ message
     */
    private void processMessage(Message message) {
        try {
            processedMessages.incrementAndGet();
            
            DLQMessage dlqMessage = parseDLQMessage(message);
            
            // Analyze failure pattern
            analyzeFailurePattern(dlqMessage);
            
            // Determine if message should be retried
            if (shouldRetryMessage(dlqMessage)) {
                retryMessage(dlqMessage, message);
            } else {
                handlePermanentFailure(dlqMessage, message);
            }
            
            // Delete message from DLQ after processing
            deleteMessage(message);
            
        } catch (Exception e) {
            logger.error("Error processing DLQ message: {}", message.messageId(), e);
            errorHandlingService.handleError("DLQProcessor", "processMessage", e, 
                Map.of("messageId", message.messageId()));
        }
    }
    
    /**
     * Parse DLQ message from SQS message
     */
    private DLQMessage parseDLQMessage(Message message) throws Exception {
        String body = message.body();
        Map<String, Object> messageData = objectMapper.readValue(body, Map.class);
        
        return DLQMessage.builder()
            .messageId(message.messageId())
            .originalEventId((String) messageData.get("eventId"))
            .eventData(messageData.get("eventData"))
            .errorMessage((String) messageData.get("error"))
            .timestamp(Instant.parse((String) messageData.get("timestamp")))
            .retryCount(getRetryCount(message))
            .failureReason((String) messageData.get("failureReason"))
            .build();
    }
    
    /**
     * Get retry count from message attributes
     */
    private int getRetryCount(Message message) {
        Map<String, MessageAttributeValue> attributes = message.messageAttributes();
        if (attributes.containsKey("RetryCount")) {
            return Integer.parseInt(attributes.get("RetryCount").stringValue());
        }
        return 0;
    }
    
    /**
     * Analyze failure patterns for insights
     */
    private void analyzeFailurePattern(DLQMessage dlqMessage) {
        String errorType = categorizeError(dlqMessage.getErrorMessage());
        
        failurePatterns.compute(errorType, (key, existing) -> {
            if (existing == null) {
                existing = new FailurePattern(errorType);
            }
            existing.incrementCount();
            existing.updateLastOccurrence(dlqMessage.getTimestamp());
            return existing;
        });
        
        // Log pattern if it's becoming frequent
        FailurePattern pattern = failurePatterns.get(errorType);
        if (pattern.getCount() % 10 == 0) { // Every 10 occurrences
            logger.warn("Frequent failure pattern detected: {} - {} occurrences", 
                       errorType, pattern.getCount());
        }
    }
    
    /**
     * Categorize error for pattern analysis
     */
    private String categorizeError(String errorMessage) {
        if (errorMessage == null) return "UNKNOWN";
        
        String lowerMessage = errorMessage.toLowerCase();
        
        if (lowerMessage.contains("timeout")) return "TIMEOUT";
        if (lowerMessage.contains("connection")) return "CONNECTION";
        if (lowerMessage.contains("throttl") || lowerMessage.contains("rate limit")) return "RATE_LIMIT";
        if (lowerMessage.contains("validation")) return "VALIDATION";
        if (lowerMessage.contains("authentication")) return "AUTH";
        if (lowerMessage.contains("not found")) return "NOT_FOUND";
        if (lowerMessage.contains("service unavailable")) return "SERVICE_UNAVAILABLE";
        
        return "OTHER";
    }
    
    /**
     * Determine if message should be retried
     */
    private boolean shouldRetryMessage(DLQMessage dlqMessage) {
        // Don't retry if max attempts reached
        if (dlqMessage.getRetryCount() >= maxRetryAttempts) {
            return false;
        }
        
        // Don't retry validation errors
        if (dlqMessage.getErrorMessage() != null && 
            dlqMessage.getErrorMessage().toLowerCase().contains("validation")) {
            return false;
        }
        
        // Don't retry very old messages (older than 24 hours)
        if (dlqMessage.getTimestamp().isBefore(Instant.now().minus(24, ChronoUnit.HOURS))) {
            return false;
        }
        
        // Retry transient errors
        String errorType = categorizeError(dlqMessage.getErrorMessage());
        return errorType.equals("TIMEOUT") || 
               errorType.equals("CONNECTION") || 
               errorType.equals("RATE_LIMIT") || 
               errorType.equals("SERVICE_UNAVAILABLE");
    }
    
    /**
     * Retry message by sending to retry queue
     */
    private void retryMessage(DLQMessage dlqMessage, Message originalMessage) {
        try {
            if (retryQueueUrl == null || retryQueueUrl.isEmpty()) {
                logger.warn("Retry queue URL not configured, cannot retry message: {}", 
                           dlqMessage.getMessageId());
                return;
            }
            
            // Create retry message with incremented retry count
            Map<String, Object> retryMessageData = Map.of(
                "eventId", dlqMessage.getOriginalEventId(),
                "eventData", dlqMessage.getEventData(),
                "error", dlqMessage.getErrorMessage(),
                "timestamp", dlqMessage.getTimestamp().toString(),
                "retryAttempt", dlqMessage.getRetryCount() + 1
            );
            
            // Calculate delay based on retry count (exponential backoff)
            int delaySeconds = calculateRetryDelay(dlqMessage.getRetryCount());
            
            SendMessageRequest retryRequest = SendMessageRequest.builder()
                .queueUrl(retryQueueUrl)
                .messageBody(objectMapper.writeValueAsString(retryMessageData))
                .delaySeconds(delaySeconds)
                .messageAttributes(Map.of(
                    "RetryCount", MessageAttributeValue.builder()
                        .stringValue(String.valueOf(dlqMessage.getRetryCount() + 1))
                        .dataType("Number")
                        .build(),
                    "OriginalEventId", MessageAttributeValue.builder()
                        .stringValue(dlqMessage.getOriginalEventId())
                        .dataType("String")
                        .build()
                ))
                .build();
            
            sqsClient.sendMessage(retryRequest);
            retriedMessages.incrementAndGet();
            
            logger.info("Retrying message {} (attempt {}) with {}s delay", 
                       dlqMessage.getOriginalEventId(), 
                       dlqMessage.getRetryCount() + 1, 
                       delaySeconds);
            
        } catch (Exception e) {
            logger.error("Failed to retry message: {}", dlqMessage.getMessageId(), e);
            errorHandlingService.handleError("DLQProcessor", "retryMessage", e, 
                Map.of("messageId", dlqMessage.getMessageId()));
        }
    }
    
    /**
     * Calculate retry delay with exponential backoff
     */
    private int calculateRetryDelay(int retryCount) {
        // Exponential backoff: 30s, 60s, 120s
        return Math.min(30 * (int) Math.pow(2, retryCount), 300); // Max 5 minutes
    }
    
    /**
     * Handle permanent failure
     */
    private void handlePermanentFailure(DLQMessage dlqMessage, Message originalMessage) {
        permanentFailures.incrementAndGet();
        
        logger.error("Permanent failure for message {}: {} (retry count: {})", 
                    dlqMessage.getOriginalEventId(), 
                    dlqMessage.getErrorMessage(), 
                    dlqMessage.getRetryCount());
        
        // Store permanent failure for analysis
        storePermanentFailure(dlqMessage);
        
        // Send alert for critical failures
        if (isCriticalFailure(dlqMessage)) {
            sendCriticalFailureAlert(dlqMessage);
        }
    }
    
    /**
     * Store permanent failure for analysis
     */
    private void storePermanentFailure(DLQMessage dlqMessage) {
        // Implementation would store in database or send to analytics system
        logger.info("Storing permanent failure record for event: {}", dlqMessage.getOriginalEventId());
    }
    
    /**
     * Check if failure is critical
     */
    private boolean isCriticalFailure(DLQMessage dlqMessage) {
        // Consider high-value user events as critical
        if (dlqMessage.getEventData() instanceof Map) {
            Map<String, Object> eventData = (Map<String, Object>) dlqMessage.getEventData();
            String eventType = (String) eventData.get("eventType");
            return "struggle_signal".equals(eventType) || "exit_risk_high".equals(eventType);
        }
        return false;
    }
    
    /**
     * Send critical failure alert
     */
    private void sendCriticalFailureAlert(DLQMessage dlqMessage) {
        logger.error("CRITICAL FAILURE ALERT: Event {} permanently failed after {} retries", 
                    dlqMessage.getOriginalEventId(), dlqMessage.getRetryCount());
        
        // Implementation would integrate with alerting system
        errorHandlingService.handleError("DLQProcessor", "criticalFailure", 
            new RuntimeException("Critical event permanently failed"), 
            Map.of("eventId", dlqMessage.getOriginalEventId(), 
                   "retryCount", dlqMessage.getRetryCount()));
    }
    
    /**
     * Delete message from DLQ
     */
    private void deleteMessage(Message message) {
        try {
            DeleteMessageRequest deleteRequest = DeleteMessageRequest.builder()
                .queueUrl(dlqUrl)
                .receiptHandle(message.receiptHandle())
                .build();
            
            sqsClient.deleteMessage(deleteRequest);
            
        } catch (Exception e) {
            logger.error("Failed to delete DLQ message: {}", message.messageId(), e);
        }
    }
    
    /**
     * Get DLQ processing statistics
     */
    public DLQStatistics getStatistics() {
        return new DLQStatistics(
            processedMessages.get(),
            retriedMessages.get(),
            permanentFailures.get(),
            new HashMap<>(failurePatterns)
        );
    }
    
    /**
     * Reset statistics (for testing)
     */
    public void resetStatistics() {
        processedMessages.set(0);
        retriedMessages.set(0);
        permanentFailures.set(0);
        failurePatterns.clear();
    }
    
    // Supporting classes
    
    public static class DLQMessage {
        private final String messageId;
        private final String originalEventId;
        private final Object eventData;
        private final String errorMessage;
        private final Instant timestamp;
        private final int retryCount;
        private final String failureReason;
        
        private DLQMessage(Builder builder) {
            this.messageId = builder.messageId;
            this.originalEventId = builder.originalEventId;
            this.eventData = builder.eventData;
            this.errorMessage = builder.errorMessage;
            this.timestamp = builder.timestamp;
            this.retryCount = builder.retryCount;
            this.failureReason = builder.failureReason;
        }
        
        public static Builder builder() {
            return new Builder();
        }
        
        // Getters
        public String getMessageId() { return messageId; }
        public String getOriginalEventId() { return originalEventId; }
        public Object getEventData() { return eventData; }
        public String getErrorMessage() { return errorMessage; }
        public Instant getTimestamp() { return timestamp; }
        public int getRetryCount() { return retryCount; }
        public String getFailureReason() { return failureReason; }
        
        public static class Builder {
            private String messageId;
            private String originalEventId;
            private Object eventData;
            private String errorMessage;
            private Instant timestamp;
            private int retryCount;
            private String failureReason;
            
            public Builder messageId(String messageId) {
                this.messageId = messageId;
                return this;
            }
            
            public Builder originalEventId(String originalEventId) {
                this.originalEventId = originalEventId;
                return this;
            }
            
            public Builder eventData(Object eventData) {
                this.eventData = eventData;
                return this;
            }
            
            public Builder errorMessage(String errorMessage) {
                this.errorMessage = errorMessage;
                return this;
            }
            
            public Builder timestamp(Instant timestamp) {
                this.timestamp = timestamp;
                return this;
            }
            
            public Builder retryCount(int retryCount) {
                this.retryCount = retryCount;
                return this;
            }
            
            public Builder failureReason(String failureReason) {
                this.failureReason = failureReason;
                return this;
            }
            
            public DLQMessage build() {
                return new DLQMessage(this);
            }
        }
    }
    
    public static class FailurePattern {
        private final String errorType;
        private long count = 0;
        private Instant lastOccurrence;
        
        public FailurePattern(String errorType) {
            this.errorType = errorType;
        }
        
        public void incrementCount() {
            count++;
        }
        
        public void updateLastOccurrence(Instant time) {
            lastOccurrence = time;
        }
        
        // Getters
        public String getErrorType() { return errorType; }
        public long getCount() { return count; }
        public Instant getLastOccurrence() { return lastOccurrence; }
    }
    
    public static class DLQStatistics {
        private final long processedMessages;
        private final long retriedMessages;
        private final long permanentFailures;
        private final Map<String, FailurePattern> failurePatterns;
        
        public DLQStatistics(long processedMessages, long retriedMessages, 
                           long permanentFailures, Map<String, FailurePattern> failurePatterns) {
            this.processedMessages = processedMessages;
            this.retriedMessages = retriedMessages;
            this.permanentFailures = permanentFailures;
            this.failurePatterns = failurePatterns;
        }
        
        // Getters
        public long getProcessedMessages() { return processedMessages; }
        public long getRetriedMessages() { return retriedMessages; }
        public long getPermanentFailures() { return permanentFailures; }
        public Map<String, FailurePattern> getFailurePatterns() { return failurePatterns; }
    }
}