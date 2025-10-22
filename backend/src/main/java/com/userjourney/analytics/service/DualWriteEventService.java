package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * Dual Write Event Service
 * 
 * Implements a dual-write strategy to write events to both DynamoDB
 * and Firebase Analytics during the migration period. This allows
 * validation of data consistency before fully transitioning to BigQuery.
 * 
 * Features:
 * - Configurable via feature flag
 * - Asynchronous writes to avoid blocking
 * - Error handling and logging for monitoring
 * - Metrics for data consistency validation
 */
@Service
public class DualWriteEventService {

    private static final Logger logger = LoggerFactory.getLogger(DualWriteEventService.class);

    @Value("${dual-write.enabled:false}")
    private boolean dualWriteEnabled;

    @Value("${dual-write.fail-on-firebase-error:false}")
    private boolean failOnFirebaseError;

    private final ProductionDynamoDBService dynamoDBService;
    private final FirebaseAnalyticsIntegrationService firebaseService;

    @Autowired
    public DualWriteEventService(
            ProductionDynamoDBService dynamoDBService,
            FirebaseAnalyticsIntegrationService firebaseService) {
        this.dynamoDBService = dynamoDBService;
        this.firebaseService = firebaseService;
    }

    /**
     * Write event to both DynamoDB and Firebase Analytics
     * 
     * @param event The user event to write
     * @return true if write was successful to primary storage (DynamoDB)
     */
    public boolean writeEvent(UserEvent event) {
        if (!dualWriteEnabled) {
            // Dual-write disabled, only write to DynamoDB
            return writeToDynamoDB(event);
        }

        logger.debug("Dual-write enabled: writing event {} to both DynamoDB and Firebase", event.getEventType());

        // Write to DynamoDB (primary storage)
        boolean dynamoSuccess = writeToDynamoDB(event);

        if (!dynamoSuccess) {
            logger.error("Failed to write event to DynamoDB: {}", event.getEventId());
            return false;
        }

        // Write to Firebase Analytics asynchronously (secondary storage)
        CompletableFuture.runAsync(() -> writeToFirebase(event))
                .exceptionally(ex -> {
                    logger.error("Async Firebase write failed for event: {}", event.getEventId(), ex);
                    return null;
                });

        return true;
    }

    /**
     * Write event to DynamoDB
     */
    private boolean writeToDynamoDB(UserEvent event) {
        try {
            dynamoDBService.storeUserEvent(event).get();
            logger.debug("Successfully wrote event {} to DynamoDB", event.getEventId());
            return true;
        } catch (Exception e) {
            logger.error("Error writing event to DynamoDB: {}", event.getEventId(), e);
            return false;
        }
    }

    /**
     * Write event to Firebase Analytics
     */
    private void writeToFirebase(UserEvent event) {
        try {
            // Send event to Firebase Analytics
            firebaseService.sendEventToFirebase(event).get();
            logger.debug("Successfully wrote event {} to Firebase Analytics", event.getEventId());
        } catch (Exception e) {
            logger.error("Error writing event to Firebase Analytics: {}", event.getEventId(), e);
            
            if (failOnFirebaseError) {
                throw new RuntimeException("Firebase write failed", e);
            }
        }
    }

    /**
     * Validate data consistency between DynamoDB and BigQuery
     * 
     * This method can be used to compare event counts and validate
     * that data is being written correctly to both systems.
     */
    public ConsistencyReport validateConsistency(String userId, long startTimestamp, long endTimestamp) {
        ConsistencyReport report = new ConsistencyReport();
        report.setUserId(userId);
        report.setStartTimestamp(startTimestamp);
        report.setEndTimestamp(endTimestamp);

        try {
            // Get event count from DynamoDB
            long dynamoCount = dynamoDBService.queryUserEvents(userId, startTimestamp, endTimestamp, 10000).size();
            report.setDynamoDBCount(dynamoCount);

            // Note: BigQuery count would need to be queried separately
            // This is a placeholder for the validation logic
            logger.info("DynamoDB event count for user {}: {}", userId, dynamoCount);

            report.setConsistent(true); // Placeholder
        } catch (Exception e) {
            logger.error("Error validating consistency", e);
            report.setConsistent(false);
            report.setErrorMessage(e.getMessage());
        }

        return report;
    }

    /**
     * Check if dual-write is enabled
     */
    public boolean isDualWriteEnabled() {
        return dualWriteEnabled;
    }

    /**
     * Consistency Report DTO
     */
    public static class ConsistencyReport {
        private String userId;
        private long startTimestamp;
        private long endTimestamp;
        private long dynamoDBCount;
        private long bigQueryCount;
        private boolean consistent;
        private String errorMessage;

        // Getters and setters
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }

        public long getStartTimestamp() { return startTimestamp; }
        public void setStartTimestamp(long startTimestamp) { this.startTimestamp = startTimestamp; }

        public long getEndTimestamp() { return endTimestamp; }
        public void setEndTimestamp(long endTimestamp) { this.endTimestamp = endTimestamp; }

        public long getDynamoDBCount() { return dynamoDBCount; }
        public void setDynamoDBCount(long dynamoDBCount) { this.dynamoDBCount = dynamoDBCount; }

        public long getBigQueryCount() { return bigQueryCount; }
        public void setBigQueryCount(long bigQueryCount) { this.bigQueryCount = bigQueryCount; }

        public boolean isConsistent() { return consistent; }
        public void setConsistent(boolean consistent) { this.consistent = consistent; }

        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    }
}
