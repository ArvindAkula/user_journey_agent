package com.userjourney.analytics.dto;

import java.util.List;

public class StruggleSignalData {
    private String featureId;
    private String featureName;
    private int signalCount;
    private String severity;
    private String trend;
    private Long detectedAt;
    private String description;
    private List<String> recommendedActions;
    private Integer exitRiskScore;
    
    // Constructors
    public StruggleSignalData() {}
    
    private StruggleSignalData(Builder builder) {
        this.featureId = builder.featureId;
        this.featureName = builder.featureName;
        this.signalCount = builder.signalCount;
        this.severity = builder.severity;
        this.trend = builder.trend;
        this.detectedAt = builder.detectedAt;
        this.description = builder.description;
        this.recommendedActions = builder.recommendedActions;
        this.exitRiskScore = builder.exitRiskScore;
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String featureId;
        private String featureName;
        private int signalCount;
        private String severity;
        private String trend;
        private Long detectedAt;
        private String description;
        private List<String> recommendedActions;
        private Integer exitRiskScore;
        
        public Builder featureId(String featureId) {
            this.featureId = featureId;
            return this;
        }
        
        public Builder featureName(String featureName) {
            this.featureName = featureName;
            return this;
        }
        
        public Builder signalCount(int signalCount) {
            this.signalCount = signalCount;
            return this;
        }
        
        public Builder severity(String severity) {
            this.severity = severity;
            return this;
        }
        
        public Builder trend(String trend) {
            this.trend = trend;
            return this;
        }
        
        public Builder detectedAt(Long detectedAt) {
            this.detectedAt = detectedAt;
            return this;
        }
        
        public Builder description(String description) {
            this.description = description;
            return this;
        }
        
        public Builder recommendedActions(List<String> recommendedActions) {
            this.recommendedActions = recommendedActions;
            return this;
        }
        
        public Builder exitRiskScore(Integer exitRiskScore) {
            this.exitRiskScore = exitRiskScore;
            return this;
        }
        
        public StruggleSignalData build() {
            return new StruggleSignalData(this);
        }
    }
    
    // Getters and Setters
    public String getFeatureId() {
        return featureId;
    }
    
    public void setFeatureId(String featureId) {
        this.featureId = featureId;
    }
    
    public String getFeatureName() {
        return featureName;
    }
    
    public void setFeatureName(String featureName) {
        this.featureName = featureName;
    }
    
    public int getSignalCount() {
        return signalCount;
    }
    
    public void setSignalCount(int signalCount) {
        this.signalCount = signalCount;
    }
    
    public String getSeverity() {
        return severity;
    }
    
    public void setSeverity(String severity) {
        this.severity = severity;
    }
    
    public String getTrend() {
        return trend;
    }
    
    public void setTrend(String trend) {
        this.trend = trend;
    }
    
    public Long getDetectedAt() {
        return detectedAt;
    }
    
    public void setDetectedAt(Long detectedAt) {
        this.detectedAt = detectedAt;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public List<String> getRecommendedActions() {
        return recommendedActions;
    }
    
    public void setRecommendedActions(List<String> recommendedActions) {
        this.recommendedActions = recommendedActions;
    }
    
    public Integer getExitRiskScore() {
        return exitRiskScore;
    }
    
    public void setExitRiskScore(Integer exitRiskScore) {
        this.exitRiskScore = exitRiskScore;
    }
}