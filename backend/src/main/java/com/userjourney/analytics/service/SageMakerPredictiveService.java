package com.userjourney.analytics.service;

import com.userjourney.analytics.model.ExitRiskFeatures;
import com.userjourney.analytics.resilience.CircuitBreaker;
import com.userjourney.analytics.resilience.ErrorHandlingService;
import com.userjourney.analytics.resilience.RetryHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;
import software.amazon.awssdk.core.SdkBytes;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Service for SageMaker-based predictive analytics and exit risk scoring
 */
@Service
public class SageMakerPredictiveService {
    
    private static final Logger logger = LoggerFactory.getLogger(SageMakerPredictiveService.class);
    private static final String SERVICE_NAME = "SageMakerPredictive";
    
    @Autowired
    private SageMakerRuntimeClient sageMakerRuntimeClient;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Autowired
    private FeatureEngineeringService featureEngineeringService;
    
    @Autowired
    private CircuitBreaker circuitBreaker;
    
    @Autowired
    private RetryHandler retryHandler;
    
    @Autowired
    private ErrorHandlingService errorHandlingService;
    
    @Value("${sagemaker.exit-risk.endpoint-name:exit-risk-predictor}")
    private String exitRiskEndpointName;
    
    @Value("${sagemaker.exit-risk.model-threshold:0.5}")
    private double exitRiskThreshold;
    
    @Value("${sagemaker.mock-mode:true}")
    private boolean mockMode;
    
    // Cache for recent predictions to avoid redundant calls
    private final Map<String, PredictionResult> predictionCache = new ConcurrentHashMap<>();
    private final long CACHE_DURATION_MINUTES = 30;
    
    /**
     * Predict exit risk for a user based on their features
     */
    public PredictionResult predictExitRisk(ExitRiskFeatures features) {
        logger.debug("Predicting exit risk for user: {}", features.getUserId());
        
        // If in mock mode, skip SageMaker and use rule-based prediction directly
        if (mockMode || "mock-endpoint".equals(exitRiskEndpointName)) {
            logger.debug("SageMaker in mock mode - using rule-based prediction for user: {}", features.getUserId());
            return createFallbackPrediction(features.getUserId(), "Mock mode - rule-based prediction");
        }
        
        // Check cache first
        String cacheKey = features.getUserId();
        PredictionResult cachedResult = predictionCache.get(cacheKey);
        if (cachedResult != null && !cachedResult.isExpired()) {
            logger.debug("Returning cached prediction for user: {}", features.getUserId());
            return cachedResult;
        }
        
        String operationName = "predictExitRisk";
        
        return circuitBreaker.execute(
            SERVICE_NAME + ":" + operationName,
            () -> retryHandler.executeWithRetryAndFallback(
                operationName,
                () -> performExitRiskPrediction(features),
                () -> {
                    PredictionResult fallback = createFallbackPrediction(features.getUserId(), 
                        "SageMaker service temporarily unavailable");
                    logger.warn("SageMaker prediction failed for user: {} - using rule-based fallback", features.getUserId());
                    return fallback;
                },
                createRetryConfig()
            ),
            () -> {
                PredictionResult fallback = createFallbackPrediction(features.getUserId(), 
                    "Circuit breaker open - SageMaker unavailable");
                logger.warn("SageMaker circuit breaker open - using rule-based fallback");
                return fallback;
            }
        );
    }
    
    private PredictionResult performExitRiskPrediction(ExitRiskFeatures features) {
        try {
            // Validate features
            if (!featureEngineeringService.validateFeatures(features)) {
                logger.warn("Invalid features for user: {}", features.getUserId());
                return createFallbackPrediction(features.getUserId(), "Invalid features");
            }
            
            // Prepare input for SageMaker
            String inputData = prepareModelInput(features);
            
            // Invoke SageMaker endpoint
            InvokeEndpointRequest request = InvokeEndpointRequest.builder()
                .endpointName(exitRiskEndpointName)
                .contentType("application/json")
                .body(SdkBytes.fromUtf8String(inputData))
                .build();
            
            InvokeEndpointResponse response = sageMakerRuntimeClient.invokeEndpoint(request);
            
            // Parse prediction result
            String responseBody = response.body().asUtf8String();
            PredictionResult result = parseModelOutput(features.getUserId(), responseBody);
            
            // Cache the result
            predictionCache.put(features.getUserId(), result);
            
            logger.info("Exit risk prediction for user {}: score={}, level={}", 
                features.getUserId(), result.getRiskScore(), result.getRiskLevel());
            
            return result;
            
        } catch (Exception e) {
            errorHandlingService.handleError(SERVICE_NAME, "predictExitRisk", e, 
                Map.of("userId", features.getUserId(), "endpointName", exitRiskEndpointName));
            throw new com.userjourney.analytics.exception.ExitRiskPredictionException(
                "Failed to predict exit risk for user " + features.getUserId(), e);
        }
    }
    
    /**
     * Predict exit risk asynchronously
     */
    public CompletableFuture<PredictionResult> predictExitRiskAsync(ExitRiskFeatures features) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return predictExitRisk(features);
            } catch (Exception e) {
                logger.error("Failed to predict exit risk asynchronously", e);
                throw new RuntimeException("Failed to predict exit risk", e);
            }
        });
    }
    
    /**
     * Batch predict exit risk for multiple users
     */
    public Map<String, PredictionResult> batchPredictExitRisk(List<ExitRiskFeatures> featuresList) {
        logger.info("Batch predicting exit risk for {} users", featuresList.size());
        
        Map<String, PredictionResult> results = new HashMap<>();
        
        // Process in parallel for better performance
        List<CompletableFuture<Void>> futures = featuresList.stream()
            .map(features -> CompletableFuture.runAsync(() -> {
                try {
                    PredictionResult result = predictExitRisk(features);
                    synchronized (results) {
                        results.put(features.getUserId(), result);
                    }
                } catch (Exception e) {
                    logger.error("Failed to predict for user {}: {}", features.getUserId(), e.getMessage());
                    synchronized (results) {
                        results.put(features.getUserId(), createFallbackPrediction(features.getUserId(), e.getMessage()));
                    }
                }
            }))
            .toList();
        
        // Wait for all predictions to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        
        logger.info("Completed batch prediction for {} users", results.size());
        return results;
    }
    
    /**
     * Prepare input data for SageMaker model
     */
    private String prepareModelInput(ExitRiskFeatures features) throws Exception {
        // Convert features to array format expected by the model
        double[] featureArray = features.toFeatureArray();
        
        // Create input in the format expected by SageMaker
        Map<String, Object> input = new HashMap<>();
        input.put("instances", Arrays.asList(featureArray));
        
        return objectMapper.writeValueAsString(input);
    }
    
    /**
     * Parse model output from SageMaker response
     */
    private PredictionResult parseModelOutput(String userId, String responseBody) throws Exception {
        // Parse the JSON response from SageMaker
        Map<String, Object> response = objectMapper.readValue(responseBody, Map.class);
        
        // Extract prediction score
        double riskScore = 0.0;
        if (response.containsKey("predictions")) {
            List<Double> predictions = (List<Double>) response.get("predictions");
            if (!predictions.isEmpty()) {
                riskScore = predictions.get(0) * 100.0; // Convert to percentage
            }
        } else if (response.containsKey("score")) {
            riskScore = ((Number) response.get("score")).doubleValue() * 100.0;
        }
        
        // Ensure score is within valid range
        riskScore = Math.max(0.0, Math.min(100.0, riskScore));
        
        // Determine risk level and recommendations
        String riskLevel = categorizeRiskLevel(riskScore);
        List<String> recommendations = generateRecommendations(riskScore, riskLevel);
        
        return new PredictionResult(userId, riskScore, riskLevel, recommendations, Instant.now());
    }
    
    /**
     * Create fallback prediction when model is unavailable
     */
    private PredictionResult createFallbackPrediction(String userId, String errorMessage) {
        logger.warn("Creating fallback prediction for user {}: {}", userId, errorMessage);
        
        // Use simple rule-based fallback
        double fallbackScore = 50.0; // Medium risk as default
        String riskLevel = "MEDIUM";
        List<String> recommendations = Arrays.asList(
            "Model unavailable - using fallback prediction",
            "Monitor user behavior closely",
            "Consider manual review"
        );
        
        return new PredictionResult(userId, fallbackScore, riskLevel, recommendations, Instant.now(), errorMessage);
    }
    
    /**
     * Categorize risk level based on score
     */
    private String categorizeRiskLevel(double score) {
        if (score < 30) {
            return "LOW";
        } else if (score < 60) {
            return "MEDIUM";
        } else {
            return "HIGH";
        }
    }
    
    /**
     * Generate recommendations based on risk score and level
     */
    private List<String> generateRecommendations(double riskScore, String riskLevel) {
        List<String> recommendations = new ArrayList<>();
        
        switch (riskLevel) {
            case "HIGH":
                recommendations.add("Immediate intervention required - high exit risk detected");
                recommendations.add("Trigger priority support outreach within 2 hours");
                recommendations.add("Assign dedicated customer success manager");
                recommendations.add("Provide personalized assistance and guidance");
                break;
                
            case "MEDIUM":
                recommendations.add("Moderate exit risk - proactive engagement recommended");
                recommendations.add("Send personalized check-in email within 24 hours");
                recommendations.add("Offer additional resources and tutorials");
                recommendations.add("Monitor closely for behavior changes");
                break;
                
            case "LOW":
                recommendations.add("Low exit risk - maintain current engagement");
                recommendations.add("Continue standard user journey flow");
                recommendations.add("Provide value-added content and features");
                break;
        }
        
        // Add score-specific recommendations
        if (riskScore > 80) {
            recommendations.add("Critical: Consider emergency intervention protocols");
        } else if (riskScore > 70) {
            recommendations.add("Urgent: Schedule immediate follow-up call");
        }
        
        return recommendations;
    }
    
    /**
     * Get model health status
     */
    public ModelHealthStatus getModelHealthStatus() {
        try {
            // Create a test prediction to check model availability
            ExitRiskFeatures testFeatures = createTestFeatures();
            String inputData = prepareModelInput(testFeatures);
            
            InvokeEndpointRequest request = InvokeEndpointRequest.builder()
                .endpointName(exitRiskEndpointName)
                .contentType("application/json")
                .body(SdkBytes.fromUtf8String(inputData))
                .build();
            
            long startTime = System.currentTimeMillis();
            InvokeEndpointResponse response = sageMakerRuntimeClient.invokeEndpoint(request);
            long responseTime = System.currentTimeMillis() - startTime;
            
            return new ModelHealthStatus(true, "Model is healthy", responseTime, Instant.now());
            
        } catch (Exception e) {
            logger.error("Model health check failed: {}", e.getMessage());
            return new ModelHealthStatus(false, e.getMessage(), -1, Instant.now());
        }
    }
    
    /**
     * Create test features for health check
     */
    private ExitRiskFeatures createTestFeatures() {
        ExitRiskFeatures testFeatures = new ExitRiskFeatures("health_check_user");
        testFeatures.setStruggleSignalCount7d(2);
        testFeatures.setVideoEngagementScore(65.0);
        testFeatures.setFeatureCompletionRate(80.0);
        testFeatures.setSessionFrequencyTrend(0.5);
        testFeatures.setSupportInteractionCount(1);
        testFeatures.setDaysSinceLastLogin(2);
        testFeatures.setApplicationProgressPercentage(75.0);
        testFeatures.setAvgSessionDuration(300.0);
        testFeatures.setTotalSessions(5);
        testFeatures.setErrorRate(10.0);
        testFeatures.setHelpSeekingBehavior(15.0);
        testFeatures.setContentEngagementScore(70.0);
        testFeatures.setPlatformUsagePattern("mixed");
        return testFeatures;
    }
    
    /**
     * Clear prediction cache
     */
    public void clearPredictionCache() {
        predictionCache.clear();
        logger.info("Prediction cache cleared");
    }
    
    /**
     * Get cache statistics
     */
    public Map<String, Object> getCacheStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("cacheSize", predictionCache.size());
        stats.put("cacheDurationMinutes", CACHE_DURATION_MINUTES);
        
        long expiredCount = predictionCache.values().stream()
            .mapToLong(result -> result.isExpired() ? 1 : 0)
            .sum();
        stats.put("expiredEntries", expiredCount);
        
        return stats;
    }
    
    /**
     * Prediction result class
     */
    public static class PredictionResult {
        private final String userId;
        private final double riskScore;
        private final String riskLevel;
        private final List<String> recommendations;
        private final Instant timestamp;
        private final String errorMessage;
        
        public PredictionResult(String userId, double riskScore, String riskLevel, 
                              List<String> recommendations, Instant timestamp) {
            this(userId, riskScore, riskLevel, recommendations, timestamp, null);
        }
        
        public PredictionResult(String userId, double riskScore, String riskLevel, 
                              List<String> recommendations, Instant timestamp, String errorMessage) {
            this.userId = userId;
            this.riskScore = riskScore;
            this.riskLevel = riskLevel;
            this.recommendations = recommendations != null ? new ArrayList<>(recommendations) : new ArrayList<>();
            this.timestamp = timestamp;
            this.errorMessage = errorMessage;
        }
        
        public boolean isExpired() {
            return timestamp.plus(30, ChronoUnit.MINUTES).isBefore(Instant.now());
        }
        
        public boolean hasError() {
            return errorMessage != null;
        }
        
        // Getters
        public String getUserId() { return userId; }
        public double getRiskScore() { return riskScore; }
        public String getRiskLevel() { return riskLevel; }
        public List<String> getRecommendations() { return new ArrayList<>(recommendations); }
        public Instant getTimestamp() { return timestamp; }
        public String getErrorMessage() { return errorMessage; }
    }
    
    /**
     * Create retry configuration for SageMaker operations
     */
    private RetryHandler.RetryConfig createRetryConfig() {
        return RetryHandler.RetryConfig.builder()
            .maxAttempts(3)
            .initialDelay(Duration.ofMillis(500))
            .backoffMultiplier(2.0)
            .maxDelay(Duration.ofSeconds(10))
            .jitterFactor(0.1)
            .retryIf(this::isRetryableException)
            .build();
    }
    
    /**
     * Determine if exception is retryable for SageMaker service
     */
    private boolean isRetryableException(Exception e) {
        String message = e.getMessage();
        if (message != null) {
            String lowerMessage = message.toLowerCase();
            return lowerMessage.contains("throttl") ||
                   lowerMessage.contains("rate limit") ||
                   lowerMessage.contains("timeout") ||
                   lowerMessage.contains("temporarily unavailable") ||
                   lowerMessage.contains("service unavailable") ||
                   lowerMessage.contains("model loading") ||
                   lowerMessage.contains("endpoint warming");
        }
        return false;
    }
    
    /**
     * Model health status class
     */
    public static class ModelHealthStatus {
        private final boolean healthy;
        private final String message;
        private final long responseTimeMs;
        private final Instant checkTime;
        
        public ModelHealthStatus(boolean healthy, String message, long responseTimeMs, Instant checkTime) {
            this.healthy = healthy;
            this.message = message;
            this.responseTimeMs = responseTimeMs;
            this.checkTime = checkTime;
        }
        
        // Getters
        public boolean isHealthy() { return healthy; }
        public String getMessage() { return message; }
        public long getResponseTimeMs() { return responseTimeMs; }
        public Instant getCheckTime() { return checkTime; }
    }
}