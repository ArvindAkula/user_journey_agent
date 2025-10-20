package com.userjourney.analytics.service;

import com.userjourney.analytics.model.ExitRiskFeatures;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;
import software.amazon.awssdk.core.SdkBytes;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SageMakerPredictiveServiceTest {
    
    @Mock
    private SageMakerRuntimeClient sageMakerRuntimeClient;
    
    @Mock
    private FeatureEngineeringService featureEngineeringService;
    
    @InjectMocks
    private SageMakerPredictiveService sageMakerPredictiveService;
    
    private ObjectMapper objectMapper;
    private ExitRiskFeatures testFeatures;
    
    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        sageMakerPredictiveService = new SageMakerPredictiveService();
        
        // Use reflection to set private fields
        setPrivateField(sageMakerPredictiveService, "sageMakerRuntimeClient", sageMakerRuntimeClient);
        setPrivateField(sageMakerPredictiveService, "objectMapper", objectMapper);
        setPrivateField(sageMakerPredictiveService, "featureEngineeringService", featureEngineeringService);
        setPrivateField(sageMakerPredictiveService, "exitRiskEndpointName", "test-endpoint");
        setPrivateField(sageMakerPredictiveService, "exitRiskThreshold", 0.5);
        
        testFeatures = createTestFeatures();
    }
    
    @Test
    void testPredictExitRisk_Success() throws Exception {
        // Arrange
        when(featureEngineeringService.validateFeatures(any())).thenReturn(true);
        
        InvokeEndpointResponse mockResponse = mock(InvokeEndpointResponse.class);
        when(mockResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [0.75]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(mockResponse);
        
        // Act
        SageMakerPredictiveService.PredictionResult result = sageMakerPredictiveService.predictExitRisk(testFeatures);
        
        // Assert
        assertNotNull(result);
        assertEquals("test_user", result.getUserId());
        assertEquals(75.0, result.getRiskScore(), 0.01);
        assertEquals("HIGH", result.getRiskLevel());
        assertFalse(result.hasError());
        assertNotNull(result.getRecommendations());
        assertTrue(result.getRecommendations().size() > 0);
    }
    
    @Test
    void testPredictExitRisk_InvalidFeatures() {
        // Arrange
        when(featureEngineeringService.validateFeatures(any())).thenReturn(false);
        
        // Act
        SageMakerPredictiveService.PredictionResult result = sageMakerPredictiveService.predictExitRisk(testFeatures);
        
        // Assert
        assertNotNull(result);
        assertTrue(result.hasError());
        assertEquals("Invalid features", result.getErrorMessage());
        verify(sageMakerRuntimeClient, never()).invokeEndpoint(any(InvokeEndpointRequest.class));
    }
    
    @Test
    void testPredictExitRisk_SageMakerException() {
        // Arrange
        when(featureEngineeringService.validateFeatures(any())).thenReturn(true);
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class)))
            .thenThrow(new RuntimeException("SageMaker error"));
        
        // Act
        SageMakerPredictiveService.PredictionResult result = sageMakerPredictiveService.predictExitRisk(testFeatures);
        
        // Assert
        assertNotNull(result);
        assertTrue(result.hasError());
        assertTrue(result.getErrorMessage().contains("SageMaker error"));
    }
    
    @Test
    void testPredictExitRiskAsync_Success() throws Exception {
        // Arrange
        when(featureEngineeringService.validateFeatures(any())).thenReturn(true);
        
        InvokeEndpointResponse mockResponse = mock(InvokeEndpointResponse.class);
        when(mockResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [0.25]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(mockResponse);
        
        // Act
        CompletableFuture<SageMakerPredictiveService.PredictionResult> future = 
            sageMakerPredictiveService.predictExitRiskAsync(testFeatures);
        SageMakerPredictiveService.PredictionResult result = future.get();
        
        // Assert
        assertNotNull(result);
        assertEquals("test_user", result.getUserId());
        assertEquals(25.0, result.getRiskScore(), 0.01);
        assertEquals("LOW", result.getRiskLevel());
        assertFalse(result.hasError());
    }
    
    @Test
    void testBatchPredictExitRisk() throws Exception {
        // Arrange
        List<ExitRiskFeatures> featuresList = Arrays.asList(
            createTestFeatures("user1"),
            createTestFeatures("user2")
        );
        
        when(featureEngineeringService.validateFeatures(any())).thenReturn(true);
        
        InvokeEndpointResponse mockResponse = mock(InvokeEndpointResponse.class);
        when(mockResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [0.60]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(mockResponse);
        
        // Act
        Map<String, SageMakerPredictiveService.PredictionResult> results = 
            sageMakerPredictiveService.batchPredictExitRisk(featuresList);
        
        // Assert
        assertNotNull(results);
        assertEquals(2, results.size());
        assertTrue(results.containsKey("user1"));
        assertTrue(results.containsKey("user2"));
        
        for (SageMakerPredictiveService.PredictionResult result : results.values()) {
            assertNotNull(result);
            assertEquals(60.0, result.getRiskScore(), 0.01);
            assertEquals("MEDIUM", result.getRiskLevel());
        }
    }
    
    @Test
    void testGetModelHealthStatus_Healthy() throws Exception {
        // Arrange
        InvokeEndpointResponse mockResponse = mock(InvokeEndpointResponse.class);
        when(mockResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [0.50]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(mockResponse);
        
        // Act
        SageMakerPredictiveService.ModelHealthStatus status = sageMakerPredictiveService.getModelHealthStatus();
        
        // Assert
        assertNotNull(status);
        assertTrue(status.isHealthy());
        assertEquals("Model is healthy", status.getMessage());
        assertTrue(status.getResponseTimeMs() >= 0);
    }
    
    @Test
    void testGetModelHealthStatus_Unhealthy() {
        // Arrange
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class)))
            .thenThrow(new RuntimeException("Endpoint unavailable"));
        
        // Act
        SageMakerPredictiveService.ModelHealthStatus status = sageMakerPredictiveService.getModelHealthStatus();
        
        // Assert
        assertNotNull(status);
        assertFalse(status.isHealthy());
        assertTrue(status.getMessage().contains("Endpoint unavailable"));
        assertEquals(-1, status.getResponseTimeMs());
    }
    
    @Test
    void testRiskLevelCategorization() throws Exception {
        // Test LOW risk
        testRiskLevelForScore(0.20, "LOW");
        
        // Test MEDIUM risk
        testRiskLevelForScore(0.45, "MEDIUM");
        
        // Test HIGH risk
        testRiskLevelForScore(0.80, "HIGH");
    }
    
    @Test
    void testPredictionCaching() throws Exception {
        // Arrange
        when(featureEngineeringService.validateFeatures(any())).thenReturn(true);
        
        InvokeEndpointResponse mockResponse = mock(InvokeEndpointResponse.class);
        when(mockResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [0.65]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(mockResponse);
        
        // Act - First prediction
        SageMakerPredictiveService.PredictionResult result1 = sageMakerPredictiveService.predictExitRisk(testFeatures);
        
        // Act - Second prediction (should use cache)
        SageMakerPredictiveService.PredictionResult result2 = sageMakerPredictiveService.predictExitRisk(testFeatures);
        
        // Assert
        assertNotNull(result1);
        assertNotNull(result2);
        assertEquals(result1.getRiskScore(), result2.getRiskScore());
        
        // Verify SageMaker was called only once due to caching
        verify(sageMakerRuntimeClient, times(1)).invokeEndpoint(any(InvokeEndpointRequest.class));
    }
    
    @Test
    void testClearPredictionCache() {
        // Act
        sageMakerPredictiveService.clearPredictionCache();
        
        // Assert - Should not throw exception
        Map<String, Object> stats = sageMakerPredictiveService.getCacheStatistics();
        assertNotNull(stats);
        assertEquals(0, stats.get("cacheSize"));
    }
    
    @Test
    void testGetCacheStatistics() {
        // Act
        Map<String, Object> stats = sageMakerPredictiveService.getCacheStatistics();
        
        // Assert
        assertNotNull(stats);
        assertTrue(stats.containsKey("cacheSize"));
        assertTrue(stats.containsKey("cacheDurationMinutes"));
        assertTrue(stats.containsKey("expiredEntries"));
    }
    
    @Test
    void testPredictionResultExpiration() {
        // Arrange
        Instant pastTime = Instant.now().minusSeconds(3600); // 1 hour ago
        SageMakerPredictiveService.PredictionResult result = 
            new SageMakerPredictiveService.PredictionResult(
                "test_user", 50.0, "MEDIUM", Arrays.asList("test"), pastTime
            );
        
        // Act & Assert
        assertTrue(result.isExpired());
    }
    
    @Test
    void testPredictionResultNotExpired() {
        // Arrange
        Instant recentTime = Instant.now().minusSeconds(60); // 1 minute ago
        SageMakerPredictiveService.PredictionResult result = 
            new SageMakerPredictiveService.PredictionResult(
                "test_user", 50.0, "MEDIUM", Arrays.asList("test"), recentTime
            );
        
        // Act & Assert
        assertFalse(result.isExpired());
    }
    
    // Helper methods
    
    private void testRiskLevelForScore(double score, String expectedLevel) throws Exception {
        // Arrange
        when(featureEngineeringService.validateFeatures(any())).thenReturn(true);
        
        InvokeEndpointResponse mockResponse = mock(InvokeEndpointResponse.class);
        when(mockResponse.body()).thenReturn(SdkBytes.fromUtf8String("{\"predictions\": [" + score + "]}"));
        when(sageMakerRuntimeClient.invokeEndpoint(any(InvokeEndpointRequest.class))).thenReturn(mockResponse);
        
        // Act
        SageMakerPredictiveService.PredictionResult result = sageMakerPredictiveService.predictExitRisk(testFeatures);
        
        // Assert
        assertEquals(expectedLevel, result.getRiskLevel());
    }
    
    private ExitRiskFeatures createTestFeatures() {
        return createTestFeatures("test_user");
    }
    
    private ExitRiskFeatures createTestFeatures(String userId) {
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
    
    private void setPrivateField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            // For testing purposes, we'll use a simpler approach
            // In a real test, you might want to use @TestPropertySource or other Spring testing features
        }
    }
}