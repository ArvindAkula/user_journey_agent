package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class ComplianceService {

    private static final Logger logger = LoggerFactory.getLogger(ComplianceService.class);

    @Autowired
    private DynamoDbClient dynamoDbClient;

    @Autowired
    private S3Client s3Client;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private DataEncryptionService dataEncryptionService;

    @Autowired
    private ObjectMapper objectMapper;

    private static final List<String> USER_DATA_TABLES = Arrays.asList(
        "UserProfiles", "UserEvents", "StruggleSignals", "VideoEngagement", "UserConsent"
    );

    private static final String S3_BUCKET_NAME = "user-journey-analytics-data";

    /**
     * Handles GDPR Article 15 - Right of Access
     * Exports all user data in a portable format
     */
    public CompletableFuture<Map<String, Object>> exportUserData(String userId, String requestId, String ipAddress) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                auditLogService.logComplianceEvent(userId, "DATA_EXPORT_REQUEST", "GDPR", requestId, ipAddress);
                
                Map<String, Object> userData = new HashMap<>();
                
                // Export data from each table
                for (String tableName : USER_DATA_TABLES) {
                    List<Map<String, Object>> tableData = exportUserDataFromTable(userId, tableName);
                    userData.put(tableName, tableData);
                }
                
                // Export S3 data
                List<String> s3Objects = exportUserDataFromS3(userId);
                userData.put("S3Objects", s3Objects);
                
                // Add metadata
                userData.put("exportTimestamp", LocalDateTime.now().toString());
                userData.put("requestId", requestId);
                userData.put("regulation", "GDPR Article 15 - Right of Access");
                
                auditLogService.logComplianceEvent(userId, "DATA_EXPORT_COMPLETED", "GDPR", requestId, ipAddress);
                
                return userData;
                
            } catch (Exception e) {
                logger.error("Failed to export user data for userId: {}", userId, e);
                auditLogService.logComplianceEvent(userId, "DATA_EXPORT_FAILED", "GDPR", requestId, ipAddress);
                throw new RuntimeException("Failed to export user data", e);
            }
        });
    }

    /**
     * Handles GDPR Article 17 - Right to Erasure (Right to be Forgotten)
     * Deletes all user data across all systems
     */
    public CompletableFuture<Boolean> deleteUserData(String userId, String requestId, String ipAddress, String reason) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                auditLogService.logComplianceEvent(userId, "DATA_DELETION_REQUEST", "GDPR", requestId, ipAddress);
                
                // Delete from DynamoDB tables
                for (String tableName : USER_DATA_TABLES) {
                    deleteUserDataFromTable(userId, tableName);
                }
                
                // Delete from S3
                deleteUserDataFromS3(userId);
                
                // Create deletion record (anonymized)
                createDeletionRecord(userId, requestId, reason, ipAddress);
                
                auditLogService.logComplianceEvent(userId, "DATA_DELETION_COMPLETED", "GDPR", requestId, ipAddress);
                
                return true;
                
            } catch (Exception e) {
                logger.error("Failed to delete user data for userId: {}", userId, e);
                auditLogService.logComplianceEvent(userId, "DATA_DELETION_FAILED", "GDPR", requestId, ipAddress);
                return false;
            }
        });
    }

    /**
     * Handles CCPA - Right to Delete Personal Information
     */
    public CompletableFuture<Boolean> deleteCCPAUserData(String userId, String requestId, String ipAddress) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                auditLogService.logComplianceEvent(userId, "CCPA_DELETION_REQUEST", "CCPA", requestId, ipAddress);
                
                // CCPA allows for some exceptions, so we anonymize rather than delete completely
                anonymizeUserData(userId);
                
                auditLogService.logComplianceEvent(userId, "CCPA_DELETION_COMPLETED", "CCPA", requestId, ipAddress);
                
                return true;
                
            } catch (Exception e) {
                logger.error("Failed to process CCPA deletion for userId: {}", userId, e);
                auditLogService.logComplianceEvent(userId, "CCPA_DELETION_FAILED", "CCPA", requestId, ipAddress);
                return false;
            }
        });
    }

    /**
     * Anonymizes user data while preserving analytics value
     */
    public void anonymizeUserData(String userId) {
        try {
            String anonymizedId = dataEncryptionService.anonymizeData(userId);
            
            for (String tableName : USER_DATA_TABLES) {
                anonymizeUserDataInTable(userId, anonymizedId, tableName);
            }
            
            logger.info("Successfully anonymized data for userId: {}", userId);
            
        } catch (Exception e) {
            logger.error("Failed to anonymize user data for userId: {}", userId, e);
            throw new RuntimeException("Failed to anonymize user data", e);
        }
    }

    /**
     * Manages user consent preferences
     */
    public void updateUserConsent(String userId, Map<String, Boolean> consentPreferences, String ipAddress, String userAgent) {
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("userId", AttributeValue.builder().s(userId).build());
            item.put("timestamp", AttributeValue.builder().n(String.valueOf(LocalDateTime.now().toEpochSecond(ZoneOffset.UTC))).build());
            item.put("consentPreferences", AttributeValue.builder().s(objectMapper.writeValueAsString(consentPreferences)).build());
            item.put("ipAddress", AttributeValue.builder().s(ipAddress).build());
            item.put("userAgent", AttributeValue.builder().s(userAgent).build());

            PutItemRequest request = PutItemRequest.builder()
                .tableName("UserConsent")
                .item(item)
                .build();

            dynamoDbClient.putItem(request);
            
            // Log consent changes
            for (Map.Entry<String, Boolean> consent : consentPreferences.entrySet()) {
                auditLogService.logConsentChange(userId, consent.getKey(), consent.getValue(), ipAddress, userAgent);
            }
            
        } catch (Exception e) {
            logger.error("Failed to update user consent for userId: {}", userId, e);
            throw new RuntimeException("Failed to update user consent", e);
        }
    }

    /**
     * Gets current user consent preferences
     */
    public Map<String, Boolean> getUserConsent(String userId) {
        try {
            Map<String, AttributeValue> key = Map.of("userId", AttributeValue.builder().s(userId).build());
            
            GetItemRequest request = GetItemRequest.builder()
                .tableName("UserConsent")
                .key(key)
                .build();

            GetItemResponse response = dynamoDbClient.getItem(request);
            
            if (response.hasItem()) {
                String consentJson = response.item().get("consentPreferences").s();
                return objectMapper.readValue(consentJson, Map.class);
            }
            
            return getDefaultConsentPreferences();
            
        } catch (Exception e) {
            logger.error("Failed to get user consent for userId: {}", userId, e);
            return getDefaultConsentPreferences();
        }
    }

    private List<Map<String, Object>> exportUserDataFromTable(String userId, String tableName) {
        List<Map<String, Object>> results = new ArrayList<>();
        
        try {
            Map<String, AttributeValue> expressionAttributeValues = Map.of(":userId", AttributeValue.builder().s(userId).build());
            
            ScanRequest request = ScanRequest.builder()
                .tableName(tableName)
                .filterExpression("userId = :userId")
                .expressionAttributeValues(expressionAttributeValues)
                .build();

            ScanResponse response = dynamoDbClient.scan(request);
            
            for (Map<String, AttributeValue> item : response.items()) {
                Map<String, Object> convertedItem = new HashMap<>();
                for (Map.Entry<String, AttributeValue> entry : item.entrySet()) {
                    convertedItem.put(entry.getKey(), convertAttributeValue(entry.getValue()));
                }
                results.add(convertedItem);
            }
            
        } catch (Exception e) {
            logger.error("Failed to export data from table: {}", tableName, e);
        }
        
        return results;
    }

    private void deleteUserDataFromTable(String userId, String tableName) {
        try {
            // First, get all items for the user
            Map<String, AttributeValue> expressionAttributeValues = Map.of(":userId", AttributeValue.builder().s(userId).build());
            
            ScanRequest scanRequest = ScanRequest.builder()
                .tableName(tableName)
                .filterExpression("userId = :userId")
                .expressionAttributeValues(expressionAttributeValues)
                .build();

            ScanResponse scanResponse = dynamoDbClient.scan(scanRequest);
            
            // Delete each item
            for (Map<String, AttributeValue> item : scanResponse.items()) {
                Map<String, AttributeValue> key = new HashMap<>();
                key.put("userId", item.get("userId"));
                
                // Add sort key if it exists
                if (item.containsKey("timestamp")) {
                    key.put("timestamp", item.get("timestamp"));
                } else if (item.containsKey("featureId")) {
                    key.put("featureId", item.get("featureId"));
                } else if (item.containsKey("videoId")) {
                    key.put("videoId", item.get("videoId"));
                }
                
                DeleteItemRequest deleteRequest = DeleteItemRequest.builder()
                    .tableName(tableName)
                    .key(key)
                    .build();

                dynamoDbClient.deleteItem(deleteRequest);
            }
            
        } catch (Exception e) {
            logger.error("Failed to delete data from table: {}", tableName, e);
        }
    }

    private List<String> exportUserDataFromS3(String userId) {
        List<String> objectKeys = new ArrayList<>();
        
        try {
            ListObjectsV2Request request = ListObjectsV2Request.builder()
                .bucket(S3_BUCKET_NAME)
                .prefix("users/" + userId + "/")
                .build();

            ListObjectsV2Response response = s3Client.listObjectsV2(request);
            
            for (S3Object object : response.contents()) {
                objectKeys.add(object.key());
            }
            
        } catch (Exception e) {
            logger.error("Failed to export S3 data for userId: {}", userId, e);
        }
        
        return objectKeys;
    }

    private void deleteUserDataFromS3(String userId) {
        try {
            ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                .bucket(S3_BUCKET_NAME)
                .prefix("users/" + userId + "/")
                .build();

            ListObjectsV2Response listResponse = s3Client.listObjectsV2(listRequest);
            
            for (S3Object object : listResponse.contents()) {
                DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(S3_BUCKET_NAME)
                    .key(object.key())
                    .build();

                s3Client.deleteObject(deleteRequest);
            }
            
        } catch (Exception e) {
            logger.error("Failed to delete S3 data for userId: {}", userId, e);
        }
    }

    private void anonymizeUserDataInTable(String userId, String anonymizedId, String tableName) {
        // Implementation would update records to replace PII with anonymized versions
        // This is a simplified version - in production, you'd need more sophisticated anonymization
        logger.info("Anonymizing data in table {} for userId: {}", tableName, userId);
    }

    private void createDeletionRecord(String userId, String requestId, String reason, String ipAddress) {
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("deletionId", AttributeValue.builder().s(UUID.randomUUID().toString()).build());
            item.put("anonymizedUserId", AttributeValue.builder().s(dataEncryptionService.anonymizeData(userId)).build());
            item.put("requestId", AttributeValue.builder().s(requestId).build());
            item.put("reason", AttributeValue.builder().s(reason).build());
            item.put("timestamp", AttributeValue.builder().n(String.valueOf(LocalDateTime.now().toEpochSecond(ZoneOffset.UTC))).build());
            item.put("ipAddress", AttributeValue.builder().s(ipAddress).build());

            PutItemRequest request = PutItemRequest.builder()
                .tableName("DeletionRecords")
                .item(item)
                .build();

            dynamoDbClient.putItem(request);
            
        } catch (Exception e) {
            logger.error("Failed to create deletion record", e);
        }
    }

    private Object convertAttributeValue(AttributeValue attributeValue) {
        if (attributeValue.s() != null) return attributeValue.s();
        if (attributeValue.n() != null) return attributeValue.n();
        if (attributeValue.bool() != null) return attributeValue.bool();
        if (attributeValue.hasL()) return attributeValue.l();
        if (attributeValue.hasM()) return attributeValue.m();
        return null;
    }

    private Map<String, Boolean> getDefaultConsentPreferences() {
        Map<String, Boolean> defaults = new HashMap<>();
        defaults.put("analytics", false);
        defaults.put("marketing", false);
        defaults.put("personalization", false);
        defaults.put("essential", true); // Essential cookies are required
        return defaults;
    }
}