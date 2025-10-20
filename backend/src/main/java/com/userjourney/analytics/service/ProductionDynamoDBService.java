package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.model.UserEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class ProductionDynamoDBService {

    private static final Logger logger = LoggerFactory.getLogger(ProductionDynamoDBService.class);

    @Autowired
    private DynamoDbClient dynamoDbClient;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuditLogService auditLogService;

    @Value("${aws.dynamodb.table-prefix:prod-}")
    private String tablePrefix;

    @Value("${aws.dynamodb.user-events-table:user-events}")
    private String userEventsTable;

    @Value("${aws.dynamodb.user-sessions-table:user-sessions}")
    private String userSessionsTable;

    @Value("${aws.dynamodb.analytics-summary-table:analytics-summary}")
    private String analyticsSummaryTable;

    private final ExecutorService executorService = Executors.newFixedThreadPool(10);

    /**
     * Store a user event in DynamoDB
     */
    public CompletableFuture<String> storeUserEvent(UserEvent event) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String tableName = tablePrefix + userEventsTable;
                String eventId = generateEventId(event);
                
                logger.info("🔵 DYNAMODB: Attempting to store event to table: {}", tableName);
                logger.info("🔵 DYNAMODB: Table prefix: '{}', Base table: '{}'", tablePrefix, userEventsTable);
                logger.info("🔵 DYNAMODB: Event ID: {}, Type: {}, User: {}", eventId, event.getEventType(), event.getUserId());

                Map<String, AttributeValue> item = new HashMap<>();
                item.put("userId", AttributeValue.builder().s(event.getUserId()).build());
                item.put("timestamp", AttributeValue.builder().n(String.valueOf(event.getTimestamp())).build());
                item.put("eventId", AttributeValue.builder().s(eventId).build());
                item.put("eventType", AttributeValue.builder().s(event.getEventType()).build());
                item.put("sessionId", AttributeValue.builder().s(event.getSessionId()).build());

                // Store event data as JSON
                if (event.getEventData() != null) {
                    String eventDataJson = objectMapper.writeValueAsString(event.getEventData());
                    item.put("eventData", AttributeValue.builder().s(eventDataJson).build());
                }

                // Store device info as JSON
                if (event.getDeviceInfo() != null) {
                    String deviceInfoJson = objectMapper.writeValueAsString(event.getDeviceInfo());
                    item.put("deviceInfo", AttributeValue.builder().s(deviceInfoJson).build());
                }

                // Store user context as JSON
                if (event.getUserContext() != null) {
                    String userContextJson = objectMapper.writeValueAsString(event.getUserContext());
                    item.put("userContext", AttributeValue.builder().s(userContextJson).build());
                }

                // Add TTL (30 days from now)
                long ttl = Instant.now().plusSeconds(30 * 24 * 60 * 60).getEpochSecond();
                item.put("ttl", AttributeValue.builder().n(String.valueOf(ttl)).build());

                // Add date partition for efficient querying
                String datePartition = LocalDate.ofInstant(Instant.ofEpochMilli(event.getTimestamp()), ZoneOffset.UTC)
                        .format(DateTimeFormatter.ISO_LOCAL_DATE);
                item.put("datePartition", AttributeValue.builder().s(datePartition).build());

                PutItemRequest request = PutItemRequest.builder()
                        .tableName(tableName)
                        .item(item)
                        .build();

                dynamoDbClient.putItem(request);

                logger.debug("Successfully stored event {} in DynamoDB table {}", eventId, tableName);

                auditLogService.logDataAccess(
                        event.getUserId(),
                        "EVENT_STORED_DYNAMODB",
                        "dynamodb",
                        tableName,
                        "system");

                return eventId;

            } catch (Exception e) {
                logger.error("Failed to store event in DynamoDB: {}", e.getMessage(), e);

                auditLogService.logSecurityEvent(
                        event.getUserId(),
                        "EVENT_STORE_FAILED",
                        "system",
                        "Failed to store event in DynamoDB: " + e.getMessage());

                throw new RuntimeException("Failed to store event in DynamoDB", e);
            }
        }, executorService);
    }

    /**
     * Store user session information
     */
    public CompletableFuture<Void> storeUserSession(String sessionId, String userId, long startTime, long endTime,
            int eventCount) {
        return CompletableFuture.runAsync(() -> {
            try {
                String tableName = tablePrefix + userSessionsTable;

                Map<String, AttributeValue> item = new HashMap<>();
                item.put("sessionId", AttributeValue.builder().s(sessionId).build());
                item.put("userId", AttributeValue.builder().s(userId).build());
                item.put("startTime", AttributeValue.builder().n(String.valueOf(startTime)).build());
                item.put("endTime", AttributeValue.builder().n(String.valueOf(endTime)).build());
                item.put("eventCount", AttributeValue.builder().n(String.valueOf(eventCount)).build());
                item.put("duration", AttributeValue.builder().n(String.valueOf(endTime - startTime)).build());

                // Add TTL (90 days from now)
                long ttl = Instant.now().plusSeconds(90 * 24 * 60 * 60).getEpochSecond();
                item.put("ttl", AttributeValue.builder().n(String.valueOf(ttl)).build());

                PutItemRequest request = PutItemRequest.builder()
                        .tableName(tableName)
                        .item(item)
                        .build();

                dynamoDbClient.putItem(request);

                logger.debug("Successfully stored session {} in DynamoDB table {}", sessionId, tableName);

            } catch (Exception e) {
                logger.error("Failed to store session in DynamoDB: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to store session in DynamoDB", e);
            }
        }, executorService);
    }

    /**
     * Store analytics summary data
     */
    public CompletableFuture<Void> storeAnalyticsSummary(String date, String metricType, double value,
            Map<String, Object> metadata) {
        return CompletableFuture.runAsync(() -> {
            try {
                String tableName = tablePrefix + analyticsSummaryTable;

                Map<String, AttributeValue> item = new HashMap<>();
                item.put("date", AttributeValue.builder().s(date).build());
                item.put("metricType", AttributeValue.builder().s(metricType).build());
                item.put("value", AttributeValue.builder().n(String.valueOf(value)).build());
                item.put("calculatedAt",
                        AttributeValue.builder().n(String.valueOf(System.currentTimeMillis())).build());

                if (metadata != null && !metadata.isEmpty()) {
                    String metadataJson = objectMapper.writeValueAsString(metadata);
                    item.put("metadata", AttributeValue.builder().s(metadataJson).build());
                }

                PutItemRequest request = PutItemRequest.builder()
                        .tableName(tableName)
                        .item(item)
                        .build();

                dynamoDbClient.putItem(request);

                logger.debug("Successfully stored analytics summary for {} {} in DynamoDB", date, metricType);

            } catch (Exception e) {
                logger.error("Failed to store analytics summary in DynamoDB: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to store analytics summary in DynamoDB", e);
            }
        }, executorService);
    }

    /**
     * Query user events by user ID and time range
     */
    public List<UserEvent> queryUserEvents(String userId, long startTime, long endTime, int limit) {
        try {
            String tableName = tablePrefix + userEventsTable;

            Map<String, AttributeValue> expressionAttributeValues = new HashMap<>();
            expressionAttributeValues.put(":userId", AttributeValue.builder().s(userId).build());
            expressionAttributeValues.put(":startTime", AttributeValue.builder().n(String.valueOf(startTime)).build());
            expressionAttributeValues.put(":endTime", AttributeValue.builder().n(String.valueOf(endTime)).build());

            QueryRequest request = QueryRequest.builder()
                    .tableName(tableName)
                    .keyConditionExpression("userId = :userId AND #timestamp BETWEEN :startTime AND :endTime")
                    .expressionAttributeNames(Map.of("#timestamp", "timestamp"))
                    .expressionAttributeValues(expressionAttributeValues)
                    .limit(limit)
                    .scanIndexForward(false) // Most recent first
                    .build();

            QueryResponse response = dynamoDbClient.query(request);

            return response.items().stream()
                    .map(this::convertItemToUserEvent)
                    .filter(Objects::nonNull)
                    .toList();

        } catch (Exception e) {
            logger.error("Failed to query user events from DynamoDB: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to query user events", e);
        }
    }

    /**
     * Query events by event type using GSI
     */
    public List<UserEvent> queryEventsByType(String eventType, long startTime, long endTime, int limit) {
        try {
            String tableName = tablePrefix + userEventsTable;

            Map<String, AttributeValue> expressionAttributeValues = new HashMap<>();
            expressionAttributeValues.put(":eventType", AttributeValue.builder().s(eventType).build());
            expressionAttributeValues.put(":startTime", AttributeValue.builder().n(String.valueOf(startTime)).build());
            expressionAttributeValues.put(":endTime", AttributeValue.builder().n(String.valueOf(endTime)).build());

            QueryRequest request = QueryRequest.builder()
                    .tableName(tableName)
                    .indexName("EventTypeIndex") // GSI on eventType
                    .keyConditionExpression("eventType = :eventType AND #timestamp BETWEEN :startTime AND :endTime")
                    .expressionAttributeNames(Map.of("#timestamp", "timestamp"))
                    .expressionAttributeValues(expressionAttributeValues)
                    .limit(limit)
                    .scanIndexForward(false)
                    .build();

            QueryResponse response = dynamoDbClient.query(request);

            return response.items().stream()
                    .map(this::convertItemToUserEvent)
                    .filter(Objects::nonNull)
                    .toList();

        } catch (Exception e) {
            logger.error("Failed to query events by type from DynamoDB: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to query events by type", e);
        }
    }

    /**
     * Get analytics summary for a date range
     */
    public Map<String, Double> getAnalyticsSummary(String startDate, String endDate, String metricType) {
        try {
            String tableName = tablePrefix + analyticsSummaryTable;

            Map<String, AttributeValue> expressionAttributeValues = new HashMap<>();
            expressionAttributeValues.put(":metricType", AttributeValue.builder().s(metricType).build());

            // If querying a single date
            if (startDate.equals(endDate)) {
                expressionAttributeValues.put(":date", AttributeValue.builder().s(startDate).build());

                QueryRequest request = QueryRequest.builder()
                        .tableName(tableName)
                        .keyConditionExpression("date = :date AND metricType = :metricType")
                        .expressionAttributeValues(expressionAttributeValues)
                        .build();

                QueryResponse response = dynamoDbClient.query(request);

                Map<String, Double> result = new HashMap<>();
                for (Map<String, AttributeValue> item : response.items()) {
                    String date = item.get("date").s();
                    double value = Double.parseDouble(item.get("value").n());
                    result.put(date, value);
                }
                return result;
            } else {
                // For date range, we need to scan (not ideal, but necessary for this schema)
                // In production, consider using a different partition strategy
                ScanRequest request = ScanRequest.builder()
                        .tableName(tableName)
                        .filterExpression("metricType = :metricType AND #date BETWEEN :startDate AND :endDate")
                        .expressionAttributeNames(Map.of("#date", "date"))
                        .expressionAttributeValues(Map.of(
                                ":metricType", AttributeValue.builder().s(metricType).build(),
                                ":startDate", AttributeValue.builder().s(startDate).build(),
                                ":endDate", AttributeValue.builder().s(endDate).build()))
                        .build();

                ScanResponse response = dynamoDbClient.scan(request);

                Map<String, Double> result = new HashMap<>();
                for (Map<String, AttributeValue> item : response.items()) {
                    String date = item.get("date").s();
                    double value = Double.parseDouble(item.get("value").n());
                    result.put(date, value);
                }
                return result;
            }

        } catch (Exception e) {
            logger.error("Failed to get analytics summary from DynamoDB: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get analytics summary", e);
        }
    }

    /**
     * Convert DynamoDB item to UserEvent
     */
    private UserEvent convertItemToUserEvent(Map<String, AttributeValue> item) {
        try {
            UserEvent event = new UserEvent();

            event.setUserId(item.get("userId").s());
            event.setTimestamp(Long.parseLong(item.get("timestamp").n()));
            event.setEventType(item.get("eventType").s());
            event.setSessionId(item.get("sessionId").s());

            if (item.containsKey("eventData") && item.get("eventData").s() != null) {
                UserEvent.EventData eventData = objectMapper.readValue(
                        item.get("eventData").s(), UserEvent.EventData.class);
                event.setEventData(eventData);
            }

            if (item.containsKey("deviceInfo") && item.get("deviceInfo").s() != null) {
                UserEvent.DeviceInfo deviceInfo = objectMapper.readValue(
                        item.get("deviceInfo").s(), UserEvent.DeviceInfo.class);
                event.setDeviceInfo(deviceInfo);
            }

            if (item.containsKey("userContext") && item.get("userContext").s() != null) {
                UserEvent.UserContext userContext = objectMapper.readValue(
                        item.get("userContext").s(), UserEvent.UserContext.class);
                event.setUserContext(userContext);
            }

            return event;

        } catch (Exception e) {
            logger.error("Failed to convert DynamoDB item to UserEvent: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Generate unique event ID
     */
    private String generateEventId(UserEvent event) {
        return String.format("evt_%s_%s_%d",
                event.getUserId().substring(0, Math.min(8, event.getUserId().length())),
                event.getEventType(),
                event.getTimestamp());
    }

    /**
     * Check if tables exist and are ready
     */
    public boolean areTablesReady() {
        try {
            String[] tables = {
                    tablePrefix + userEventsTable,
                    tablePrefix + userSessionsTable,
                    tablePrefix + analyticsSummaryTable
            };

            for (String tableName : tables) {
                DescribeTableRequest request = DescribeTableRequest.builder()
                        .tableName(tableName)
                        .build();

                DescribeTableResponse response = dynamoDbClient.describeTable(request);
                if (response.table().tableStatus() != TableStatus.ACTIVE) {
                    return false;
                }
            }

            return true;

        } catch (Exception e) {
            logger.error("Error checking table status: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Shutdown the executor service
     */
    public void shutdown() {
        executorService.shutdown();
    }
}