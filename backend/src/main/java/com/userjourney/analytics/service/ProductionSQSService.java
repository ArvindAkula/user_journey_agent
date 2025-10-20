package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@Profile("production")
public class ProductionSQSService {

    private static final Logger logger = LoggerFactory.getLogger(ProductionSQSService.class);

    @Autowired
    private SqsClient sqsClient;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuditLogService auditLogService;

    @Value("${aws.sqs.dlq.url}")
    private String dlqUrl;

    @Value("${aws.sqs.retry-queue.url}")
    private String retryQueueUrl;

    private final ExecutorService executorService = Executors.newFixedThreadPool(5);

    /**
     * Send message to retry queue
     */
    public CompletableFuture<String> sendToRetryQueue(Map<String, Object> messageBody, int delaySeconds) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String messageJson = objectMapper.writeValueAsString(messageBody);

                SendMessageRequest request = SendMessageRequest.builder()
                    .queueUrl(retryQueueUrl)
                    .messageBody(messageJson)
                    .delaySeconds(delaySeconds)
                    .messageAttributes(Map.of(
                        "RetryCount", MessageAttributeValue.builder()
                            .stringValue(String.valueOf(messageBody.getOrDefault("retryCount", 0)))
                            .dataType("Number")
                            .build(),
                        "OriginalTimestamp", MessageAttributeValue.builder()
                            .stringValue(String.valueOf(System.currentTimeMillis()))
                            .dataType("Number")
                            .build()
                    ))
                    .build();

                SendMessageResponse response = sqsClient.sendMessage(request);

                logger.debug("Successfully sent message to retry queue: messageId={}", response.messageId());

                auditLogService.logDataAccess(
                    messageBody.getOrDefault("userId", "unknown").toString(),
                    "MESSAGE_SENT_TO_RETRY_QUEUE",
                    "sqs",
                    retryQueueUrl,
                    "system"
                );

                return response.messageId();

            } catch (Exception e) {
                logger.error("Failed to send message to retry queue: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to send message to retry queue", e);
            }
        }, executorService);
    }

    /**
     * Send message to dead letter queue
     */
    public CompletableFuture<String> sendToDeadLetterQueue(Map<String, Object> messageBody, String errorReason) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Add error information to message body
                Map<String, Object> dlqMessage = new HashMap<>(messageBody);
                dlqMessage.put("errorReason", errorReason);
                dlqMessage.put("failedAt", System.currentTimeMillis());
                dlqMessage.put("originalRetryCount", messageBody.getOrDefault("retryCount", 0));

                String messageJson = objectMapper.writeValueAsString(dlqMessage);

                SendMessageRequest request = SendMessageRequest.builder()
                    .queueUrl(dlqUrl)
                    .messageBody(messageJson)
                    .messageAttributes(Map.of(
                        "ErrorReason", MessageAttributeValue.builder()
                            .stringValue(errorReason)
                            .dataType("String")
                            .build(),
                        "FailedAt", MessageAttributeValue.builder()
                            .stringValue(String.valueOf(System.currentTimeMillis()))
                            .dataType("Number")
                            .build()
                    ))
                    .build();

                SendMessageResponse response = sqsClient.sendMessage(request);

                logger.warn("Sent message to dead letter queue: messageId={}, reason={}", 
                    response.messageId(), errorReason);

                auditLogService.logDataAccess(
                    messageBody.getOrDefault("userId", "unknown").toString(),
                    "MESSAGE_SENT_TO_DLQ",
                    "sqs",
                    dlqUrl,
                    "system"
                );

                return response.messageId();

            } catch (Exception e) {
                logger.error("Failed to send message to dead letter queue: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to send message to dead letter queue", e);
            }
        }, executorService);
    }

    /**
     * Process messages from retry queue
     */
    public void processRetryQueue() {
        try {
            ReceiveMessageRequest request = ReceiveMessageRequest.builder()
                .queueUrl(retryQueueUrl)
                .maxNumberOfMessages(10)
                .waitTimeSeconds(20) // Long polling
                .messageAttributeNames("All")
                .build();

            ReceiveMessageResponse response = sqsClient.receiveMessage(request);

            for (Message message : response.messages()) {
                processRetryMessage(message);
            }

        } catch (Exception e) {
            logger.error("Error processing retry queue: {}", e.getMessage(), e);
        }
    }

    /**
     * Process messages from dead letter queue
     */
    public void processDeadLetterQueue() {
        try {
            ReceiveMessageRequest request = ReceiveMessageRequest.builder()
                .queueUrl(dlqUrl)
                .maxNumberOfMessages(10)
                .waitTimeSeconds(20) // Long polling
                .messageAttributeNames("All")
                .build();

            ReceiveMessageResponse response = sqsClient.receiveMessage(request);

            for (Message message : response.messages()) {
                processDlqMessage(message);
            }

        } catch (Exception e) {
            logger.error("Error processing dead letter queue: {}", e.getMessage(), e);
        }
    }

    /**
     * Process a single retry message
     */
    private void processRetryMessage(Message message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> messageBody = objectMapper.readValue(message.body(), Map.class);
            
            int retryCount = Integer.parseInt(
                message.messageAttributes().getOrDefault("RetryCount", 
                    MessageAttributeValue.builder().stringValue("0").build()).stringValue()
            );

            logger.info("Processing retry message: messageId={}, retryCount={}", 
                message.messageId(), retryCount);

            // Attempt to reprocess the message
            boolean success = reprocessMessage(messageBody);

            if (success) {
                // Delete message from retry queue on success
                deleteMessage(retryQueueUrl, message.receiptHandle());
                
                logger.info("Successfully reprocessed retry message: messageId={}", message.messageId());
            } else {
                // Increment retry count and check if we should send to DLQ
                retryCount++;
                if (retryCount >= 3) {
                    // Send to DLQ and delete from retry queue
                    sendToDeadLetterQueue(messageBody, "Max retry attempts exceeded");
                    deleteMessage(retryQueueUrl, message.receiptHandle());
                    
                    logger.warn("Max retries exceeded for message: messageId={}", message.messageId());
                } else {
                    // Send back to retry queue with increased delay
                    messageBody.put("retryCount", retryCount);
                    int delaySeconds = Math.min(300, retryCount * 60); // Exponential backoff, max 5 minutes
                    
                    sendToRetryQueue(messageBody, delaySeconds);
                    deleteMessage(retryQueueUrl, message.receiptHandle());
                    
                    logger.info("Requeued message for retry: messageId={}, retryCount={}, delaySeconds={}", 
                        message.messageId(), retryCount, delaySeconds);
                }
            }

        } catch (Exception e) {
            logger.error("Error processing retry message {}: {}", message.messageId(), e.getMessage(), e);
        }
    }

    /**
     * Process a single DLQ message
     */
    private void processDlqMessage(Message message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> messageBody = objectMapper.readValue(message.body(), Map.class);
            
            String errorReason = message.messageAttributes().getOrDefault("ErrorReason", 
                MessageAttributeValue.builder().stringValue("Unknown").build()).stringValue();

            logger.info("Processing DLQ message: messageId={}, errorReason={}", 
                message.messageId(), errorReason);

            // Log DLQ message for manual investigation
            auditLogService.logDataAccess(
                messageBody.getOrDefault("userId", "unknown").toString(),
                "DLQ_MESSAGE_PROCESSED",
                "sqs",
                message.messageId(),
                "system"
            );

            // For now, just delete the message after logging
            // In production, you might want to store these for manual review
            deleteMessage(dlqUrl, message.receiptHandle());

        } catch (Exception e) {
            logger.error("Error processing DLQ message {}: {}", message.messageId(), e.getMessage(), e);
        }
    }

    /**
     * Attempt to reprocess a failed message
     */
    private boolean reprocessMessage(Map<String, Object> messageBody) {
        try {
            // This is where you would implement the actual message processing logic
            // For now, we'll simulate processing based on message type
            
            String messageType = messageBody.getOrDefault("type", "unknown").toString();
            
            switch (messageType) {
                case "event_processing":
                    return reprocessEventMessage(messageBody);
                case "analytics_calculation":
                    return reprocessAnalyticsMessage(messageBody);
                case "notification":
                    return reprocessNotificationMessage(messageBody);
                default:
                    logger.warn("Unknown message type for reprocessing: {}", messageType);
                    return false;
            }

        } catch (Exception e) {
            logger.error("Error reprocessing message: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Reprocess event message
     */
    private boolean reprocessEventMessage(Map<String, Object> messageBody) {
        try {
            // Simulate event reprocessing
            logger.info("Reprocessing event message: {}", messageBody.get("eventId"));
            
            // In production, this would call the actual event processing service
            // For now, we'll simulate success/failure
            return Math.random() > 0.2; // 80% success rate
            
        } catch (Exception e) {
            logger.error("Error reprocessing event message: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Reprocess analytics message
     */
    private boolean reprocessAnalyticsMessage(Map<String, Object> messageBody) {
        try {
            // Simulate analytics reprocessing
            logger.info("Reprocessing analytics message: {}", messageBody.get("calculationId"));
            
            // In production, this would call the actual analytics calculation service
            return Math.random() > 0.1; // 90% success rate
            
        } catch (Exception e) {
            logger.error("Error reprocessing analytics message: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Reprocess notification message
     */
    private boolean reprocessNotificationMessage(Map<String, Object> messageBody) {
        try {
            // Simulate notification reprocessing
            logger.info("Reprocessing notification message: {}", messageBody.get("notificationId"));
            
            // In production, this would call the actual notification service
            return Math.random() > 0.15; // 85% success rate
            
        } catch (Exception e) {
            logger.error("Error reprocessing notification message: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Delete message from queue
     */
    private void deleteMessage(String queueUrl, String receiptHandle) {
        try {
            DeleteMessageRequest request = DeleteMessageRequest.builder()
                .queueUrl(queueUrl)
                .receiptHandle(receiptHandle)
                .build();

            sqsClient.deleteMessage(request);

        } catch (Exception e) {
            logger.error("Error deleting message from queue {}: {}", queueUrl, e.getMessage(), e);
        }
    }

    /**
     * Get queue attributes
     */
    public Map<String, String> getQueueAttributes(String queueUrl) {
        try {
            GetQueueAttributesRequest request = GetQueueAttributesRequest.builder()
                .queueUrl(queueUrl)
                .attributeNames(QueueAttributeName.ALL)
                .build();

            GetQueueAttributesResponse response = sqsClient.getQueueAttributes(request);
            Map<String, String> attributes = new HashMap<>();
            response.attributes().forEach((key, value) -> attributes.put(key.toString(), value));
            return attributes;

        } catch (Exception e) {
            logger.error("Error getting queue attributes for {}: {}", queueUrl, e.getMessage(), e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Get queue metrics
     */
    public Map<String, Object> getQueueMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        try {
            // Get retry queue metrics
            Map<String, String> retryAttributes = getQueueAttributes(retryQueueUrl);
            metrics.put("retryQueue", Map.of(
                "approximateNumberOfMessages", retryAttributes.getOrDefault("ApproximateNumberOfMessages", "0"),
                "approximateNumberOfMessagesNotVisible", retryAttributes.getOrDefault("ApproximateNumberOfMessagesNotVisible", "0")
            ));

            // Get DLQ metrics
            Map<String, String> dlqAttributes = getQueueAttributes(dlqUrl);
            metrics.put("deadLetterQueue", Map.of(
                "approximateNumberOfMessages", dlqAttributes.getOrDefault("ApproximateNumberOfMessages", "0"),
                "approximateNumberOfMessagesNotVisible", dlqAttributes.getOrDefault("ApproximateNumberOfMessagesNotVisible", "0")
            ));

        } catch (Exception e) {
            logger.error("Error getting queue metrics: {}", e.getMessage(), e);
            metrics.put("error", e.getMessage());
        }

        return metrics;
    }

    /**
     * Shutdown the executor service
     */
    public void shutdown() {
        executorService.shutdown();
    }
}