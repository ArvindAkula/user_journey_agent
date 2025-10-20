package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NovaContextAnalysisServiceTest {
    
    @Mock
    private BedrockRuntimeClient bedrockRuntimeClient;
    
    @Mock
    private ObjectMapper objectMapper;
    
    @InjectMocks
    private NovaContextAnalysisService novaContextAnalysisService;
    
    private UserProfile testUserProfile;
    private List<UserEvent> testUserEvents;
    
    @BeforeEach
    void setUp() {
        // Set up test data
        testUserProfile = createTestUserProfile();
        testUserEvents = createTestUserEvents();
        
        // Set private fields using reflection or create a test configuration
        setPrivateField("novaModelId", "amazon.nova-micro-v1:0");
        setPrivateField("maxTokens", 1000);
        setPrivateField("temperature", 0.3);
        setPrivateField("timeoutSeconds", 30);
    }
    
    @Test
    void testAnalyzeUserContext_Success() throws Exception {
        // Arrange
        String mockResponse = createMockNovaResponse();
        InvokeModelResponse invokeResponse = mock(InvokeModelResponse.class);
        SdkBytes responseBody = SdkBytes.fromUtf8String(mockResponse);
        
        when(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
                .thenReturn(invokeResponse);
        when(invokeResponse.body()).thenReturn(responseBody);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(objectMapper.readTree(mockResponse)).thenReturn(createMockJsonNode());
        
        // Act
        CompletableFuture<NovaContextInsights> future = novaContextAnalysisService
                .analyzeUserContext(testUserEvents, testUserProfile);
        NovaContextInsights result = future.get();
        
        // Assert
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("test-user-123", result.getUserId());
        assertNotNull(result.getUserIntent());
        assertNotNull(result.getEngagementLevel());
        assertNotNull(result.getRiskFactors());
        assertNotNull(result.getPersonalizationOpportunities());
        assertNotNull(result.getNextBestActions());
        assertNotNull(result.getInterventionRecommendations());
        assertTrue(result.getConfidence() > 0);
        
        verify(bedrockRuntimeClient).invokeModel(any(InvokeModelRequest.class));
    }
    
    @Test
    void testAnalyzeUserContext_ServiceFailure() throws Exception {
        // Arrange
        when(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
                .thenThrow(new RuntimeException("Bedrock service unavailable"));
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Act
        CompletableFuture<NovaContextInsights> future = novaContextAnalysisService
                .analyzeUserContext(testUserEvents, testUserProfile);
        NovaContextInsights result = future.get();
        
        // Assert
        assertNotNull(result);
        assertFalse(result.isSuccess());
        assertEquals("test-user-123", result.getUserId());
        assertNotNull(result.getErrorMessage());
        assertEquals(0.3, result.getConfidence());
        
        verify(bedrockRuntimeClient).invokeModel(any(InvokeModelRequest.class));
    }
    
    @Test
    void testGenerateRecommendations_ContentType() throws Exception {
        // Arrange
        String mockResponse = createMockRecommendationResponse();
        InvokeModelResponse invokeResponse = mock(InvokeModelResponse.class);
        SdkBytes responseBody = SdkBytes.fromUtf8String(mockResponse);
        
        when(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
                .thenReturn(invokeResponse);
        when(invokeResponse.body()).thenReturn(responseBody);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(objectMapper.readTree(mockResponse)).thenReturn(createMockRecommendationJsonNode());
        
        // Act
        CompletableFuture<List<PersonalizedRecommendation>> future = novaContextAnalysisService
                .generateRecommendations(testUserProfile, "content");
        List<PersonalizedRecommendation> result = future.get();
        
        // Assert
        assertNotNull(result);
        assertFalse(result.isEmpty());
        assertEquals("content", result.get(0).getType());
        assertNotNull(result.get(0).getTitle());
        assertNotNull(result.get(0).getDescription());
        assertTrue(result.get(0).getRelevanceScore() > 0);
        
        verify(bedrockRuntimeClient).invokeModel(any(InvokeModelRequest.class));
    }
    
    @Test
    void testGenerateRecommendations_Fallback() throws Exception {
        // Arrange
        when(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
                .thenThrow(new RuntimeException("Service error"));
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Act
        CompletableFuture<List<PersonalizedRecommendation>> future = novaContextAnalysisService
                .generateRecommendations(testUserProfile, "content");
        List<PersonalizedRecommendation> result = future.get();
        
        // Assert
        assertNotNull(result);
        assertFalse(result.isEmpty());
        assertEquals("content", result.get(0).getType());
        assertEquals("Getting Started Guide", result.get(0).getTitle());
        assertEquals(70, result.get(0).getRelevanceScore());
        
        verify(bedrockRuntimeClient).invokeModel(any(InvokeModelRequest.class));
    }
    
    @Test
    void testExtractBehaviorInsights_Success() throws Exception {
        // Arrange
        String mockResponse = createMockBehaviorInsightsResponse();
        InvokeModelResponse invokeResponse = mock(InvokeModelResponse.class);
        SdkBytes responseBody = SdkBytes.fromUtf8String(mockResponse);
        
        when(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
                .thenReturn(invokeResponse);
        when(invokeResponse.body()).thenReturn(responseBody);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(objectMapper.readTree(mockResponse)).thenReturn(createMockBehaviorJsonNode());
        
        // Act
        CompletableFuture<UserBehaviorInsights> future = novaContextAnalysisService
                .extractBehaviorInsights(testUserEvents, testUserProfile);
        UserBehaviorInsights result = future.get();
        
        // Assert
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("test-user-123", result.getUserId());
        assertNotNull(result.getBehaviorPatterns());
        assertNotNull(result.getEngagementIndicators());
        assertNotNull(result.getFrictionPoints());
        assertNotNull(result.getSuccessIndicators());
        assertNotNull(result.getOptimizationRecommendations());
        assertTrue(result.getConfidence() > 0);
        
        verify(bedrockRuntimeClient).invokeModel(any(InvokeModelRequest.class));
    }
    
    @Test
    void testExtractBehaviorInsights_Timeout() {
        // Arrange
        when(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
                .thenAnswer(invocation -> {
                    Thread.sleep(35000); // Simulate timeout
                    return mock(InvokeModelResponse.class);
                });
        try {
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        } catch (Exception e) {
            // Handle exception in test setup
        }
        
        // Act & Assert
        CompletableFuture<UserBehaviorInsights> future = novaContextAnalysisService
                .extractBehaviorInsights(testUserEvents, testUserProfile);
        
        assertDoesNotThrow(() -> {
            UserBehaviorInsights result = future.get();
            assertNotNull(result);
            assertFalse(result.isSuccess());
            assertNotNull(result.getErrorMessage());
        });
    }
    
    @Test
    void testFallbackMechanisms_AllRecommendationTypes() throws ExecutionException, InterruptedException {
        // Arrange
        when(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
                .thenThrow(new RuntimeException("Service unavailable"));
        try {
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        } catch (Exception e) {
            // Handle exception in test setup
        }
        
        // Test content recommendations fallback
        CompletableFuture<List<PersonalizedRecommendation>> contentFuture = 
                novaContextAnalysisService.generateRecommendations(testUserProfile, "content");
        List<PersonalizedRecommendation> contentResult = contentFuture.get();
        
        assertNotNull(contentResult);
        assertEquals("content", contentResult.get(0).getType());
        assertEquals("Getting Started Guide", contentResult.get(0).getTitle());
        
        // Test feature recommendations fallback
        CompletableFuture<List<PersonalizedRecommendation>> featureFuture = 
                novaContextAnalysisService.generateRecommendations(testUserProfile, "feature");
        List<PersonalizedRecommendation> featureResult = featureFuture.get();
        
        assertNotNull(featureResult);
        assertEquals("feature", featureResult.get(0).getType());
        assertEquals("Profile Completion", featureResult.get(0).getTitle());
        
        // Test default recommendations fallback
        CompletableFuture<List<PersonalizedRecommendation>> defaultFuture = 
                novaContextAnalysisService.generateRecommendations(testUserProfile, "other");
        List<PersonalizedRecommendation> defaultResult = defaultFuture.get();
        
        assertNotNull(defaultResult);
        assertEquals("other", defaultResult.get(0).getType());
        assertEquals("Standard Recommendation", defaultResult.get(0).getTitle());
    }
    
    // Helper methods for creating test data
    private UserProfile createTestUserProfile() {
        UserProfile profile = new UserProfile();
        profile.setUserId("test-user-123");
        profile.setUserSegment("active_user");
        
        UserProfile.BehaviorMetrics metrics = new UserProfile.BehaviorMetrics();
        metrics.setTotalSessions(25);
        metrics.setAvgSessionDuration(15.0);
        metrics.setFeatureAdoptionRate(0.75);
        metrics.setSupportInteractionCount(2);
        profile.setBehaviorMetrics(metrics);
        
        UserProfile.RiskFactors riskFactors = new UserProfile.RiskFactors();
        riskFactors.setExitRiskScore(35.0);
        profile.setRiskFactors(riskFactors);
        
        UserProfile.Preferences preferences = new UserProfile.Preferences();
        preferences.setPreferredInteractionStyle("guided");
        preferences.setContentCategories(Arrays.asList("tutorial", "guide"));
        preferences.setVideoTopics(Arrays.asList("getting-started", "advanced-features"));
        profile.setPreferences(preferences);
        
        return profile;
    }
    
    private List<UserEvent> createTestUserEvents() {
        UserEvent event1 = new UserEvent();
        event1.setUserId("test-user-123");
        event1.setEventType("page_view");
        event1.setTimestamp(System.currentTimeMillis() - 3600000); // 1 hour ago
        
        UserEvent.EventData eventData1 = new UserEvent.EventData();
        eventData1.setFeature("dashboard");
        event1.setEventData(eventData1);
        
        UserEvent.UserContext context1 = new UserEvent.UserContext();
        context1.setSessionStage("exploration");
        event1.setUserContext(context1);
        
        UserEvent event2 = new UserEvent();
        event2.setUserId("test-user-123");
        event2.setEventType("video_engagement");
        event2.setTimestamp(System.currentTimeMillis() - 1800000); // 30 minutes ago
        
        UserEvent.EventData eventData2 = new UserEvent.EventData();
        eventData2.setFeature("tutorial_video");
        eventData2.setDuration(120);
        eventData2.setCompletionRate(85.0);
        event2.setEventData(eventData2);
        
        return Arrays.asList(event1, event2);
    }
    
    private String createMockNovaResponse() {
        return """
                {
                    "outputText": "User intent analysis: The user is exploring the platform to understand available features.\\n\\nEngagement level assessment: High engagement based on multiple interactions.\\n\\nRisk factors for drop-off:\\n- Limited feature adoption\\n- Potential confusion with complex features\\n\\nPersonalization opportunities:\\n- Customize dashboard layout\\n- Recommend relevant tutorials\\n\\nNext best actions:\\n- Complete profile setup\\n- Watch getting started video\\n\\nIntervention recommendations:\\n- Provide guided tour\\n- Offer personalized assistance"
                }
                """;
    }
    
    private String createMockRecommendationResponse() {
        return """
                {
                    "outputText": "Content Recommendations:\\n1. Getting Started Guide - Comprehensive introduction to platform features\\n2. Advanced Tutorial Series - Deep dive into advanced functionality\\n3. Best Practices Guide - Tips for optimal platform usage"
                }
                """;
    }
    
    private String createMockBehaviorInsightsResponse() {
        return """
                {
                    "outputText": "Behavior patterns and trends:\\n- Regular engagement with video content\\n- Progressive feature exploration\\n\\nUser engagement indicators:\\n- High session duration\\n- Multiple feature interactions\\n\\nPotential friction points:\\n- Complex navigation\\n- Information overload\\n\\nSuccess indicators:\\n- Consistent platform usage\\n- Feature completion rates\\n\\nRecommended optimizations:\\n- Simplify user interface\\n- Provide contextual help"
                }
                """;
    }
    
    private JsonNode createMockJsonNode() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readTree(createMockNovaResponse());
    }
    
    private JsonNode createMockRecommendationJsonNode() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readTree(createMockRecommendationResponse());
    }
    
    private JsonNode createMockBehaviorJsonNode() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readTree(createMockBehaviorInsightsResponse());
    }
    
    private void setPrivateField(String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = NovaContextAnalysisService.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(novaContextAnalysisService, value);
        } catch (Exception e) {
            // Handle reflection exceptions in test setup
        }
    }
}