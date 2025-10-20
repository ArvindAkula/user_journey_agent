package com.userjourney.analytics.demo;

import com.userjourney.analytics.model.ExitRiskFeatures;
import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.service.FeatureEngineeringService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Demonstration of predictive analytics functionality
 */
public class PredictiveAnalyticsDemo {
    
    private static final Logger logger = LoggerFactory.getLogger(PredictiveAnalyticsDemo.class);
    
    public static void main(String[] args) {
        logger.info("Starting Predictive Analytics Demo...");
        
        PredictiveAnalyticsDemo demo = new PredictiveAnalyticsDemo();
        demo.runDemo();
        
        logger.info("Predictive Analytics Demo completed successfully!");
    }
    
    public void runDemo() {
        // Initialize services
        FeatureEngineeringService featureService = new FeatureEngineeringService();
        
        // Demo 1: Feature Engineering
        logger.info("=== Demo 1: Feature Engineering ===");
        demonstrateFeatureEngineering(featureService);
        
        // Demo 2: Training Dataset Creation
        logger.info("=== Demo 2: Training Dataset Creation ===");
        demonstrateTrainingDatasetCreation(featureService);
        
        // Demo 3: Feature Validation
        logger.info("=== Demo 3: Feature Validation ===");
        demonstrateFeatureValidation(featureService);
        
        // Demo 4: Feature Array Conversion
        logger.info("=== Demo 4: Feature Array Conversion ===");
        demonstrateFeatureArrayConversion();
    }
    
    private void demonstrateFeatureEngineering(FeatureEngineeringService featureService) {
        String userId = "demo_user_001";
        List<UserEvent> userEvents = createDemoUserEvents(userId);
        
        logger.info("Extracting features for user: {}", userId);
        logger.info("Number of events: {}", userEvents.size());
        
        ExitRiskFeatures features = featureService.extractExitRiskFeatures(userId, userEvents, null);
        
        logger.info("Extracted Features:");
        logger.info("  User ID: {}", features.getUserId());
        logger.info("  Struggle Signals (7d): {}", features.getStruggleSignalCount7d());
        logger.info("  Video Engagement Score: {:.2f}%", features.getVideoEngagementScore());
        logger.info("  Feature Completion Rate: {:.2f}%", features.getFeatureCompletionRate());
        logger.info("  Session Frequency Trend: {:.3f}", features.getSessionFrequencyTrend());
        logger.info("  Days Since Last Login: {}", features.getDaysSinceLastLogin());
        logger.info("  Application Progress: {:.2f}%", features.getApplicationProgressPercentage());
        logger.info("  Average Session Duration: {:.1f} seconds", features.getAvgSessionDuration());
        logger.info("  Total Sessions: {}", features.getTotalSessions());
        logger.info("  Error Rate: {:.2f}%", features.getErrorRate());
        logger.info("  Content Engagement Score: {:.2f}%", features.getContentEngagementScore());
        logger.info("  Platform Usage Pattern: {}", features.getPlatformUsagePattern());
    }
    
    private void demonstrateTrainingDatasetCreation(FeatureEngineeringService featureService) {
        // Create historical data for multiple users
        Map<String, List<UserEvent>> historicalEvents = new HashMap<>();
        Map<String, Boolean> exitLabels = new HashMap<>();
        
        // User 1: High engagement, no exit
        String user1 = "user_001";
        historicalEvents.put(user1, createHighEngagementEvents(user1));
        exitLabels.put(user1, false);
        
        // User 2: Low engagement, exited
        String user2 = "user_002";
        historicalEvents.put(user2, createLowEngagementEvents(user2));
        exitLabels.put(user2, true);
        
        // User 3: Medium engagement, no exit
        String user3 = "user_003";
        historicalEvents.put(user3, createMediumEngagementEvents(user3));
        exitLabels.put(user3, false);
        
        logger.info("Creating training dataset from {} users", historicalEvents.size());
        
        List<ExitRiskFeatures> trainingData = featureService.createTrainingDataset(
            historicalEvents, new HashMap<>(), exitLabels
        );
        
        logger.info("Training dataset created with {} samples", trainingData.size());
        
        for (ExitRiskFeatures features : trainingData) {
            logger.info("  User: {}, Exit Label: {}, Risk Indicators: Struggles={}, VideoEng={:.1f}, Completion={:.1f}",
                features.getUserId(),
                features.getExitedWithin72h(),
                features.getStruggleSignalCount7d(),
                features.getVideoEngagementScore(),
                features.getFeatureCompletionRate()
            );
        }
    }
    
    private void demonstrateFeatureValidation(FeatureEngineeringService featureService) {
        // Test valid features
        ExitRiskFeatures validFeatures = createValidFeatures("valid_user");
        boolean isValid = featureService.validateFeatures(validFeatures);
        logger.info("Valid features validation result: {}", isValid);
        
        // Test invalid features
        ExitRiskFeatures invalidFeatures = new ExitRiskFeatures();
        invalidFeatures.setUserId(null); // Invalid
        boolean isInvalid = featureService.validateFeatures(invalidFeatures);
        logger.info("Invalid features validation result: {}", isInvalid);
        
        // Test features with negative values
        ExitRiskFeatures negativeFeatures = createValidFeatures("negative_user");
        negativeFeatures.setStruggleSignalCount7d(-1); // Invalid
        boolean isNegative = featureService.validateFeatures(negativeFeatures);
        logger.info("Negative features validation result: {}", isNegative);
    }
    
    private void demonstrateFeatureArrayConversion() {
        ExitRiskFeatures features = createValidFeatures("array_user");
        
        logger.info("Converting features to array format for ML model...");
        double[] featureArray = features.toFeatureArray();
        
        logger.info("Feature array length: {}", featureArray.length);
        logger.info("Feature names: {}", Arrays.toString(ExitRiskFeatures.getFeatureNames()));
        logger.info("Feature values: {}", Arrays.toString(featureArray));
        
        // Verify no invalid values
        boolean hasInvalidValues = false;
        for (double value : featureArray) {
            if (Double.isNaN(value) || Double.isInfinite(value)) {
                hasInvalidValues = true;
                break;
            }
        }
        logger.info("Contains invalid values (NaN/Infinite): {}", hasInvalidValues);
    }
    
    // Helper methods to create test data
    
    private List<UserEvent> createDemoUserEvents(String userId) {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Page views
        events.add(createEvent(userId, "page_view", "session_1", now.minus(2, ChronoUnit.HOURS), null));
        events.add(createEvent(userId, "page_view", "session_1", now.minus(90, ChronoUnit.MINUTES), null));
        
        // Feature interactions
        UserEvent.EventData featureData = new UserEvent.EventData();
        featureData.setFeature("document_upload");
        featureData.setAttemptCount(1);
        events.add(createEvent(userId, "feature_interaction", "session_1", now.minus(80, ChronoUnit.MINUTES), featureData));
        
        // Video engagement
        UserEvent.EventData videoData = new UserEvent.EventData();
        videoData.setVideoId("tutorial_1");
        videoData.setWatchDuration(180);
        videoData.setDuration(240);
        videoData.setCompletionRate(75.0);
        events.add(createEvent(userId, "video_engagement", "session_1", now.minus(60, ChronoUnit.MINUTES), videoData));
        
        // Struggle signal
        UserEvent.EventData struggleData = new UserEvent.EventData();
        struggleData.setFeature("form_submission");
        struggleData.setAttemptCount(3);
        struggleData.setErrorType("validation_error");
        events.add(createEvent(userId, "struggle_signal", "session_2", now.minus(30, ChronoUnit.MINUTES), struggleData));
        
        return events;
    }
    
    private List<UserEvent> createHighEngagementEvents(String userId) {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Multiple video engagements with high completion rates
        for (int i = 0; i < 5; i++) {
            UserEvent.EventData videoData = new UserEvent.EventData();
            videoData.setVideoId("video_" + i);
            videoData.setWatchDuration(200 + i * 10);
            videoData.setDuration(240);
            videoData.setCompletionRate(85.0 + i * 2);
            events.add(createEvent(userId, "video_engagement", "session_" + i, 
                now.minus(i * 30, ChronoUnit.MINUTES), videoData));
        }
        
        // Successful feature interactions
        for (int i = 0; i < 3; i++) {
            UserEvent.EventData featureData = new UserEvent.EventData();
            featureData.setFeature("feature_" + i);
            featureData.setAttemptCount(1);
            events.add(createEvent(userId, "feature_interaction", "session_" + i, 
                now.minus(i * 45, ChronoUnit.MINUTES), featureData));
        }
        
        return events;
    }
    
    private List<UserEvent> createLowEngagementEvents(String userId) {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Few video engagements with low completion rates
        for (int i = 0; i < 2; i++) {
            UserEvent.EventData videoData = new UserEvent.EventData();
            videoData.setVideoId("video_" + i);
            videoData.setWatchDuration(30 + i * 10);
            videoData.setDuration(240);
            videoData.setCompletionRate(15.0 + i * 5);
            events.add(createEvent(userId, "video_engagement", "session_" + i, 
                now.minus(i * 60, ChronoUnit.MINUTES), videoData));
        }
        
        // Multiple struggle signals
        for (int i = 0; i < 4; i++) {
            UserEvent.EventData struggleData = new UserEvent.EventData();
            struggleData.setFeature("difficult_feature_" + i);
            struggleData.setAttemptCount(3 + i);
            struggleData.setErrorType("user_error");
            events.add(createEvent(userId, "struggle_signal", "session_" + i, 
                now.minus(i * 20, ChronoUnit.MINUTES), struggleData));
        }
        
        return events;
    }
    
    private List<UserEvent> createMediumEngagementEvents(String userId) {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Moderate video engagement
        for (int i = 0; i < 3; i++) {
            UserEvent.EventData videoData = new UserEvent.EventData();
            videoData.setVideoId("video_" + i);
            videoData.setWatchDuration(120 + i * 15);
            videoData.setDuration(240);
            videoData.setCompletionRate(50.0 + i * 10);
            events.add(createEvent(userId, "video_engagement", "session_" + i, 
                now.minus(i * 40, ChronoUnit.MINUTES), videoData));
        }
        
        // Some feature interactions with occasional struggles
        UserEvent.EventData featureData = new UserEvent.EventData();
        featureData.setFeature("moderate_feature");
        featureData.setAttemptCount(1);
        events.add(createEvent(userId, "feature_interaction", "session_1", 
            now.minus(50, ChronoUnit.MINUTES), featureData));
        
        UserEvent.EventData struggleData = new UserEvent.EventData();
        struggleData.setFeature("challenging_feature");
        struggleData.setAttemptCount(2);
        events.add(createEvent(userId, "struggle_signal", "session_2", 
            now.minus(25, ChronoUnit.MINUTES), struggleData));
        
        return events;
    }
    
    private UserEvent createEvent(String userId, String eventType, String sessionId, Instant timestamp, UserEvent.EventData eventData) {
        UserEvent event = new UserEvent(eventType, userId, sessionId, timestamp.toEpochMilli());
        
        // Set device info
        UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
        deviceInfo.setPlatform("Web");
        deviceInfo.setAppVersion("1.0.0");
        deviceInfo.setDeviceModel("Demo Device");
        event.setDeviceInfo(deviceInfo);
        
        // Set user context
        UserEvent.UserContext userContext = new UserEvent.UserContext();
        userContext.setUserSegment("active_user");
        userContext.setSessionStage("exploration");
        userContext.setPreviousActions(Arrays.asList("login", "dashboard"));
        event.setUserContext(userContext);
        
        // Set event data
        if (eventData != null) {
            event.setEventData(eventData);
        } else {
            event.setEventData(new UserEvent.EventData());
        }
        
        return event;
    }
    
    private ExitRiskFeatures createValidFeatures(String userId) {
        ExitRiskFeatures features = new ExitRiskFeatures(userId);
        features.setStruggleSignalCount7d(2);
        features.setVideoEngagementScore(75.0);
        features.setFeatureCompletionRate(80.0);
        features.setSessionFrequencyTrend(0.5);
        features.setSupportInteractionCount(1);
        features.setDaysSinceLastLogin(2);
        features.setApplicationProgressPercentage(60.0);
        features.setAvgSessionDuration(300.0);
        features.setTotalSessions(5);
        features.setErrorRate(10.0);
        features.setHelpSeekingBehavior(15.0);
        features.setContentEngagementScore(70.0);
        features.setPlatformUsagePattern("mixed");
        return features;
    }
}