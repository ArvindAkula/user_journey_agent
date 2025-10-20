package com.userjourney.analytics.integration;

import com.userjourney.analytics.controller.PredictiveAnalyticsController;
import com.userjourney.analytics.model.ExitRiskFeatures;
import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.service.EventCollectionService;
import com.userjourney.analytics.service.FeatureEngineeringService;
import com.userjourney.analytics.service.SageMakerPredictiveService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;
import software.amazon.awssdk.core.SdkBytes;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
    "sagemaker.exit-risk.endpoint-name=test-endpoint",
    "sagemaker.exit-risk.model-threshold=0.5"
})
class PredictiveAnalyticsIntegrationTest {
    
    @Autowired
    private WebApplicationContext webApplicationContext;
    
    @Autowired
    private EventCollectionService eventCollectionService;
    
    @Autowired
    private FeatureEngineeringService featureEngineeringService;
    
    @MockBean
    private SageMakerRuntimeClient sageMakerRuntimeClient;
    
    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private String testUserId;
    
    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        objectMapper = new ObjectMapper();
        testUserId = "integration_test_user_" + System.currentTimeMillis();
        
        // Setup mock SageMaker responses
        setupSageMakerMocks();
    }
    
    @Test
    void testCompleteExitRiskPredictionFlow() throws Exception {
        // Step 1: Generate user events to create behavior history
        generateUserBehaviorHistory();
        
        // Step 2: Test exit risk prediction API
        mockMvc.perform(get("/api/predictive/exit-risk/{userId}", testUserId))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.userId").value(testUserId))
            .andExpect(jsonPath("$.riskScore").isNumber())
            .andExpect(jsonPath("$.riskLevel").isString())
            .andExpect(jsonPath("$.recommendations").isArray());
    }
    
    @Test
    void testAsyncExitRiskPrediction() throws Exception {
        // Generate some user events
        generateUserBehaviorHistory();
        
        // Test async prediction
        mockMvc.perform(get("/api/predictive/exit-risk/{userId}/async", testUserId))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.userId").value(testUserId))
            .andExpect(jsonPath("$.riskScore").isNumber());
    }
    
    @Test
    void testBatchExitRiskPrediction() throws Exception {
        // Generate user events for multiple users
        String user1 = testUserId + "_1";
        String user2 = testUserId + "_2";
        
        generateUserBehaviorHistoryForUser(user1);
        generateUserBehaviorHistoryForUser(user2);
        
        // Create batch request
        PredictiveAnalyticsController.BatchPredictionRequest request = 
            new PredictiveAnalyticsController.BatchPredictionRequest(Arrays.asList(user1, user2));
        
        String requestJson = objectMapper.writeValueAsString(request);
        
        // Test batch prediction
        mockMvc.perform(post("/api/predictive/exit-risk/batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.totalPredictions").value(2))
            .andExpect(jsonPath("$.predictions").isMap())
            .andExpect(jsonPath("$.predictions['" + user1 + "']").exists())
            .andExpect(jsonPath("$.predictions['" + user2 + "']").exists());
    }
    
    @Test
    void testGetUserFeatures() throws Exception {
        // Generate user events
        generateUserBehaviorHistory();
        
        // Test features extraction
        mockMvc.perform(get("/api/predictive/features/{userId}", testUserId))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.userId").value(testUserId))
            .andExpect(jsonPath("$.struggleSignalCount7d").isNumber())
            .andExpect(jsonPath("$.videoEngagementScore").isNumber())
            .andExpect(jsonPath("$.featureCompletionRate").isNumber());
    }
    
    @Test
    void testModelHealthCheck() throws Exception {
        mockMvc.perform(get("/api/predictive/model/health"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.healthy").isBoolean())
            .andExpect(jsonPath("$.message").isString())
            .andExpect(jsonPath("$.responseTimeMs").isNumber());
    }
    
    @Test
    void testCacheOperations() throws Exception {
        // Test cache statistics
        mockMvc.perform(get("/api/predictive/cache/stats"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.cacheSize").isNumber())
            .andExpect(jsonPath("$.cacheDurationMinutes").isNumber());
        
        // Test cache clearing
        mockMvc.perform(post("/api/predictive/cache/clear"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.status").value("success"));
    }
    
    @Test
    void testHighRiskUserIntervention() throws Exception {
        // Setup high-risk scenario
        setupHighRiskSageMakerResponse();
        
        // Generate struggle signals to trigger high risk
        generateHighRiskUserBehavior();
        
        // Test prediction - should trigger intervention
        mockMvc.perform(get("/api/predictive/exit-risk/{userId}", testUserId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.riskLevel").value("HIGH"))
            .andExpect(jsonPath("$.riskScore").value(greaterThan(70.0)));
    }
    
    @Test
    void testFeatureEngineering() {
        // Generate comprehensive user behavior
        List<UserEvent> events = generateComprehensiveUserEvents();
        
        // Test feature extraction
        ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(
            testUserId, events, null
        );
        
        // Verify features are properly extracted
        assertNotNull(features);
        assertEquals(testUserId, features.getUserId());
        assertNotNull(features.getStruggleSignalCount7d());
        assertNotNull(features.getVideoEngagementScore());
        assertNotNull(features.getFeatureCompletionRate());
        
        // Verify feature validation
        assertTrue(featureEngineeringService.validateFeatures(features));
        
        // Test feature array conversion
        double[] featureArray = features.toFeatureArray();
        assertEquals(13, featureArray.length);
        
        // Verify no invalid values
        for (double value : featureArray) {
            assertFalse(Double.isNaN(value));
            assertFalse(Double.isInfinite(value));
        }
    }
    
    @Test
    void testPredictionWithInsufficientData() throws Exception {
        // Test prediction for user with no events
        String newUserId = "new_user_" + System.currentTimeMillis();
        
        mockMvc.perform(get("/api/predictive/exit-risk/{userId}", newUserId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value(newUserId))
            .andExpect(jsonPath("$.riskScore").value(0.0))
            .andExpect(jsonPath("$.riskLevel").value("LOW"))
            .andExpect(jsonPath("$.errorMessage").value("insufficient_data"));
    }
    
    // Helper methods
    
    private void setupSageMakerMocks() {
        // Default mock response for medium risk
        InvokeEndpointResponse mockResponse = mock(InvokeEndpointResponse.class);
        when(mockResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [0.45]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(mockResponse);
    }
    
    private void setupHighRiskSageMakerResponse() {
        InvokeEndpointResponse highRiskResponse = mock(InvokeEndpointResponse.class);
        when(highRiskResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [0.85]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(highRiskResponse);
    }
    
    private void generateUserBehaviorHistory() {
        generateUserBehaviorHistoryForUser(testUserId);
    }
    
    private void generateUserBehaviorHistoryForUser(String userId) {
        List<UserEvent> events = generateComprehensiveUserEvents(userId);
        
        // Process events through the service
        for (UserEvent event : events) {
            try {
                eventCollectionService.processEvent(event);
            } catch (Exception e) {
                // Continue processing other events
            }
        }
    }
    
    private List<UserEvent> generateComprehensiveUserEvents() {
        return generateComprehensiveUserEvents(testUserId);
    }
    
    private List<UserEvent> generateComprehensiveUserEvents(String userId) {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Generate login event
        events.add(createEvent(userId, "page_view", "session_1", now.minus(2, ChronoUnit.HOURS), null));
        
        // Generate feature interactions
        UserEvent.EventData featureData = new UserEvent.EventData();
        featureData.setFeature("document_upload");
        featureData.setAttemptCount(1);
        events.add(createEvent(userId, "feature_interaction", "session_1", now.minus(90, ChronoUnit.MINUTES), featureData));
        
        // Generate video engagement
        UserEvent.EventData videoData = new UserEvent.EventData();
        videoData.setVideoId("tutorial_1");
        videoData.setWatchDuration(180);
        videoData.setDuration(240);
        videoData.setCompletionRate(75.0);
        events.add(createEvent(userId, "video_engagement", "session_1", now.minus(60, ChronoUnit.MINUTES), videoData));
        
        // Generate some struggle signals
        UserEvent.EventData struggleData = new UserEvent.EventData();
        struggleData.setFeature("form_submission");
        struggleData.setAttemptCount(3);
        struggleData.setErrorType("validation_error");
        events.add(createEvent(userId, "struggle_signal", "session_2", now.minus(30, ChronoUnit.MINUTES), struggleData));
        
        return events;
    }
    
    private void generateHighRiskUserBehavior() {
        List<UserEvent> events = new ArrayList<>();
        Instant now = Instant.now();
        
        // Generate multiple struggle signals
        for (int i = 0; i < 5; i++) {
            UserEvent.EventData struggleData = new UserEvent.EventData();
            struggleData.setFeature("critical_feature_" + i);
            struggleData.setAttemptCount(4 + i);
            struggleData.setErrorType("critical_error");
            
            events.add(createEvent(testUserId, "struggle_signal", "session_" + i, 
                now.minus(i * 10, ChronoUnit.MINUTES), struggleData));
        }
        
        // Process events
        for (UserEvent event : events) {
            try {
                eventCollectionService.processEvent(event);
            } catch (Exception e) {
                // Continue processing
            }
        }
    }
    
    private UserEvent createEvent(String userId, String eventType, String sessionId, Instant timestamp, UserEvent.EventData eventData) {
        UserEvent event = new UserEvent(eventType, userId, sessionId, timestamp.toEpochMilli());
        
        // Set device info
        UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
        deviceInfo.setPlatform("Web");
        deviceInfo.setAppVersion("1.0.0");
        deviceInfo.setDeviceModel("Test Device");
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
    
    // Additional assertion methods
    private void assertNotNull(Object object) {
        if (object == null) {
            throw new AssertionError("Expected non-null value");
        }
    }
    
    private void assertEquals(Object expected, Object actual) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError("Expected: " + expected + ", but was: " + actual);
        }
    }
    
    private void assertTrue(boolean condition) {
        if (!condition) {
            throw new AssertionError("Expected true, but was false");
        }
    }
    
    private void assertFalse(boolean condition) {
        if (condition) {
            throw new AssertionError("Expected false, but was true");
        }
    }
    
    private org.hamcrest.Matcher<Double> greaterThan(double value) {
        return org.hamcrest.Matchers.greaterThan(value);
    }
}