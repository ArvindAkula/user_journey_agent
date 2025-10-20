package com.userjourney.analytics.controller;

import com.userjourney.analytics.model.ExitRiskFeatures;
import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.service.SageMakerPredictiveService;
import com.userjourney.analytics.service.FeatureEngineeringService;
import com.userjourney.analytics.service.EventCollectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * REST Controller for predictive analytics and exit risk prediction
 */
@RestController
@RequestMapping("/api/predictive")
@CrossOrigin(origins = "*")
public class PredictiveAnalyticsController {
    
    private static final Logger logger = LoggerFactory.getLogger(PredictiveAnalyticsController.class);
    
    @Autowired
    private SageMakerPredictiveService sageMakerPredictiveService;
    
    @Autowired
    private FeatureEngineeringService featureEngineeringService;
    
    @Autowired
    private EventCollectionService eventCollectionService;
    
    /**
     * Predict exit risk for a specific user
     */
    @GetMapping("/exit-risk/{userId}")
    public ResponseEntity<ExitRiskPredictionResponse> predictExitRisk(@PathVariable String userId) {
        try {
            logger.info("Predicting exit risk for user: {}", userId);
            
            // Get user events
            List<UserEvent> userEvents = eventCollectionService.getUserEventHistory(userId, 1000, null, null);
            
            if (userEvents.isEmpty()) {
                return ResponseEntity.ok(new ExitRiskPredictionResponse(
                    userId, 0.0, "LOW", Arrays.asList("No user data available for prediction"), 
                    System.currentTimeMillis(), "insufficient_data"
                ));
            }
            
            // Extract features
            ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(userId, userEvents, null);
            
            // Make prediction
            SageMakerPredictiveService.PredictionResult result = sageMakerPredictiveService.predictExitRisk(features);
            
            // Convert to response format
            ExitRiskPredictionResponse response = new ExitRiskPredictionResponse(
                result.getUserId(),
                result.getRiskScore(),
                result.getRiskLevel(),
                result.getRecommendations(),
                result.getTimestamp().toEpochMilli(),
                result.getErrorMessage()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Failed to predict exit risk for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.ok(new ExitRiskPredictionResponse(
                userId, 50.0, "MEDIUM", Arrays.asList("Prediction failed: " + e.getMessage()), 
                System.currentTimeMillis(), "prediction_error"
            ));
        }
    }
    
    /**
     * Predict exit risk asynchronously
     */
    @GetMapping("/exit-risk/{userId}/async")
    public CompletableFuture<ResponseEntity<ExitRiskPredictionResponse>> predictExitRiskAsync(@PathVariable String userId) {
        logger.info("Async predicting exit risk for user: {}", userId);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Get user events
                List<UserEvent> userEvents = eventCollectionService.getUserEventHistory(userId, 1000, null, null);
                
                if (userEvents.isEmpty()) {
                    return ResponseEntity.ok(new ExitRiskPredictionResponse(
                        userId, 0.0, "LOW", Arrays.asList("No user data available for prediction"), 
                        System.currentTimeMillis(), "insufficient_data"
                    ));
                }
                
                // Extract features
                ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(userId, userEvents, null);
                
                // Make prediction
                SageMakerPredictiveService.PredictionResult result = sageMakerPredictiveService.predictExitRisk(features);
                
                // Convert to response format
                ExitRiskPredictionResponse response = new ExitRiskPredictionResponse(
                    result.getUserId(),
                    result.getRiskScore(),
                    result.getRiskLevel(),
                    result.getRecommendations(),
                    result.getTimestamp().toEpochMilli(),
                    result.getErrorMessage()
                );
                
                return ResponseEntity.ok(response);
                
            } catch (Exception e) {
                logger.error("Async prediction failed for user {}: {}", userId, e.getMessage(), e);
                return ResponseEntity.ok(new ExitRiskPredictionResponse(
                    userId, 50.0, "MEDIUM", Arrays.asList("Async prediction failed: " + e.getMessage()), 
                    System.currentTimeMillis(), "async_prediction_error"
                ));
            }
        });
    }
    
    /**
     * Batch predict exit risk for multiple users
     */
    @PostMapping("/exit-risk/batch")
    public ResponseEntity<BatchPredictionResponse> batchPredictExitRisk(@RequestBody BatchPredictionRequest request) {
        try {
            logger.info("Batch predicting exit risk for {} users", request.getUserIds().size());
            
            List<ExitRiskFeatures> featuresList = new ArrayList<>();
            
            // Extract features for each user
            for (String userId : request.getUserIds()) {
                try {
                    List<UserEvent> userEvents = eventCollectionService.getUserEventHistory(userId, 1000, null, null);
                    if (!userEvents.isEmpty()) {
                        ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(userId, userEvents, null);
                        featuresList.add(features);
                    }
                } catch (Exception e) {
                    logger.warn("Failed to extract features for user {}: {}", userId, e.getMessage());
                }
            }
            
            // Make batch predictions
            Map<String, SageMakerPredictiveService.PredictionResult> results;
            try {
                results = sageMakerPredictiveService.batchPredictExitRisk(featuresList);
            } catch (Exception e) {
                logger.error("Failed to batch predict exit risk", e);
                throw new RuntimeException("Failed to batch predict exit risk", e);
            }
            
            // Convert to response format
            Map<String, ExitRiskPredictionResponse> predictions = new HashMap<>();
            for (Map.Entry<String, SageMakerPredictiveService.PredictionResult> entry : results.entrySet()) {
                SageMakerPredictiveService.PredictionResult result = entry.getValue();
                predictions.put(entry.getKey(), new ExitRiskPredictionResponse(
                    result.getUserId(),
                    result.getRiskScore(),
                    result.getRiskLevel(),
                    result.getRecommendations(),
                    result.getTimestamp().toEpochMilli(),
                    result.getErrorMessage()
                ));
            }
            
            BatchPredictionResponse response = new BatchPredictionResponse(
                predictions.size(), predictions, System.currentTimeMillis()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Batch prediction failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(new BatchPredictionResponse(
                0, new HashMap<>(), System.currentTimeMillis(), "Batch prediction failed: " + e.getMessage()
            ));
        }
    }
    
    /**
     * Get user features for analysis
     */
    @GetMapping("/features/{userId}")
    public ResponseEntity<ExitRiskFeatures> getUserFeatures(@PathVariable String userId) {
        try {
            logger.info("Getting features for user: {}", userId);
            
            // Get user events
            List<UserEvent> userEvents = eventCollectionService.getUserEventHistory(userId, 1000, null, null);
            
            if (userEvents.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            // Extract features
            ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(userId, userEvents, null);
            
            return ResponseEntity.ok(features);
            
        } catch (Exception e) {
            logger.error("Failed to get features for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get model health status
     */
    @GetMapping("/model/health")
    public ResponseEntity<ModelHealthResponse> getModelHealth() {
        try {
            SageMakerPredictiveService.ModelHealthStatus status = sageMakerPredictiveService.getModelHealthStatus();
            
            ModelHealthResponse response = new ModelHealthResponse(
                status.isHealthy(),
                status.getMessage(),
                status.getResponseTimeMs(),
                status.getCheckTime().toEpochMilli()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Failed to get model health: {}", e.getMessage(), e);
            return ResponseEntity.ok(new ModelHealthResponse(
                false, "Health check failed: " + e.getMessage(), -1, System.currentTimeMillis()
            ));
        }
    }
    
    /**
     * Get prediction cache statistics
     */
    @GetMapping("/cache/stats")
    public ResponseEntity<Map<String, Object>> getCacheStats() {
        try {
            Map<String, Object> stats = sageMakerPredictiveService.getCacheStatistics();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Failed to get cache stats: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Clear prediction cache
     */
    @PostMapping("/cache/clear")
    public ResponseEntity<Map<String, String>> clearCache() {
        try {
            sageMakerPredictiveService.clearPredictionCache();
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Prediction cache cleared");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to clear cache: {}", e.getMessage(), e);
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", "Failed to clear cache: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    // Response DTOs
    
    public static class ExitRiskPredictionResponse {
        private String userId;
        private double riskScore;
        private String riskLevel;
        private List<String> recommendations;
        private long timestamp;
        private String errorMessage;
        
        public ExitRiskPredictionResponse() {}
        
        public ExitRiskPredictionResponse(String userId, double riskScore, String riskLevel, 
                                        List<String> recommendations, long timestamp, String errorMessage) {
            this.userId = userId;
            this.riskScore = riskScore;
            this.riskLevel = riskLevel;
            this.recommendations = recommendations;
            this.timestamp = timestamp;
            this.errorMessage = errorMessage;
        }
        
        // Getters and setters
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        
        public double getRiskScore() { return riskScore; }
        public void setRiskScore(double riskScore) { this.riskScore = riskScore; }
        
        public String getRiskLevel() { return riskLevel; }
        public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
        
        public List<String> getRecommendations() { return recommendations; }
        public void setRecommendations(List<String> recommendations) { this.recommendations = recommendations; }
        
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    }
    
    public static class BatchPredictionRequest {
        private List<String> userIds;
        
        public BatchPredictionRequest() {}
        
        public BatchPredictionRequest(List<String> userIds) {
            this.userIds = userIds;
        }
        
        public List<String> getUserIds() { return userIds; }
        public void setUserIds(List<String> userIds) { this.userIds = userIds; }
    }
    
    public static class BatchPredictionResponse {
        private int totalPredictions;
        private Map<String, ExitRiskPredictionResponse> predictions;
        private long timestamp;
        private String errorMessage;
        
        public BatchPredictionResponse() {}
        
        public BatchPredictionResponse(int totalPredictions, Map<String, ExitRiskPredictionResponse> predictions, 
                                     long timestamp) {
            this(totalPredictions, predictions, timestamp, null);
        }
        
        public BatchPredictionResponse(int totalPredictions, Map<String, ExitRiskPredictionResponse> predictions, 
                                     long timestamp, String errorMessage) {
            this.totalPredictions = totalPredictions;
            this.predictions = predictions;
            this.timestamp = timestamp;
            this.errorMessage = errorMessage;
        }
        
        // Getters and setters
        public int getTotalPredictions() { return totalPredictions; }
        public void setTotalPredictions(int totalPredictions) { this.totalPredictions = totalPredictions; }
        
        public Map<String, ExitRiskPredictionResponse> getPredictions() { return predictions; }
        public void setPredictions(Map<String, ExitRiskPredictionResponse> predictions) { this.predictions = predictions; }
        
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    }
    
    public static class ModelHealthResponse {
        private boolean healthy;
        private String message;
        private long responseTimeMs;
        private long checkTime;
        
        public ModelHealthResponse() {}
        
        public ModelHealthResponse(boolean healthy, String message, long responseTimeMs, long checkTime) {
            this.healthy = healthy;
            this.message = message;
            this.responseTimeMs = responseTimeMs;
            this.checkTime = checkTime;
        }
        
        // Getters and setters
        public boolean isHealthy() { return healthy; }
        public void setHealthy(boolean healthy) { this.healthy = healthy; }
        
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        
        public long getResponseTimeMs() { return responseTimeMs; }
        public void setResponseTimeMs(long responseTimeMs) { this.responseTimeMs = responseTimeMs; }
        
        public long getCheckTime() { return checkTime; }
        public void setCheckTime(long checkTime) { this.checkTime = checkTime; }
    }
}