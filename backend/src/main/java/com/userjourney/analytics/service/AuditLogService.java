package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditLogService {

    private static final Logger logger = LoggerFactory.getLogger(AuditLogService.class);

    @Autowired
    private DynamoDbClient dynamoDbClient;

    @Autowired
    private ObjectMapper objectMapper;
    
    @Value("${aws.dynamodb.table-prefix:user-journey-analytics-}")
    private String tablePrefix;
    
    @Value("${aws.dynamodb.audit-logs-table:audit-logs}")
    private String auditLogsTable;

    /**
     * Logs data access events for compliance tracking
     */
    public void logDataAccess(String userId, String action, String resourceType, 
                             String resourceId, String ipAddress) {
        AuditLogEntry entry = AuditLogEntry.builder()
            .logId(UUID.randomUUID().toString())
            .userId(userId)
            .action(action)
            .resourceType(resourceType)
            .resourceId(resourceId)
            .ipAddress(ipAddress)
            .timestamp(LocalDateTime.now())
            .eventType("DATA_ACCESS")
            .build();

        saveAuditLog(entry);
    }

    /**
     * Logs data modification events
     */
    public void logDataModification(String userId, String action, String resourceType, 
                                  String resourceId, Object oldValue, Object newValue, String ipAddress) {
        Map<String, Object> details = new HashMap<>();
        details.put("oldValue", oldValue);
        details.put("newValue", newValue);

        AuditLogEntry entry = AuditLogEntry.builder()
            .logId(UUID.randomUUID().toString())
            .userId(userId)
            .action(action)
            .resourceType(resourceType)
            .resourceId(resourceId)
            .ipAddress(ipAddress)
            .timestamp(LocalDateTime.now())
            .eventType("DATA_MODIFICATION")
            .details(details)
            .build();

        saveAuditLog(entry);
    }

    /**
     * Logs security events
     */
    public void logSecurityEvent(String userId, String eventType, String ipAddress, String details) {
        AuditLogEntry entry = AuditLogEntry.builder()
            .logId(UUID.randomUUID().toString())
            .userId(userId)
            .action(eventType)
            .resourceType("SECURITY")
            .ipAddress(ipAddress)
            .timestamp(LocalDateTime.now())
            .eventType("SECURITY_EVENT")
            .details(Map.of("description", details))
            .build();

        saveAuditLog(entry);
    }

    /**
     * Logs compliance events (GDPR, CCPA actions)
     */
    public void logComplianceEvent(String userId, String action, String regulation, 
                                 String requestId, String ipAddress) {
        Map<String, Object> details = new HashMap<>();
        details.put("regulation", regulation);
        details.put("requestId", requestId);

        AuditLogEntry entry = AuditLogEntry.builder()
            .logId(UUID.randomUUID().toString())
            .userId(userId)
            .action(action)
            .resourceType("COMPLIANCE")
            .ipAddress(ipAddress)
            .timestamp(LocalDateTime.now())
            .eventType("COMPLIANCE_EVENT")
            .details(details)
            .build();

        saveAuditLog(entry);
    }

    /**
     * Logs user consent changes
     */
    public void logConsentChange(String userId, String consentType, boolean granted, 
                               String ipAddress, String userAgent) {
        Map<String, Object> details = new HashMap<>();
        details.put("consentType", consentType);
        details.put("granted", granted);
        details.put("userAgent", userAgent);

        AuditLogEntry entry = AuditLogEntry.builder()
            .logId(UUID.randomUUID().toString())
            .userId(userId)
            .action("CONSENT_CHANGE")
            .resourceType("USER_CONSENT")
            .ipAddress(ipAddress)
            .timestamp(LocalDateTime.now())
            .eventType("CONSENT_EVENT")
            .details(details)
            .build();

        saveAuditLog(entry);
    }

    private void saveAuditLog(AuditLogEntry entry) {
        try {
            String tableName = tablePrefix + auditLogsTable;
            
            logger.info("🟡 AUDIT LOG: Attempting to save to table: {}", tableName);
            
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("logId", AttributeValue.builder().s(entry.getLogId()).build());
            item.put("userId", AttributeValue.builder().s(entry.getUserId()).build());
            item.put("action", AttributeValue.builder().s(entry.getAction()).build());
            item.put("resourceType", AttributeValue.builder().s(entry.getResourceType()).build());
            item.put("eventType", AttributeValue.builder().s(entry.getEventType()).build());
            item.put("timestamp", AttributeValue.builder().n(String.valueOf(entry.getTimestamp().toEpochSecond(ZoneOffset.UTC))).build());
            item.put("ipAddress", AttributeValue.builder().s(entry.getIpAddress()).build());
            
            if (entry.getResourceId() != null) {
                item.put("resourceId", AttributeValue.builder().s(entry.getResourceId()).build());
            }
            
            if (entry.getDetails() != null) {
                item.put("details", AttributeValue.builder().s(objectMapper.writeValueAsString(entry.getDetails())).build());
            }

            PutItemRequest request = PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build();

            dynamoDbClient.putItem(request);
            
            // Also log to application logs for immediate visibility
            logger.info("Audit Log: userId={}, action={}, resourceType={}, eventType={}, timestamp={}", 
                entry.getUserId(), entry.getAction(), entry.getResourceType(), 
                entry.getEventType(), entry.getTimestamp());

        } catch (Exception e) {
            logger.error("Failed to save audit log entry", e);
            // Don't throw exception to avoid disrupting main application flow
        }
    }

    public static class AuditLogEntry {
        private String logId;
        private String userId;
        private String action;
        private String resourceType;
        private String resourceId;
        private String ipAddress;
        private LocalDateTime timestamp;
        private String eventType;
        private Map<String, Object> details;

        // Builder pattern
        public static Builder builder() {
            return new Builder();
        }

        public static class Builder {
            private AuditLogEntry entry = new AuditLogEntry();

            public Builder logId(String logId) {
                entry.logId = logId;
                return this;
            }

            public Builder userId(String userId) {
                entry.userId = userId;
                return this;
            }

            public Builder action(String action) {
                entry.action = action;
                return this;
            }

            public Builder resourceType(String resourceType) {
                entry.resourceType = resourceType;
                return this;
            }

            public Builder resourceId(String resourceId) {
                entry.resourceId = resourceId;
                return this;
            }

            public Builder ipAddress(String ipAddress) {
                entry.ipAddress = ipAddress;
                return this;
            }

            public Builder timestamp(LocalDateTime timestamp) {
                entry.timestamp = timestamp;
                return this;
            }

            public Builder eventType(String eventType) {
                entry.eventType = eventType;
                return this;
            }

            public Builder details(Map<String, Object> details) {
                entry.details = details;
                return this;
            }

            public AuditLogEntry build() {
                return entry;
            }
        }

        // Getters
        public String getLogId() { return logId; }
        public String getUserId() { return userId; }
        public String getAction() { return action; }
        public String getResourceType() { return resourceType; }
        public String getResourceId() { return resourceId; }
        public String getIpAddress() { return ipAddress; }
        public LocalDateTime getTimestamp() { return timestamp; }
        public String getEventType() { return eventType; }
        public Map<String, Object> details() { return details; }
        public Map<String, Object> getDetails() { return details; }
    }
}