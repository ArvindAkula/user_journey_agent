package com.userjourney.analytics.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.controller.NovaAnalysisController;
import com.userjourney.analytics.model.*;
import com.userjourney.analytics.service.NovaContextAnalysisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NovaAnalysisController.class)
class NovaContextAnalysisIntegrationTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @MockBean
    private NovaContextAnalysisService novaContextAnalysisService;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    private NovaAnalysisController.ContextAnalysisRequest contextRequest;
    private NovaAnalysisController.BehaviorAnalysisRequest behaviorRequest;
    private UserProfile testUserProfile;
    
    @BeforeEach
    void setUp() {
        testUserProfile = createTestUserProfile();
        contextRequest = createContextAnalysisRequest();
        behaviorRequest = createBehaviorAnalysisRequest();
    }
    
    @Test
    void testAnalyzeUserContext_Success() throws Exception {
        // Arrange
        NovaContextInsights mockInsights = createMockContextInsights(true);
        when(novaContextAnalysisService.analyzeUserContext(any(), any()))
                .thenReturn(CompletableFuture.completedFuture(mockInsights));
        
        // Act & Assert
        mockMvc.perform(post("/api/nova/analyze/context")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(contextRequest)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.userId").value("test-user-123"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.userIntent").exists())
                .andExpect(jsonPath("$.engagementLevel").exists())
                .andExpect(jsonPath("$.riskFactors").isArray())
                .andExpect(jsonPath("$.personalizationOpportunities").isArray())
                .andExpect(jsonPath("$.nextBestActions").isArray())
                .andExpect(jsonPath("$.interventionRecommendations").isArray())
                .andExpect(jsonPath("$.confidence").isNumber());
    }
    
    @Test
    void testAnalyzeUserContext_ServiceFailure() throws Exception {
        // Arrange
        NovaContextInsights mockInsights = createMockContextInsights(false);
        when(novaContextAnalysisService.analyzeUserContext(any(), any()))
                .thenReturn(CompletableFuture.completedFuture(mockInsights));
        
        // Act & Assert
        mockMvc.perform(post("/api/nova/analyze/context")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(contextRequest)))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.userId").value("test-user-123"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorMessage").exists());
    }
    
    @Test
    void testGenerateRecommendations_ContentType() throws Exception {
        // Arrange
        List<PersonalizedRecommendation> mockRecommendations = createMockRecommendations("content");
        when(novaContextAnalysisService.generateRecommendations(any(), eq("content")))
                .thenReturn(CompletableFuture.completedFuture(mockRecommendations));
        
        // Act & Assert
        mockMvc.perform(post("/api/nova/recommendations/content")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUserProfile)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].type").value("content"))
                .andExpect(jsonPath("$[0].title").exists())
                .andExpect(jsonPath("$[0].description").exists())
                .andExpect(jsonPath("$[0].relevanceScore").isNumber())
                .andExpect(jsonPath("$[0].priority").exists());
    }
    
    @Test
    void testGenerateRecommendations_FeatureType() throws Exception {
        // Arrange
        List<PersonalizedRecommendation> mockRecommendations = createMockRecommendations("feature");
        when(novaContextAnalysisService.generateRecommendations(any(), eq("feature")))
                .thenReturn(CompletableFuture.completedFuture(mockRecommendations));
        
        // Act & Assert
        mockMvc.perform(post("/api/nova/recommendations/feature")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUserProfile)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].type").value("feature"))
                .andExpect(jsonPath("$[0].title").exists());
    }
    
    @Test
    void testGenerateRecommendations_ServiceException() throws Exception {
        // Arrange
        when(novaContextAnalysisService.generateRecommendations(any(), eq("content")))
                .thenReturn(CompletableFuture.failedFuture(new RuntimeException("Service error")));
        
        // Act & Assert
        mockMvc.perform(post("/api/nova/recommendations/content")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUserProfile)))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }
    
    @Test
    void testExtractBehaviorInsights_Success() throws Exception {
        // Arrange
        UserBehaviorInsights mockInsights = createMockBehaviorInsights(true);
        when(novaContextAnalysisService.extractBehaviorInsights(any(), any()))
                .thenReturn(CompletableFuture.completedFuture(mockInsights));
        
        // Act & Assert
        mockMvc.perform(post("/api/nova/analyze/behavior")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(behaviorRequest)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.userId").value("test-user-123"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.behaviorPatterns").isArray())
                .andExpect(jsonPath("$.engagementIndicators").isArray())
                .andExpect(jsonPath("$.frictionPoints").isArray())
                .andExpect(jsonPath("$.successIndicators").isArray())
                .andExpect(jsonPath("$.optimizationRecommendations").isArray())
                .andExpect(jsonPath("$.confidence").isNumber());
    }
    
    @Test
    void testExtractBehaviorInsights_ServiceFailure() throws Exception {
        // Arrange
        UserBehaviorInsights mockInsights = createMockBehaviorInsights(false);
        when(novaContextAnalysisService.extractBehaviorInsights(any(), any()))
                .thenReturn(CompletableFuture.completedFuture(mockInsights));
        
        // Act & Assert
        mockMvc.perform(post("/api/nova/analyze/behavior")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(behaviorRequest)))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.userId").value("test-user-123"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorMessage").exists());
    }
    
    @Test
    void testGetUserInsightsSummary() throws Exception {
        // Act & Assert
        mockMvc.perform(get("/api/nova/insights/test-user-123")
                .param("eventLimit", "10"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.userId").value("test-user-123"))
                .andExpect(jsonPath("$.message").exists());
    }
    
    @Test
    void testInvalidRequestBody_ContextAnalysis() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/nova/analyze/context")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isInternalServerError());
    }
    
    @Test
    void testInvalidRequestBody_BehaviorAnalysis() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/nova/analyze/behavior")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isInternalServerError());
    }
    
    @Test
    void testCorsHeaders() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/nova/analyze/context")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(contextRequest))
                .header("Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Origin", "*"));
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
    
    private NovaAnalysisController.ContextAnalysisRequest createContextAnalysisRequest() {
        NovaAnalysisController.ContextAnalysisRequest request = 
                new NovaAnalysisController.ContextAnalysisRequest();
        request.setUserProfile(testUserProfile);
        request.setRecentEvents(createTestUserEvents());
        return request;
    }
    
    private NovaAnalysisController.BehaviorAnalysisRequest createBehaviorAnalysisRequest() {
        NovaAnalysisController.BehaviorAnalysisRequest request = 
                new NovaAnalysisController.BehaviorAnalysisRequest();
        request.setUserProfile(testUserProfile);
        request.setUserEvents(createTestUserEvents());
        return request;
    }
    
    private List<UserEvent> createTestUserEvents() {
        UserEvent event1 = new UserEvent();
        event1.setUserId("test-user-123");
        event1.setEventType("page_view");
        event1.setTimestamp(System.currentTimeMillis() - 3600000);
        
        UserEvent.EventData eventData1 = new UserEvent.EventData();
        eventData1.setFeature("dashboard");
        event1.setEventData(eventData1);
        
        UserEvent.UserContext context1 = new UserEvent.UserContext();
        context1.setSessionStage("exploration");
        event1.setUserContext(context1);
        
        UserEvent event2 = new UserEvent();
        event2.setUserId("test-user-123");
        event2.setEventType("video_engagement");
        event2.setTimestamp(System.currentTimeMillis() - 1800000);
        
        UserEvent.EventData eventData2 = new UserEvent.EventData();
        eventData2.setFeature("tutorial_video");
        eventData2.setDuration(120);
        eventData2.setCompletionRate(85.0);
        event2.setEventData(eventData2);
        
        return Arrays.asList(event1, event2);
    }
    
    private NovaContextInsights createMockContextInsights(boolean success) {
        return NovaContextInsights.builder()
                .userId("test-user-123")
                .analysisText("Mock analysis text")
                .userIntent("User wants to explore platform features")
                .engagementLevel("High engagement")
                .riskFactors(Arrays.asList("Limited feature adoption", "Potential confusion"))
                .personalizationOpportunities(Arrays.asList("Customize dashboard", "Recommend tutorials"))
                .nextBestActions(Arrays.asList("Complete profile", "Watch tutorial"))
                .interventionRecommendations(Arrays.asList("Provide guided tour", "Offer assistance"))
                .confidence(0.85)
                .timestamp(LocalDateTime.now())
                .success(success)
                .errorMessage(success ? null : "Mock service error")
                .build();
    }
    
    private List<PersonalizedRecommendation> createMockRecommendations(String type) {
        PersonalizedRecommendation rec1 = PersonalizedRecommendation.builder()
                .type(type)
                .title("Getting Started Guide")
                .description("Comprehensive introduction to platform features")
                .relevanceScore(90)
                .priority("high")
                .category("tutorial")
                .reasoning("User is new and needs guidance")
                .expectedBenefit("Faster onboarding")
                .timestamp(LocalDateTime.now())
                .build();
        
        PersonalizedRecommendation rec2 = PersonalizedRecommendation.builder()
                .type(type)
                .title("Advanced Features Tutorial")
                .description("Deep dive into advanced functionality")
                .relevanceScore(75)
                .priority("medium")
                .category("advanced")
                .reasoning("User shows interest in complex features")
                .expectedBenefit("Enhanced productivity")
                .timestamp(LocalDateTime.now())
                .build();
        
        return Arrays.asList(rec1, rec2);
    }
    
    private UserBehaviorInsights createMockBehaviorInsights(boolean success) {
        return UserBehaviorInsights.builder()
                .userId("test-user-123")
                .behaviorPatterns(Arrays.asList("Regular video engagement", "Progressive feature exploration"))
                .engagementIndicators(Arrays.asList("High session duration", "Multiple interactions"))
                .frictionPoints(Arrays.asList("Complex navigation", "Information overload"))
                .successIndicators(Arrays.asList("Consistent usage", "Feature completion"))
                .optimizationRecommendations(Arrays.asList("Simplify UI", "Provide contextual help"))
                .analysisText("Mock behavior analysis")
                .confidence(0.80)
                .timestamp(LocalDateTime.now())
                .success(success)
                .errorMessage(success ? null : "Mock behavior analysis error")
                .build();
    }
}