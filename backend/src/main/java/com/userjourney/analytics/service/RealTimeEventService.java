package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class RealTimeEventService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired(required = false)
    private ProductionKinesisService productionKinesisService;

    @Autowired(required = false)
    private ProductionDynamoDBService productionDynamoDBService;

    @Autowired
    private AuditLogService auditLogService;

    private static final Logger logger = LoggerFactory.getLogger(RealTimeEventService.class);
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicLong eventCounter = new AtomicLong(0);
    private final Map<String, Object> dashboardMetrics = new ConcurrentHashMap<>();

    public RealTimeEventService() {
        // Initialize dashboard metrics
        dashboardMetrics.put("totalEvents", 0L);
        dashboardMetrics.put("activeUsers", 0L);
        dashboardMetrics.put("strugglesDetected", 0L);
        dashboardMetrics.put("videoEngagements", 0L);
        dashboardMetrics.put("lastUpdated", LocalDateTime.now().toString());
    }

    public void processEvent(Map<String, Object> eventData) {
        try {
            // Process the complete data flow for production
            
            // 1. Event received from frontend
            String eventType = (String) eventData.get("eventType");
            String userId = (String) eventData.getOrDefault("userId", "anonymous");
            
            logger.info("📥 RECEIVED EVENT: type={}, user={}", eventType, userId);
            System.out.println("📥 Processing event: " + eventType + " from user: " + userId);
            
            // 2. Store in event history (production DynamoDB)
            logger.info("💾 STEP 1: Storing event in DynamoDB...");
            Map<String, Object> processedEvent = storeEventProduction(eventData);
            
            // 3. Send to Kinesis for real-time processing
            logger.info("📡 STEP 2: Sending event to Kinesis...");
            sendToKinesisProduction(processedEvent);
            
            // 4. Analyze with AI (simulating Bedrock Agent)
            logger.info("🤖 STEP 3: Analyzing with AI...");
            Map<String, Object> aiInsights = analyzeWithAI(processedEvent);
            
            // 5. Update metrics
            logger.info("📊 STEP 4: Updating metrics...");
            updateMetrics(processedEvent, aiInsights);
            
            // 6. Send real-time updates to dashboard (WebSocket)
            logger.info("📡 STEP 5: Broadcasting to dashboard...");
            broadcastToDatabase(processedEvent, aiInsights);
            
            logger.info("✅ EVENT PROCESSING COMPLETE: {}", eventType);
            
        } catch (Exception e) {
            logger.error("❌ ERROR processing event: {}", e.getMessage(), e);
            System.err.println("Error processing event: " + e.getMessage());
            auditLogService.logSecurityEvent(
                eventData.getOrDefault("userId", "unknown").toString(),
                "REALTIME_EVENT_PROCESSING_FAILED",
                "system",
                "Error: " + e.getMessage() + ", EventType: " + eventData.getOrDefault("eventType", "unknown")
            );
        }
    }

    /**
     * Process UserEvent object for production
     */
    public void processUserEvent(UserEvent event) {
        try {
            // Convert UserEvent to Map for compatibility
            Map<String, Object> eventData = new HashMap<>();
            eventData.put("eventType", event.getEventType());
            eventData.put("userId", event.getUserId());
            eventData.put("sessionId", event.getSessionId());
            eventData.put("timestamp", event.getTimestamp());
            eventData.put("eventData", event.getEventData());
            eventData.put("deviceInfo", event.getDeviceInfo());
            eventData.put("userContext", event.getUserContext());
            
            processEvent(eventData);
            
        } catch (Exception e) {
            System.err.println("Error processing UserEvent: " + e.getMessage());
            auditLogService.logSecurityEvent(
                event.getUserId(),
                "REALTIME_USER_EVENT_PROCESSING_FAILED",
                "system",
                "Error: " + e.getMessage() + ", EventType: " + event.getEventType()
            );
        }
    }

    private Map<String, Object> storeEvent(Map<String, Object> eventData) {
        Map<String, Object> processedEvent = new HashMap<>(eventData);
        processedEvent.put("eventId", "evt_" + eventCounter.incrementAndGet());
        processedEvent.put("timestamp", LocalDateTime.now().toString());
        processedEvent.put("processed", true);
        
        System.out.println("💾 Event stored with ID: " + processedEvent.get("eventId"));
        return processedEvent;
    }

    /**
     * Store event in production DynamoDB
     */
    private Map<String, Object> storeEventProduction(Map<String, Object> eventData) {
        Map<String, Object> processedEvent = new HashMap<>(eventData);
        processedEvent.put("eventId", "evt_" + eventCounter.incrementAndGet());
        processedEvent.put("timestamp", System.currentTimeMillis());
        processedEvent.put("processed", true);
        
        // Store in production DynamoDB if available
        if (productionDynamoDBService != null) {
            logger.info("💾 ProductionDynamoDBService is available, storing event...");
            try {
                UserEvent userEvent = convertMapToUserEvent(processedEvent);
                logger.info("💾 Converted to UserEvent: userId={}, eventType={}, sessionId={}", 
                    userEvent.getUserId(), userEvent.getEventType(), userEvent.getSessionId());
                
                productionDynamoDBService.storeUserEvent(userEvent)
                    .thenAccept(eventId -> {
                        logger.info("✅ Event stored in DynamoDB with ID: {}", eventId);
                        System.out.println("💾 Event stored in DynamoDB with ID: " + eventId);
                    })
                    .exceptionally(throwable -> {
                        logger.error("❌ Failed to store event in DynamoDB: {}", throwable.getMessage(), throwable);
                        System.err.println("Failed to store event in DynamoDB: " + throwable.getMessage());
                        return null;
                    });
            } catch (Exception e) {
                logger.error("❌ Error storing event in DynamoDB: {}", e.getMessage(), e);
                System.err.println("Error storing event in DynamoDB: " + e.getMessage());
            }
        } else {
            logger.warn("⚠️  ProductionDynamoDBService is NULL - event will NOT be stored in DynamoDB!");
            System.err.println("⚠️  ProductionDynamoDBService is NULL - event will NOT be stored in DynamoDB!");
        }
        
        System.out.println("💾 Event processed with ID: " + processedEvent.get("eventId"));
        return processedEvent;
    }

    /**
     * Send event to production Kinesis
     */
    private void sendToKinesisProduction(Map<String, Object> eventData) {
        if (productionKinesisService != null) {
            logger.info("📡 ProductionKinesisService is available, sending event to Kinesis...");
            try {
                UserEvent userEvent = convertMapToUserEvent(eventData);
                logger.info("📡 Converted to UserEvent for Kinesis: userId={}, eventType={}", 
                    userEvent.getUserId(), userEvent.getEventType());
                
                productionKinesisService.sendEvent(userEvent)
                    .thenAccept(sequenceNumber -> {
                        logger.info("✅ Event sent to Kinesis with sequence number: {}", sequenceNumber);
                        System.out.println("📡 Event sent to Kinesis: " + sequenceNumber);
                    })
                    .exceptionally(throwable -> {
                        logger.error("❌ Failed to send event to Kinesis: {}", throwable.getMessage(), throwable);
                        System.err.println("Failed to send event to Kinesis: " + throwable.getMessage());
                        return null;
                    });
            } catch (Exception e) {
                logger.error("❌ Error sending event to Kinesis: {}", e.getMessage(), e);
                System.err.println("Error sending event to Kinesis: " + e.getMessage());
            }
        } else {
            logger.warn("⚠️  ProductionKinesisService is NULL - event will NOT be sent to Kinesis!");
            System.err.println("⚠️  ProductionKinesisService is NULL - event will NOT be sent to Kinesis!");
        }
    }

    /**
     * Convert Map to UserEvent object
     */
    private UserEvent convertMapToUserEvent(Map<String, Object> eventData) {
        UserEvent event = new UserEvent();
        event.setEventType((String) eventData.get("eventType"));
        event.setUserId((String) eventData.get("userId"));
        event.setSessionId((String) eventData.get("sessionId"));
        
        Object timestamp = eventData.get("timestamp");
        if (timestamp instanceof Number) {
            event.setTimestamp(((Number) timestamp).longValue());
        } else {
            event.setTimestamp(System.currentTimeMillis());
        }
        
        // Set other fields if available
        if (eventData.get("eventData") instanceof UserEvent.EventData) {
            event.setEventData((UserEvent.EventData) eventData.get("eventData"));
        }
        
        if (eventData.get("deviceInfo") instanceof UserEvent.DeviceInfo) {
            event.setDeviceInfo((UserEvent.DeviceInfo) eventData.get("deviceInfo"));
        }
        
        if (eventData.get("userContext") instanceof UserEvent.UserContext) {
            event.setUserContext((UserEvent.UserContext) eventData.get("userContext"));
        }
        
        return event;
    }

    private Map<String, Object> analyzeWithAI(Map<String, Object> event) {
        Map<String, Object> insights = new HashMap<>();
        String eventType = (String) event.get("eventType");
        
        System.out.println("🤖 AI Analysis: Analyzing " + eventType);
        
        // Simulate struggle detection
        if ("struggle_signal".equals(eventType) || isStruggleEvent(event)) {
            insights.put("struggleDetected", true);
            insights.put("severity", calculateSeverity(event));
            insights.put("recommendation", "Consider showing help tooltip");
            
            System.out.println("🚨 Struggle detected with severity: " + insights.get("severity"));
        }
        
        // Simulate video engagement analysis
        if ("video_engagement".equals(eventType)) {
            insights.put("engagementScore", calculateEngagementScore(event));
            insights.put("recommendation", "User is highly engaged");
            
            System.out.println("📹 Video engagement score: " + insights.get("engagementScore"));
        }
        
        insights.put("analysisTimestamp", LocalDateTime.now().toString());
        return insights;
    }

    private boolean isStruggleEvent(Map<String, Object> event) {
        Map<String, Object> eventData = (Map<String, Object>) event.get("eventData");
        if (eventData != null) {
            Object attemptCount = eventData.get("attemptCount");
            return attemptCount instanceof Number && ((Number) attemptCount).intValue() > 2;
        }
        return false;
    }

    private String calculateSeverity(Map<String, Object> event) {
        Map<String, Object> eventData = (Map<String, Object>) event.get("eventData");
        if (eventData != null) {
            Object attemptCount = eventData.get("attemptCount");
            if (attemptCount instanceof Number) {
                int attempts = ((Number) attemptCount).intValue();
                return attempts > 5 ? "high" : attempts > 3 ? "medium" : "low";
            }
        }
        return "low";
    }

    private double calculateEngagementScore(Map<String, Object> event) {
        Map<String, Object> eventData = (Map<String, Object>) event.get("eventData");
        if (eventData != null) {
            Object completionRate = eventData.get("completionRate");
            if (completionRate instanceof Number) {
                return ((Number) completionRate).doubleValue();
            }
        }
        return Math.random() * 100; // Random score for demo
    }

    private void updateMetrics(Map<String, Object> event, Map<String, Object> insights) {
        // Update dashboard metrics
        dashboardMetrics.put("totalEvents", 
            ((Long) dashboardMetrics.get("totalEvents")) + 1);
        
        if (insights.containsKey("struggleDetected")) {
            dashboardMetrics.put("strugglesDetected", 
                ((Long) dashboardMetrics.get("strugglesDetected")) + 1);
        }
        
        if ("video_engagement".equals(event.get("eventType"))) {
            dashboardMetrics.put("videoEngagements", 
                ((Long) dashboardMetrics.get("videoEngagements")) + 1);
        }
        
        dashboardMetrics.put("lastUpdated", LocalDateTime.now().toString());
        
        System.out.println("📊 Metrics updated: " + dashboardMetrics);
    }

    private void broadcastToDatabase(Map<String, Object> event, Map<String, Object> insights) {
        // Broadcast real-time updates to connected dashboards
        Map<String, Object> update = new HashMap<>();
        update.put("type", "event_processed");
        update.put("event", event);
        update.put("insights", insights);
        update.put("metrics", dashboardMetrics);
        
        // Send to all connected dashboard clients
        messagingTemplate.convertAndSend("/topic/events", update);
        messagingTemplate.convertAndSend("/topic/metrics", dashboardMetrics);
        
        if (insights.containsKey("struggleDetected")) {
            messagingTemplate.convertAndSend("/topic/struggles", insights);
        }
        
        System.out.println("📡 Real-time update broadcasted to dashboards");
    }

    public Map<String, Object> getDashboardMetrics() {
        return new HashMap<>(dashboardMetrics);
    }
}