package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Model representing user behavior insights extracted by Nova
 */
public class UserBehaviorInsights {
    
    @JsonProperty("userId")
    private String userId;
    
    @JsonProperty("behaviorPatterns")
    private List<String> behaviorPatterns;
    
    @JsonProperty("engagementIndicators")
    private List<String> engagementIndicators;
    
    @JsonProperty("frictionPoints")
    private List<String> frictionPoints;
    
    @JsonProperty("successIndicators")
    private List<String> successIndicators;
    
    @JsonProperty("optimizationRecommendations")
    private List<String> optimizationRecommendations;
    
    @JsonProperty("analysisText")
    private String analysisText;
    
    @JsonProperty("confidence")
    private double confidence;
    
    @JsonProperty("timestamp")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime timestamp;
    
    @JsonProperty("success")
    private boolean success;
    
    @JsonProperty("errorMessage")
    private String errorMessage;
    
    // Default constructor
    public UserBehaviorInsights() {}
    
    // Builder pattern
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private UserBehaviorInsights insights = new UserBehaviorInsights();
        
        public Builder userId(String userId) {
            insights.userId = userId;
            return this;
        }
        
        public Builder behaviorPatterns(List<String> behaviorPatterns) {
            insights.behaviorPatterns = behaviorPatterns;
            return this;
        }
        
        public Builder engagementIndicators(List<String> engagementIndicators) {
            insights.engagementIndicators = engagementIndicators;
            return this;
        }
        
        public Builder frictionPoints(List<String> frictionPoints) {
            insights.frictionPoints = frictionPoints;
            return this;
        }
        
        public Builder successIndicators(List<String> successIndicators) {
            insights.successIndicators = successIndicators;
            return this;
        }
        
        public Builder optimizationRecommendations(List<String> optimizationRecommendations) {
            insights.optimizationRecommendations = optimizationRecommendations;
            return this;
        }
        
        public Builder analysisText(String analysisText) {
            insights.analysisText = analysisText;
            return this;
        }
        
        public Builder confidence(double confidence) {
            insights.confidence = confidence;
            return this;
        }
        
        public Builder timestamp(LocalDateTime timestamp) {
            insights.timestamp = timestamp;
            return this;
        }
        
        public Builder success(boolean success) {
            insights.success = success;
            return this;
        }
        
        public Builder errorMessage(String errorMessage) {
            insights.errorMessage = errorMessage;
            return this;
        }
        
        public UserBehaviorInsights build() {
            return insights;
        }
    }
    
    // Getters and Setters
    public String getUserId() {
        return userId;
    }
    
    public void setUserId(String userId) {
        this.userId = userId;
    }
    
    public List<String> getBehaviorPatterns() {
        return behaviorPatterns;
    }
    
    public void setBehaviorPatterns(List<String> behaviorPatterns) {
        this.behaviorPatterns = behaviorPatterns;
    }
    
    public List<String> getEngagementIndicators() {
        return engagementIndicators;
    }
    
    public void setEngagementIndicators(List<String> engagementIndicators) {
        this.engagementIndicators = engagementIndicators;
    }
    
    public List<String> getFrictionPoints() {
        return frictionPoints;
    }
    
    public void setFrictionPoints(List<String> frictionPoints) {
        this.frictionPoints = frictionPoints;
    }
    
    public List<String> getSuccessIndicators() {
        return successIndicators;
    }
    
    public void setSuccessIndicators(List<String> successIndicators) {
        this.successIndicators = successIndicators;
    }
    
    public List<String> getOptimizationRecommendations() {
        return optimizationRecommendations;
    }
    
    public void setOptimizationRecommendations(List<String> optimizationRecommendations) {
        this.optimizationRecommendations = optimizationRecommendations;
    }
    
    public String getAnalysisText() {
        return analysisText;
    }
    
    public void setAnalysisText(String analysisText) {
        this.analysisText = analysisText;
    }
    
    public double getConfidence() {
        return confidence;
    }
    
    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    
    public boolean isSuccess() {
        return success;
    }
    
    public void setSuccess(boolean success) {
        this.success = success;
    }
    
    public String getErrorMessage() {
        return errorMessage;
    }
    
    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
    
    @Override
    public String toString() {
        return "UserBehaviorInsights{" +
                "userId='" + userId + '\'' +
                ", behaviorPatterns=" + behaviorPatterns +
                ", engagementIndicators=" + engagementIndicators +
                ", frictionPoints=" + frictionPoints +
                ", confidence=" + confidence +
                ", success=" + success +
                ", timestamp=" + timestamp +
                '}';
    }
}