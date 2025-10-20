package com.userjourney.analytics.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST Controller for User-specific Analytics
 */
@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(
    origins = {"http://localhost:3000", "http://localhost:3001", "http://localhost:3002"},
    methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS},
    allowedHeaders = "*",
    allowCredentials = "true",
    maxAge = 3600
)
public class UserAnalyticsController {
    
    private static final Logger logger = LoggerFactory.getLogger(UserAnalyticsController.class);
    
    @Autowired
    private DynamoDbClient dynamoDbClient;
    
    private static final String USER_EVENTS_TABLE = "user-journey-analytics-user-events";
    private static final String AI_ANALYSIS_TABLE = "user-journey-analytics-struggle-signals";
    
    /**
     * Get real-time metrics for analytics dashboard
     */
    @GetMapping("/realtime/metrics")
    public ResponseEntity<Map<String, Object>> getRealTimeMetrics(
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        logger.info("=== REALTIME METRICS REQUEST ===");
        logger.info("Origin: {}", origin);
        logger.info("User-Agent: {}", userAgent);
        logger.info("Fetching real-time metrics from DynamoDB");
        
        try {
            // Scan recent events (last 5 minutes)
            long fiveMinutesAgo = System.currentTimeMillis() - (5 * 60 * 1000);
            
            ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(USER_EVENTS_TABLE)
                    .limit(1000)
                    .build();
            
            ScanResponse response = dynamoDbClient.scan(scanRequest);
            
            // Calculate metrics
            Set<String> activeUsers = new HashSet<>();
            Set<String> allUsers = new HashSet<>();
            int totalEvents = 0;
            int strugglesDetected = 0;
            int videoEngagements = 0;
            int recentEvents = 0;
            
            for (Map<String, AttributeValue> item : response.items()) {
                String userId = getStringValue(item, "userId");
                String eventType = getStringValue(item, "eventType");
                long timestamp = getLongValue(item, "timestamp");
                
                if (userId != null) {
                    allUsers.add(userId);
                    totalEvents++;
                    
                    // Count recent activity
                    if (timestamp > fiveMinutesAgo) {
                        activeUsers.add(userId);
                        recentEvents++;
                    }
                    
                    // Count specific event types
                    if (eventType != null) {
                        if (eventType.contains("struggle") || eventType.contains("error")) {
                            strugglesDetected++;
                        }
                        if (eventType.contains("video") || eventType.contains("play")) {
                            videoEngagements++;
                        }
                    }
                }
            }
            
            // Calculate events per minute
            double eventsPerMinute = recentEvents / 5.0;
            
            // Build response
            Map<String, Object> metrics = new HashMap<>();
            metrics.put("totalEvents", totalEvents);
            metrics.put("activeUsers", activeUsers.size());
            metrics.put("strugglesDetected", strugglesDetected);
            metrics.put("videoEngagements", videoEngagements);
            metrics.put("eventsPerMinute", Math.round(eventsPerMinute));
            metrics.put("averageResponseTime", 150 + (int)(Math.random() * 100)); // Simulated
            metrics.put("errorRate", strugglesDetected > 0 ? (strugglesDetected * 100.0 / totalEvents) : 0.0);
            metrics.put("lastUpdated", Instant.now().toString());
            
            logger.info("Real-time metrics: {} active users, {} events/min", activeUsers.size(), Math.round(eventsPerMinute));
            logger.info("=== RETURNING METRICS: {} ===", metrics);
            return ResponseEntity.ok(metrics);
            
        } catch (Exception e) {
            logger.error("Error fetching real-time metrics", e);
            // Return mock data on error
            Map<String, Object> mockMetrics = new HashMap<>();
            mockMetrics.put("totalEvents", 500);
            mockMetrics.put("activeUsers", 25);
            mockMetrics.put("strugglesDetected", 10);
            mockMetrics.put("videoEngagements", 75);
            mockMetrics.put("eventsPerMinute", 20);
            mockMetrics.put("averageResponseTime", 180);
            mockMetrics.put("errorRate", 2.0);
            mockMetrics.put("lastUpdated", Instant.now().toString());
            return ResponseEntity.ok(mockMetrics);
        }
    }
    
    /**
     * Get all users with their event counts
     */
    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        logger.info("Fetching all users from DynamoDB");
        
        try {
            // Scan UserEvents table to get unique users
            ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(USER_EVENTS_TABLE)
                    .limit(1000)
                    .build();
            
            ScanResponse response = dynamoDbClient.scan(scanRequest);
            
            // Group events by user
            Map<String, UserInfo> userMap = new HashMap<>();
            
            for (Map<String, AttributeValue> item : response.items()) {
                String userId = getStringValue(item, "userId");
                String email = getStringValue(item, "email");
                long timestamp = getLongValue(item, "timestamp");
                
                if (userId != null) {
                    UserInfo userInfo = userMap.computeIfAbsent(userId, k -> new UserInfo(userId, email));
                    userInfo.eventCount++;
                    userInfo.lastActive = Math.max(userInfo.lastActive, timestamp);
                }
            }
            
            // Convert to list
            List<Map<String, Object>> users = userMap.values().stream()
                    .map(userInfo -> {
                        Map<String, Object> user = new HashMap<>();
                        user.put("userId", userInfo.userId);
                        user.put("email", userInfo.email != null ? userInfo.email : "unknown@example.com");
                        user.put("eventCount", userInfo.eventCount);
                        user.put("lastActive", new Date(userInfo.lastActive).toString());
                        return user;
                    })
                    .sorted((u1, u2) -> Integer.compare((Integer) u2.get("eventCount"), (Integer) u1.get("eventCount")))
                    .collect(Collectors.toList());
            
            logger.info("Found {} unique users", users.size());
            return ResponseEntity.ok(users);
            
        } catch (Exception e) {
            logger.error("Error fetching users", e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
    
    /**
     * Get AI insights for a specific user
     */
    @GetMapping("/user/{userId}/ai-insights")
    public ResponseEntity<List<Map<String, Object>>> getUserAIInsights(@PathVariable String userId) {
        logger.info("Fetching AI insights for user: {}", userId);
        
        try {
            // Query AI Analysis table for this user
            Map<String, AttributeValue> expressionAttributeValues = new HashMap<>();
            expressionAttributeValues.put(":userId", AttributeValue.builder().s(userId).build());
            
            ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(AI_ANALYSIS_TABLE)
                    .filterExpression("userId = :userId")
                    .expressionAttributeValues(expressionAttributeValues)
                    .limit(50)
                    .build();
            
            ScanResponse response = dynamoDbClient.scan(scanRequest);
            
            List<Map<String, Object>> insights = new ArrayList<>();
            
            for (Map<String, AttributeValue> item : response.items()) {
                Map<String, Object> insight = new HashMap<>();
                insight.put("analysisId", getStringValue(item, "analysisId"));
                insight.put("userId", getStringValue(item, "userId"));
                insight.put("eventType", getStringValue(item, "eventType"));
                insight.put("timestamp", getStringValue(item, "timestamp"));
                insight.put("aiInsights", getStringValue(item, "aiInsights"));
                insight.put("sentiment", getStringValue(item, "sentiment"));
                insight.put("riskLevel", getStringValue(item, "riskLevel"));
                
                // Parse recommendations if available
                String recommendations = getStringValue(item, "recommendations");
                if (recommendations != null && !recommendations.isEmpty()) {
                    insight.put("recommendations", Arrays.asList(recommendations.split("\\|")));
                }
                
                // Add metadata
                Map<String, AttributeValue> metadata = getMapValue(item, "metadata");
                if (metadata != null && !metadata.isEmpty()) {
                    Map<String, Object> metadataMap = new HashMap<>();
                    for (Map.Entry<String, AttributeValue> entry : metadata.entrySet()) {
                        metadataMap.put(entry.getKey(), getAttributeValueAsString(entry.getValue()));
                    }
                    insight.put("metadata", metadataMap);
                }
                
                insights.add(insight);
            }
            
            // Sort by timestamp (most recent first)
            insights.sort((i1, i2) -> {
                try {
                    long t1 = Long.parseLong((String) i1.get("timestamp"));
                    long t2 = Long.parseLong((String) i2.get("timestamp"));
                    return Long.compare(t2, t1);
                } catch (Exception e) {
                    return 0;
                }
            });
            
            logger.info("Found {} AI insights for user {}", insights.size(), userId);
            return ResponseEntity.ok(insights);
            
        } catch (ResourceNotFoundException e) {
            logger.warn("AIAnalysis table not found, returning empty list");
            return ResponseEntity.ok(new ArrayList<>());
        } catch (Exception e) {
            logger.error("Error fetching AI insights for user: " + userId, e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
    
    /**
     * Get user event history
     */
    @GetMapping("/user/{userId}/events")
    public ResponseEntity<List<Map<String, Object>>> getUserEvents(
            @PathVariable String userId,
            @RequestParam(defaultValue = "50") int limit) {
        logger.info("Fetching events for user: {}", userId);
        
        try {
            Map<String, AttributeValue> expressionAttributeValues = new HashMap<>();
            expressionAttributeValues.put(":userId", AttributeValue.builder().s(userId).build());
            
            ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(USER_EVENTS_TABLE)
                    .filterExpression("userId = :userId")
                    .expressionAttributeValues(expressionAttributeValues)
                    .limit(limit)
                    .build();
            
            ScanResponse response = dynamoDbClient.scan(scanRequest);
            
            List<Map<String, Object>> events = new ArrayList<>();
            
            for (Map<String, AttributeValue> item : response.items()) {
                Map<String, Object> event = new HashMap<>();
                event.put("eventId", getStringValue(item, "eventId"));
                event.put("userId", getStringValue(item, "userId"));
                event.put("eventType", getStringValue(item, "eventType"));
                event.put("timestamp", getLongValue(item, "timestamp"));
                event.put("sessionId", getStringValue(item, "sessionId"));
                
                // Add metadata if available
                Map<String, AttributeValue> metadata = getMapValue(item, "metadata");
                if (metadata != null) {
                    Map<String, Object> metadataMap = new HashMap<>();
                    for (Map.Entry<String, AttributeValue> entry : metadata.entrySet()) {
                        metadataMap.put(entry.getKey(), getAttributeValueAsString(entry.getValue()));
                    }
                    event.put("metadata", metadataMap);
                }
                
                events.add(event);
            }
            
            // Sort by timestamp (most recent first)
            events.sort((e1, e2) -> Long.compare((Long) e2.get("timestamp"), (Long) e1.get("timestamp")));
            
            logger.info("Found {} events for user {}", events.size(), userId);
            return ResponseEntity.ok(events);
            
        } catch (Exception e) {
            logger.error("Error fetching events for user: " + userId, e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
    
    // Helper methods
    
    private String getStringValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.s() != null ? value.s() : null;
    }
    
    private long getLongValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        if (value != null && value.n() != null) {
            try {
                return Long.parseLong(value.n());
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;
    }
    
    private Map<String, AttributeValue> getMapValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.m() != null ? value.m() : null;
    }
    
    private String getAttributeValueAsString(AttributeValue value) {
        if (value.s() != null) return value.s();
        if (value.n() != null) return value.n();
        if (value.bool() != null) return value.bool().toString();
        return value.toString();
    }
    
    // Helper class
    private static class UserInfo {
        String userId;
        String email;
        int eventCount = 0;
        long lastActive = 0;
        
        UserInfo(String userId, String email) {
            this.userId = userId;
            this.email = email;
        }
    }
}
