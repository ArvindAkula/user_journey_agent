package com.userjourney.analytics.service;

import com.userjourney.analytics.model.ExitRiskFeatures;
import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.model.UserProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class FeatureEngineeringServiceTest {
    
    @InjectMocks
    private FeatureEngineeringService featureEngineeringService;
    
    private String testUserId;
    private List<UserEvent> testEvents;
    private UserProfile testProfile;
    
    @BeforeEach
    void setUp() {
        testUserId = "test_user_123";
        testEvents = createTestEvents();
        testProfile = createTestProfile();
    }
    
    @Test
    void testExtractExitRiskFeatures_WithValidData() {
        // Act
        ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(
            testUserId, testEvents, testProfile
        );
        
        // Assert
        assertNotNull(features);
        assertEquals(testUserId, features.getUserId());
        assertNotNull(features.getFeatureTimestamp());
        
        // Verify struggle signal count
        assertNotNull(features.getStruggleSignalCount7d());
        assertTrue(features.getStruggleSignalCount7d() >= 0);
        
        // Verify video engagement score
        assertNotNull(features.getVideoEngagementScore());
        assertTrue(features.getVideoEngagementScore() >= 0.0);
        assertTrue(features.getVideoEngagementScore() <= 100.0);
        
        // Verify feature completion rate
        assertNotNull(features.getFeatureCompletionRate());
        assertTrue(features.getFeatureCompletionRate() >= 0.0);
        assertTrue(features.getFeatureCompletionRate() <= 100.0);
        
        // Verify session metrics
        assertNotNull(features.getTotalSessions());
        assertTrue(features.getTotalSessions() >= 0);
        
        assertNotNull(features.getAvgSessionDuration());
        assertTrue(features.getAvgSessionDuration() >= 0.0);
    }
    
    @Test
    void testExtractExitRiskFeatures_WithEmptyEvents() {
        // Act
        ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(
            testUserId, Collections.emptyList(), testProfile
        );
        
        // Assert
        assertNotNull(features);
        assertEquals(testUserId, features.getUserId());
        
        // All metrics should be zero or default values
        assertEquals(0, features.getStruggleSignalCount7d());
        assertEquals(0.0, features.getVideoEngagementScore());
        assertEquals(0.0, features.getFeatureCompletionRate());
        assertEquals(0, features.getTotalSessions());
        assertEquals(0.0, features.getAvgSessionDuration());
    }
    
    @Test
    void testExtractExitRiskFeatures_WithStruggleSignals() {
        // Arrange
        List<UserEvent> eventsWithStruggles = createEventsWithStruggleSignals();
        
        // Act
        ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(
            testUserId, eventsWithStruggles, testProfile
        );
        
        // Assert
        assertNotNull(features.getStruggleSignalCount7d());
        assertTrue(features.getStruggleSignalCount7d() > 0);
        
        // Error rate should be higher with struggle signals
        assertNotNull(features.getErrorRate());
        assertTrue(features.getErrorRate() > 0.0);
    }
    
    @Test
    void testExtractExitRiskFeatures_WithVideoEngagement() {
        // Arrange
        List<UserEvent> eventsWithVideos = createEventsWithVideoEngagement();
        
        // Act
        ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(
            testUserId, eventsWithVideos, testProfile
        );
        
        // Assert
        assertNotNull(features.getVideoEngagementScore());
        assertTrue(features.getVideoEngagementScore() > 0.0);
        
        assertNotNull(features.getContentEngagementScore());
        assertTrue(features.getContentEngagementScore() > 0.0);
    }
    
    @Test
    void testValidateFeatures_WithValidFeatures() {
        // Arrange
        ExitRiskFeatures validFeatures = createValidFeatures();
        
        // Act
        boolean isValid = featureEngineeringService.validateFeatures(validFeatures);
        
        // Assert
        assertTrue(isValid);
    }
    
    @Test
    void testValidateFeatures_WithInvalidFeatures() {
        // Arrange
        ExitRiskFeatures invalidFeatures = new ExitRiskFeatures();
        invalidFeatures.setUserId(null); // Invalid: null user ID
        
        // Act
        boolean isValid = featureEngineeringService.validateFeatures(invalidFeatures);
        
        // Assert
        assertFalse(isValid);
    }
    
    @Test
    void testValidateFeatures_WithNegativeValues() {
        // Arrange
        ExitRiskFeatures invalidFeatures = createValidFeatures();
        invalidFeatures.setStruggleSignalCount7d(-1); // Invalid: negative value
        
        // Act
        boolean isValid = featureEngineeringService.validateFeatures(invalidFeatures);
        
        // Assert
        assertFalse(isValid);
    }
    
    @Test
    void testValidateFeatures_WithOutOfRangeValues() {
        // Arrange
        ExitRiskFeatures invalidFeatures = createValidFeatures();
        invalidFeatures.setVideoEngagementScore(150.0); // Invalid: > 100
        
        // Act
        boolean isValid = featureEngineeringService.validateFeatures(invalidFeatures);
        
        // Assert
        assertFalse(isValid);
    }
    
    @Test
    void testCreateTrainingDataset() {
        // Arrange
        Map<String, List<UserEvent>> historicalEvents = new HashMap<>();
        historicalEvents.put("user1", createTestEvents());
        historicalEvents.put("user2", createEventsWithStruggleSignals());
        
        Map<String, UserProfile> profiles = new HashMap<>();
        profiles.put("user1", createTestProfile());
        profiles.put("user2", createTestProfile());
        
        Map<String, Boolean> exitLabels = new HashMap<>();
        exitLabels.put("user1", false);
        exitLabels.put("user2", true);
        
        // Act
        List<ExitRiskFeatures> trainingData = featureEngineeringService.createTrainingDataset(
            historicalEvents, profiles, exitLabels
        );
        
        // Assert
        assertNotNull(trainingData);
        assertEquals(2, trainingData.size());
        
        // Verify labels are set
        for (ExitRiskFeatures features : trainingData) {
            assertNotNull(features.getExitedWithin72h());
        }
    }
    
    @Test
    void testFeatureArrayConversion() {
        // Arrange
        ExitRiskFeatures features = createValidFeatures();
        
        // Act
        double[] featureArray = features.toFeatureArray();
        
        // Assert
        assertNotNull(featureArray);
        assertEquals(13, featureArray.length); // Should match number of features
        
        // Verify no NaN values
        for (double value : featureArray) {
            assertFalse(Double.isNaN(value));
            assertFalse(Double.isInfinite(value));
        }
    }
    
    @Test
    void testFeatureNames() {
        // Act
        String[] featureNames = ExitRiskFeatures.getFeatureNames();
        
        // Assert
        assertNotNull(featureNames);
        assertEquals(13, featureNames.length);
        
        // Verify expected feature names
        List<String> nameList = Arrays.asList(featureNames);
        assertTrue(nameList.contains("struggle_signal_count_7d"));
        assertTrue(nameList.contains("video_engagement_score"));
        assertTrue(nameList.contains("feature_completion_rate"));
        assertTrue(nameList.contains("platform_usage_pattern"));
    }
    
    // Helper methods to create test data
    
    private List<UserEvent> createTestEvents() {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Create page view event
        UserEvent pageViewEvent = new UserEvent("page_view", testUserId, "session_1", now.toEpochMilli());
        pageViewEvent.setDeviceInfo(createDeviceInfo("Web"));
        pageViewEvent.setUserContext(createUserContext());
        pageViewEvent.setEventData(new UserEvent.EventData());
        events.add(pageViewEvent);
        
        // Create feature interaction event
        UserEvent featureEvent = new UserEvent("feature_interaction", testUserId, "session_1", 
            now.minus(1, ChronoUnit.HOURS).toEpochMilli());
        featureEvent.setDeviceInfo(createDeviceInfo("Web"));
        featureEvent.setUserContext(createUserContext());
        UserEvent.EventData eventData = new UserEvent.EventData();
        eventData.setFeature("document_upload");
        eventData.setAttemptCount(1);
        featureEvent.setEventData(eventData);
        events.add(featureEvent);
        
        return events;
    }
    
    private List<UserEvent> createEventsWithStruggleSignals() {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Create struggle signal event
        UserEvent struggleEvent = new UserEvent("struggle_signal", testUserId, "session_1", now.toEpochMilli());
        struggleEvent.setDeviceInfo(createDeviceInfo("Web"));
        struggleEvent.setUserContext(createUserContext());
        UserEvent.EventData eventData = new UserEvent.EventData();
        eventData.setFeature("document_upload");
        eventData.setAttemptCount(3);
        eventData.setErrorType("validation_error");
        struggleEvent.setEventData(eventData);
        events.add(struggleEvent);
        
        return events;
    }
    
    private List<UserEvent> createEventsWithVideoEngagement() {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Create video engagement event
        UserEvent videoEvent = new UserEvent("video_engagement", testUserId, "session_1", now.toEpochMilli());
        videoEvent.setDeviceInfo(createDeviceInfo("Web"));
        videoEvent.setUserContext(createUserContext());
        UserEvent.EventData eventData = new UserEvent.EventData();
        eventData.setVideoId("tutorial_1");
        eventData.setWatchDuration(180);
        eventData.setDuration(240);
        eventData.setCompletionRate(75.0);
        videoEvent.setEventData(eventData);
        events.add(videoEvent);
        
        return events;
    }
    
    private UserEvent.DeviceInfo createDeviceInfo(String platform) {
        UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
        deviceInfo.setPlatform(platform);
        deviceInfo.setAppVersion("1.0.0");
        deviceInfo.setDeviceModel("Test Device");
        return deviceInfo;
    }
    
    private UserEvent.UserContext createUserContext() {
        UserEvent.UserContext userContext = new UserEvent.UserContext();
        userContext.setUserSegment("active_user");
        userContext.setSessionStage("exploration");
        userContext.setPreviousActions(Arrays.asList("login", "dashboard_view"));
        return userContext;
    }
    
    private UserProfile createTestProfile() {
        UserProfile profile = new UserProfile(testUserId, Instant.now());
        profile.setUserSegment("active_user");
        return profile;
    }
    
    private ExitRiskFeatures createValidFeatures() {
        ExitRiskFeatures features = new ExitRiskFeatures(testUserId);
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