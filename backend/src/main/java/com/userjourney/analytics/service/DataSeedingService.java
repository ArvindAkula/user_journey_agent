package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.model.UserProfile;
import com.userjourney.analytics.model.VideoEngagement;
import com.userjourney.analytics.model.StruggleSignal;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class DataSeedingService {
    
    private static final Logger logger = LoggerFactory.getLogger(DataSeedingService.class);
    
    @Autowired
    private DynamoDbClient dynamoDbClient;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    private static final String[] USER_SEGMENTS = {"new_user", "active_user", "at_risk", "power_user"};
    private static final String[] PLATFORMS = {"iOS", "Android", "Web"};
    private static final String[] EVENT_TYPES = {"page_view", "video_engagement", "feature_interaction", "struggle_signal"};
    private static final String[] VIDEO_IDS = {
        "getting_started_guide", "advanced_features", "tips_tricks", 
        "common_mistakes", "success_stories", "tutorial_basics",
        "feature_deep_dive", "troubleshooting", "best_practices", "case_studies"
    };
    private static final String[] FEATURES = {
        "document_upload", "calculator", "form_submission", "video_player",
        "search", "profile_setup", "settings", "dashboard", "reports", "export"
    };
    
    /**
     * Seed sample users with realistic profiles
     */
    public void seedSampleUsers(int userCount) {
        logger.info("Starting to seed {} sample users", userCount);
        
        try {
            for (int i = 0; i < userCount; i++) {
                UserProfile user = generateSampleUser(i);
                saveUserProfile(user);
                
                // Generate historical events for each user
                generateUserHistory(user.getUserId(), 30); // 30 days of history
            }
            
            logger.info("Successfully seeded {} users with historical data", userCount);
        } catch (Exception e) {
            logger.error("Error seeding sample users", e);
            throw new RuntimeException("Failed to seed sample users", e);
        }
    }
    
    /**
     * Generate realistic user behavior simulation
     */
    public void simulateUserBehavior(String userId, int eventCount) {
        logger.info("Simulating {} events for user {}", eventCount, userId);
        
        try {
            String sessionId = UUID.randomUUID().toString();
            List<String> sessionActions = new ArrayList<>();
            
            for (int i = 0; i < eventCount; i++) {
                UserEvent event = generateRealisticEvent(userId, sessionId, sessionActions);
                sessionActions.add(event.getEventType());
                saveUserEvent(event);
                
                // Simulate time between events (1-30 seconds)
                Thread.sleep(ThreadLocalRandom.current().nextInt(1000, 5000));
            }
            
            logger.info("Successfully simulated {} events for user {}", eventCount, userId);
        } catch (Exception e) {
            logger.error("Error simulating user behavior for user {}", userId, e);
            throw new RuntimeException("Failed to simulate user behavior", e);
        }
    }
    
    /**
     * Generate different user journey patterns
     */
    public void generateJourneyScenarios() {
        logger.info("Generating predefined user journey scenarios");
        
        try {
            // Scenario 1: Struggling new user
            generateStruggleScenario("struggle_user_001");
            
            // Scenario 2: Engaged video watcher
            generateVideoEngagementScenario("video_user_001");
            
            // Scenario 3: High-risk user about to churn
            generateChurnRiskScenario("churn_risk_001");
            
            // Scenario 4: Power user with high engagement
            generatePowerUserScenario("power_user_001");
            
            // Scenario 5: Mobile-first user
            generateMobileUserScenario("mobile_user_001");
            
            logger.info("Successfully generated all journey scenarios");
        } catch (Exception e) {
            logger.error("Error generating journey scenarios", e);
            throw new RuntimeException("Failed to generate journey scenarios", e);
        }
    }
    
    /**
     * Reset demo data to clean state
     */
    public void resetDemoData() {
        logger.info("Resetting demo data to clean state");
        
        try {
            // Clear existing demo data
            clearDemoUsers();
            
            // Reseed with fresh data
            seedSampleUsers(50);
            generateJourneyScenarios();
            
            logger.info("Demo data reset completed successfully");
        } catch (Exception e) {
            logger.error("Error resetting demo data", e);
            throw new RuntimeException("Failed to reset demo data", e);
        }
    }
    
    /**
     * Generate performance testing data
     */
    public void generatePerformanceTestData(int userCount, int eventsPerUser) {
        logger.info("Generating performance test data: {} users, {} events each", userCount, eventsPerUser);
        
        try {
            List<String> userIds = new ArrayList<>();
            
            // Create users in batches
            for (int i = 0; i < userCount; i++) {
                String userId = "perf_test_user_" + String.format("%06d", i);
                userIds.add(userId);
                
                UserProfile user = generateSampleUser(userId);
                saveUserProfile(user);
                
                if (i % 100 == 0) {
                    logger.info("Created {} performance test users", i);
                }
            }
            
            // Generate events in parallel batches
            userIds.parallelStream().forEach(userId -> {
                try {
                    generateBulkEvents(userId, eventsPerUser);
                } catch (Exception e) {
                    logger.error("Error generating events for user {}", userId, e);
                }
            });
            
            logger.info("Performance test data generation completed");
        } catch (Exception e) {
            logger.error("Error generating performance test data", e);
            throw new RuntimeException("Failed to generate performance test data", e);
        }
    }
    
    // Private helper methods
    
    private UserProfile generateSampleUser(int index) {
        return generateSampleUser("demo_user_" + String.format("%03d", index));
    }
    
    private UserProfile generateSampleUser(String userId) {
        UserProfile user = new UserProfile();
        user.setUserId(userId);
        user.setCreatedAt(Instant.now().minus(ThreadLocalRandom.current().nextInt(1, 90), ChronoUnit.DAYS));
        user.setLastActiveAt(Instant.now().minus(ThreadLocalRandom.current().nextInt(0, 7), ChronoUnit.DAYS));
        user.setUserSegment(USER_SEGMENTS[ThreadLocalRandom.current().nextInt(USER_SEGMENTS.length)]);
        
        // Set preferences
        UserProfile.Preferences preferences = new UserProfile.Preferences();
        preferences.setContentCategories(Arrays.asList("tutorial", "advanced", "tips"));
        preferences.setVideoTopics(Arrays.asList("getting_started", "features", "troubleshooting"));
        preferences.setPreferredInteractionStyle("guided");
        user.setPreferences(preferences);
        
        // Set behavior metrics
        UserProfile.BehaviorMetrics metrics = new UserProfile.BehaviorMetrics();
        metrics.setTotalSessions(ThreadLocalRandom.current().nextInt(1, 50));
        metrics.setAvgSessionDuration(ThreadLocalRandom.current().nextDouble(60, 1800)); // 1-30 minutes
        metrics.setFeatureAdoptionRate(ThreadLocalRandom.current().nextDouble(0.1, 0.9));
        metrics.setSupportInteractionCount(ThreadLocalRandom.current().nextInt(0, 5));
        user.setBehaviorMetrics(metrics);
        
        // Set risk factors
        UserProfile.RiskFactors riskFactors = new UserProfile.RiskFactors();
        riskFactors.setExitRiskScore(ThreadLocalRandom.current().nextDouble(0, 100));
        riskFactors.setLastRiskAssessment(Instant.now());
        riskFactors.setRiskContributors(Arrays.asList("low_engagement", "support_tickets"));
        user.setRiskFactors(riskFactors);
        
        user.setInterventionHistory(new ArrayList<>());
        
        return user;
    }
    
    private void generateUserHistory(String userId, int days) {
        for (int day = days; day >= 0; day--) {
            Instant eventTime = Instant.now().minus(day, ChronoUnit.DAYS);
            int eventsPerDay = ThreadLocalRandom.current().nextInt(5, 25);
            
            String sessionId = UUID.randomUUID().toString();
            List<String> sessionActions = new ArrayList<>();
            
            for (int i = 0; i < eventsPerDay; i++) {
                UserEvent event = generateHistoricalEvent(userId, sessionId, eventTime, sessionActions);
                sessionActions.add(event.getEventType());
                saveUserEvent(event);
                
                // Add random minutes between events
                eventTime = eventTime.plus(ThreadLocalRandom.current().nextInt(1, 30), ChronoUnit.MINUTES);
            }
        }
    }
    
    private UserEvent generateRealisticEvent(String userId, String sessionId, List<String> previousActions) {
        UserEvent event = new UserEvent();
        event.setUserId(userId);
        event.setSessionId(sessionId);
        event.setTimestamp(Instant.now().toEpochMilli());
        
        // Choose event type based on previous actions (realistic flow)
        String eventType = chooseRealisticEventType(previousActions);
        event.setEventType(eventType);
        
        // Set device info
        UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
        deviceInfo.setPlatform(PLATFORMS[ThreadLocalRandom.current().nextInt(PLATFORMS.length)]);
        deviceInfo.setAppVersion("1.0." + ThreadLocalRandom.current().nextInt(1, 10));
        deviceInfo.setDeviceModel("Device_" + ThreadLocalRandom.current().nextInt(1, 100));
        event.setDeviceInfo(deviceInfo);
        
        // Set user context
        UserEvent.UserContext userContext = new UserEvent.UserContext();
        userContext.setUserSegment(USER_SEGMENTS[ThreadLocalRandom.current().nextInt(USER_SEGMENTS.length)]);
        userContext.setSessionStage(determineSessionStage(previousActions.size()));
        userContext.setPreviousActions(new ArrayList<>(previousActions));
        event.setUserContext(userContext);
        
        // Set event-specific data
        UserEvent.EventData eventData = generateEventData(eventType);
        event.setEventData(eventData);
        
        return event;
    }
    
    private UserEvent generateHistoricalEvent(String userId, String sessionId, Instant timestamp, List<String> sessionActions) {
        UserEvent event = generateRealisticEvent(userId, sessionId, sessionActions);
        event.setTimestamp(timestamp.toEpochMilli());
        return event;
    }
    
    private String chooseRealisticEventType(List<String> previousActions) {
        if (previousActions.isEmpty()) {
            return "page_view"; // Always start with page view
        }
        
        String lastAction = previousActions.get(previousActions.size() - 1);
        
        // Create realistic flow patterns
        switch (lastAction) {
            case "page_view":
                return ThreadLocalRandom.current().nextBoolean() ? "video_engagement" : "feature_interaction";
            case "video_engagement":
                return ThreadLocalRandom.current().nextDouble() < 0.3 ? "struggle_signal" : "feature_interaction";
            case "feature_interaction":
                return ThreadLocalRandom.current().nextDouble() < 0.2 ? "struggle_signal" : "page_view";
            case "struggle_signal":
                return "feature_interaction"; // Usually retry after struggle
            default:
                return EVENT_TYPES[ThreadLocalRandom.current().nextInt(EVENT_TYPES.length)];
        }
    }
    
    private String determineSessionStage(int actionCount) {
        if (actionCount < 3) return "onboarding";
        if (actionCount < 10) return "exploration";
        if (actionCount < 20) return "engagement";
        return "completion";
    }
    
    private UserEvent.EventData generateEventData(String eventType) {
        UserEvent.EventData eventData = new UserEvent.EventData();
        
        switch (eventType) {
            case "video_engagement":
                eventData.setVideoId(VIDEO_IDS[ThreadLocalRandom.current().nextInt(VIDEO_IDS.length)]);
                eventData.setWatchDuration(ThreadLocalRandom.current().nextInt(30, 600));
                eventData.setCompletionRate(ThreadLocalRandom.current().nextDouble(0.1, 1.0));
                eventData.setPlaybackSpeed(1.0 + ThreadLocalRandom.current().nextDouble(-0.5, 1.0));
                break;
                
            case "feature_interaction":
                eventData.setFeature(FEATURES[ThreadLocalRandom.current().nextInt(FEATURES.length)]);
                eventData.setDuration(ThreadLocalRandom.current().nextInt(10, 300));
                break;
                
            case "struggle_signal":
                eventData.setFeature(FEATURES[ThreadLocalRandom.current().nextInt(FEATURES.length)]);
                eventData.setAttemptCount(ThreadLocalRandom.current().nextInt(2, 6));
                eventData.setErrorType("validation_error");
                break;
                
            case "page_view":
                eventData.setDuration(ThreadLocalRandom.current().nextInt(5, 120));
                break;
        }
        
        return eventData;
    }  
  
    private void generateStruggleScenario(String userId) {
        UserProfile user = generateSampleUser(userId);
        user.setUserSegment("new_user");
        user.getRiskFactors().setExitRiskScore(75.0);
        saveUserProfile(user);
        
        String sessionId = UUID.randomUUID().toString();
        
        // Generate struggle pattern: multiple failed attempts at document upload
        for (int i = 0; i < 5; i++) {
            UserEvent event = new UserEvent();
            event.setUserId(userId);
            event.setSessionId(sessionId);
            event.setEventType("struggle_signal");
            event.setTimestamp(Instant.now().minus(i * 2, ChronoUnit.MINUTES).toEpochMilli());
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature("document_upload");
            eventData.setAttemptCount(i + 1);
            eventData.setErrorType("file_size_exceeded");
            event.setEventData(eventData);
            
            setDefaultEventFields(event, userId, sessionId);
            saveUserEvent(event);
        }
    }
    
    private void generateVideoEngagementScenario(String userId) {
        UserProfile user = generateSampleUser(userId);
        user.setUserSegment("active_user");
        user.getRiskFactors().setExitRiskScore(25.0);
        saveUserProfile(user);
        
        String sessionId = UUID.randomUUID().toString();
        
        // Generate high video engagement pattern
        for (String videoId : Arrays.asList("getting_started_guide", "advanced_features", "tips_tricks")) {
            UserEvent event = new UserEvent();
            event.setUserId(userId);
            event.setSessionId(sessionId);
            event.setEventType("video_engagement");
            event.setTimestamp(Instant.now().minus(ThreadLocalRandom.current().nextInt(1, 60), ChronoUnit.MINUTES).toEpochMilli());
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setVideoId(videoId);
            eventData.setWatchDuration(ThreadLocalRandom.current().nextInt(180, 600));
            eventData.setCompletionRate(ThreadLocalRandom.current().nextDouble(0.8, 1.0));
            eventData.setPlaybackSpeed(1.0);
            event.setEventData(eventData);
            
            setDefaultEventFields(event, userId, sessionId);
            saveUserEvent(event);
        }
    }
    
    private void generateChurnRiskScenario(String userId) {
        UserProfile user = generateSampleUser(userId);
        user.setUserSegment("at_risk");
        user.setLastActiveAt(Instant.now().minus(5, ChronoUnit.DAYS));
        user.getRiskFactors().setExitRiskScore(85.0);
        user.getRiskFactors().setRiskContributors(Arrays.asList("low_engagement", "multiple_struggles", "no_recent_activity"));
        saveUserProfile(user);
        
        // Generate declining engagement pattern
        for (int day = 7; day >= 5; day--) {
            String sessionId = UUID.randomUUID().toString();
            UserEvent event = new UserEvent();
            event.setUserId(userId);
            event.setSessionId(sessionId);
            event.setEventType("page_view");
            event.setTimestamp(Instant.now().minus(day, ChronoUnit.DAYS).toEpochMilli());
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setDuration(ThreadLocalRandom.current().nextInt(5, 30)); // Very short sessions
            event.setEventData(eventData);
            
            setDefaultEventFields(event, userId, sessionId);
            saveUserEvent(event);
        }
    }
    
    private void generatePowerUserScenario(String userId) {
        UserProfile user = generateSampleUser(userId);
        user.setUserSegment("power_user");
        user.getRiskFactors().setExitRiskScore(10.0);
        user.getBehaviorMetrics().setFeatureAdoptionRate(0.95);
        user.getBehaviorMetrics().setTotalSessions(100);
        saveUserProfile(user);
        
        String sessionId = UUID.randomUUID().toString();
        
        // Generate high engagement across all features
        for (String feature : FEATURES) {
            UserEvent event = new UserEvent();
            event.setUserId(userId);
            event.setSessionId(sessionId);
            event.setEventType("feature_interaction");
            event.setTimestamp(Instant.now().minus(ThreadLocalRandom.current().nextInt(1, 30), ChronoUnit.MINUTES).toEpochMilli());
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature(feature);
            eventData.setDuration(ThreadLocalRandom.current().nextInt(60, 300));
            event.setEventData(eventData);
            
            setDefaultEventFields(event, userId, sessionId);
            saveUserEvent(event);
        }
    }
    
    private void generateMobileUserScenario(String userId) {
        UserProfile user = generateSampleUser(userId);
        user.setUserSegment("active_user");
        user.getPreferences().setPreferredInteractionStyle("self_service");
        saveUserProfile(user);
        
        String sessionId = UUID.randomUUID().toString();
        
        // Generate mobile-specific interaction patterns
        for (int i = 0; i < 10; i++) {
            UserEvent event = new UserEvent();
            event.setUserId(userId);
            event.setSessionId(sessionId);
            event.setEventType(EVENT_TYPES[ThreadLocalRandom.current().nextInt(EVENT_TYPES.length)]);
            event.setTimestamp(Instant.now().minus(i * 5, ChronoUnit.MINUTES).toEpochMilli());
            
            // Force mobile platform
            UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
            deviceInfo.setPlatform(ThreadLocalRandom.current().nextBoolean() ? "iOS" : "Android");
            deviceInfo.setAppVersion("1.0.5");
            deviceInfo.setDeviceModel("Mobile_Device");
            event.setDeviceInfo(deviceInfo);
            
            UserEvent.EventData eventData = generateEventData(event.getEventType());
            event.setEventData(eventData);
            
            UserEvent.UserContext userContext = new UserEvent.UserContext();
            userContext.setUserSegment("active_user");
            userContext.setSessionStage("engagement");
            userContext.setPreviousActions(Arrays.asList("app_launch", "navigation"));
            event.setUserContext(userContext);
            
            saveUserEvent(event);
        }
    }
    
    private void generateBulkEvents(String userId, int eventCount) {
        String sessionId = UUID.randomUUID().toString();
        List<String> sessionActions = new ArrayList<>();
        
        for (int i = 0; i < eventCount; i++) {
            UserEvent event = generateRealisticEvent(userId, sessionId, sessionActions);
            sessionActions.add(event.getEventType());
            saveUserEvent(event);
        }
    }
    
    private void setDefaultEventFields(UserEvent event, String userId, String sessionId) {
        UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
        deviceInfo.setPlatform("Web");
        deviceInfo.setAppVersion("1.0.0");
        deviceInfo.setDeviceModel("Desktop");
        event.setDeviceInfo(deviceInfo);
        
        UserEvent.UserContext userContext = new UserEvent.UserContext();
        userContext.setUserSegment("demo_user");
        userContext.setSessionStage("demonstration");
        userContext.setPreviousActions(Arrays.asList("demo_start"));
        event.setUserContext(userContext);
    }
    
    private void clearDemoUsers() {
        try {
            // Scan and delete demo users from UserProfiles table
            ScanRequest scanRequest = ScanRequest.builder()
                .tableName("UserProfiles")
                .filterExpression("begins_with(userId, :prefix)")
                .expressionAttributeValues(Map.of(":prefix", AttributeValue.builder().s("demo_").build()))
                .build();
                
            ScanResponse scanResponse = dynamoDbClient.scan(scanRequest);
            
            for (Map<String, AttributeValue> item : scanResponse.items()) {
                DeleteItemRequest deleteRequest = DeleteItemRequest.builder()
                    .tableName("UserProfiles")
                    .key(Map.of("userId", item.get("userId")))
                    .build();
                dynamoDbClient.deleteItem(deleteRequest);
            }
            
            // Clear demo events from UserEvents table
            scanRequest = ScanRequest.builder()
                .tableName("UserEvents")
                .filterExpression("begins_with(userId, :prefix)")
                .expressionAttributeValues(Map.of(":prefix", AttributeValue.builder().s("demo_").build()))
                .build();
                
            scanResponse = dynamoDbClient.scan(scanRequest);
            
            for (Map<String, AttributeValue> item : scanResponse.items()) {
                DeleteItemRequest deleteRequest = DeleteItemRequest.builder()
                    .tableName("UserEvents")
                    .key(Map.of(
                        "userId", item.get("userId"),
                        "timestamp", item.get("timestamp")
                    ))
                    .build();
                dynamoDbClient.deleteItem(deleteRequest);
            }
            
            logger.info("Cleared existing demo data");
        } catch (Exception e) {
            logger.error("Error clearing demo data", e);
            throw new RuntimeException("Failed to clear demo data", e);
        }
    }
    
    private void saveUserProfile(UserProfile user) {
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("userId", AttributeValue.builder().s(user.getUserId()).build());
            item.put("createdAt", AttributeValue.builder().s(user.getCreatedAt().toString()).build());
            item.put("lastActiveAt", AttributeValue.builder().s(user.getLastActiveAt().toString()).build());
            item.put("userSegment", AttributeValue.builder().s(user.getUserSegment()).build());
            
            // Convert complex objects to JSON strings
            if (user.getPreferences() != null) {
                item.put("preferences", AttributeValue.builder().s(objectMapper.writeValueAsString(user.getPreferences())).build());
            }
            if (user.getBehaviorMetrics() != null) {
                item.put("behaviorMetrics", AttributeValue.builder().s(objectMapper.writeValueAsString(user.getBehaviorMetrics())).build());
            }
            if (user.getRiskFactors() != null) {
                item.put("riskFactors", AttributeValue.builder().s(objectMapper.writeValueAsString(user.getRiskFactors())).build());
            }
            if (user.getInterventionHistory() != null) {
                item.put("interventionHistory", AttributeValue.builder().s(objectMapper.writeValueAsString(user.getInterventionHistory())).build());
            }
            
            PutItemRequest putRequest = PutItemRequest.builder()
                .tableName("UserProfiles")
                .item(item)
                .build();
                
            dynamoDbClient.putItem(putRequest);
        } catch (Exception e) {
            logger.error("Error saving user profile for user {}", user.getUserId(), e);
            throw new RuntimeException("Failed to save user profile", e);
        }
    }
    
    private void saveUserEvent(UserEvent event) {
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("userId", AttributeValue.builder().s(event.getUserId()).build());
            item.put("timestamp", AttributeValue.builder().n(event.getTimestamp().toString()).build());
            item.put("sessionId", AttributeValue.builder().s(event.getSessionId()).build());
            item.put("eventType", AttributeValue.builder().s(event.getEventType()).build());
            
            // Convert complex objects to JSON strings
            if (event.getEventData() != null) {
                item.put("eventData", AttributeValue.builder().s(objectMapper.writeValueAsString(event.getEventData())).build());
            }
            if (event.getDeviceInfo() != null) {
                item.put("deviceInfo", AttributeValue.builder().s(objectMapper.writeValueAsString(event.getDeviceInfo())).build());
            }
            if (event.getUserContext() != null) {
                item.put("userContext", AttributeValue.builder().s(objectMapper.writeValueAsString(event.getUserContext())).build());
            }
            
            // Add TTL (30 days from now)
            long ttl = Instant.now().plus(30, ChronoUnit.DAYS).getEpochSecond();
            item.put("ttl", AttributeValue.builder().n(String.valueOf(ttl)).build());
            
            PutItemRequest putRequest = PutItemRequest.builder()
                .tableName("UserEvents")
                .item(item)
                .build();
                
            dynamoDbClient.putItem(putRequest);
        } catch (Exception e) {
            logger.error("Error saving user event for user {}", event.getUserId(), e);
            throw new RuntimeException("Failed to save user event", e);
        }
    }
}