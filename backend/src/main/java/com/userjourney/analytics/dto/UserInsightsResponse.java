package com.userjourney.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public class UserInsightsResponse {
    
    @JsonProperty("userId")
    private String userId;
    
    @JsonProperty("userSegment")
    private String userSegment;
    
    @JsonProperty("riskScore")
    private Double riskScore;
    
    @JsonProperty("riskLevel")
    private String riskLevel;
    
    @JsonProperty("sessionInfo")
    private SessionInfo sessionInfo;
    
    @JsonProperty("behaviorMetrics")
    private BehaviorMetrics behaviorMetrics;
    
    @JsonProperty("struggleSignals")
    private List<StruggleSignal> struggleSignals;
    
    @JsonProperty("recommendations")
    private List<String> recommendations;
    
    @JsonProperty("lastUpdated")
    private Long lastUpdated;
    
    public UserInsightsResponse() {}
    
    public UserInsightsResponse(String userId) {
        this.userId = userId;
        this.lastUpdated = System.currentTimeMillis();
    }
    
    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getUserSegment() { return userSegment; }
    public void setUserSegment(String userSegment) { this.userSegment = userSegment; }
    
    public Double getRiskScore() { return riskScore; }
    public void setRiskScore(Double riskScore) { this.riskScore = riskScore; }
    
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    
    public SessionInfo getSessionInfo() { return sessionInfo; }
    public void setSessionInfo(SessionInfo sessionInfo) { this.sessionInfo = sessionInfo; }
    
    public BehaviorMetrics getBehaviorMetrics() { return behaviorMetrics; }
    public void setBehaviorMetrics(BehaviorMetrics behaviorMetrics) { this.behaviorMetrics = behaviorMetrics; }
    
    public List<StruggleSignal> getStruggleSignals() { return struggleSignals; }
    public void setStruggleSignals(List<StruggleSignal> struggleSignals) { this.struggleSignals = struggleSignals; }
    
    public List<String> getRecommendations() { return recommendations; }
    public void setRecommendations(List<String> recommendations) { this.recommendations = recommendations; }
    
    public Long getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(Long lastUpdated) { this.lastUpdated = lastUpdated; }
    
    // Inner classes
    public static class SessionInfo {
        @JsonProperty("sessionId")
        private String sessionId;
        
        @JsonProperty("sessionDuration")
        private Long sessionDuration;
        
        @JsonProperty("eventCount")
        private Integer eventCount;
        
        @JsonProperty("lastActivity")
        private Long lastActivity;
        
        public SessionInfo() {}
        
        public SessionInfo(String sessionId, Long sessionDuration, Integer eventCount, Long lastActivity) {
            this.sessionId = sessionId;
            this.sessionDuration = sessionDuration;
            this.eventCount = eventCount;
            this.lastActivity = lastActivity;
        }
        
        // Getters and Setters
        public String getSessionId() { return sessionId; }
        public void setSessionId(String sessionId) { this.sessionId = sessionId; }
        
        public Long getSessionDuration() { return sessionDuration; }
        public void setSessionDuration(Long sessionDuration) { this.sessionDuration = sessionDuration; }
        
        public Integer getEventCount() { return eventCount; }
        public void setEventCount(Integer eventCount) { this.eventCount = eventCount; }
        
        public Long getLastActivity() { return lastActivity; }
        public void setLastActivity(Long lastActivity) { this.lastActivity = lastActivity; }
    }
    
    public static class BehaviorMetrics {
        @JsonProperty("totalSessions")
        private Integer totalSessions;
        
        @JsonProperty("avgSessionDuration")
        private Double avgSessionDuration;
        
        @JsonProperty("featureAdoptionRate")
        private Double featureAdoptionRate;
        
        @JsonProperty("videoEngagementScore")
        private Double videoEngagementScore;
        
        @JsonProperty("struggleSignalCount")
        private Integer struggleSignalCount;
        
        public BehaviorMetrics() {}
        
        // Getters and Setters
        public Integer getTotalSessions() { return totalSessions; }
        public void setTotalSessions(Integer totalSessions) { this.totalSessions = totalSessions; }
        
        public Double getAvgSessionDuration() { return avgSessionDuration; }
        public void setAvgSessionDuration(Double avgSessionDuration) { this.avgSessionDuration = avgSessionDuration; }
        
        public Double getFeatureAdoptionRate() { return featureAdoptionRate; }
        public void setFeatureAdoptionRate(Double featureAdoptionRate) { this.featureAdoptionRate = featureAdoptionRate; }
        
        public Double getVideoEngagementScore() { return videoEngagementScore; }
        public void setVideoEngagementScore(Double videoEngagementScore) { this.videoEngagementScore = videoEngagementScore; }
        
        public Integer getStruggleSignalCount() { return struggleSignalCount; }
        public void setStruggleSignalCount(Integer struggleSignalCount) { this.struggleSignalCount = struggleSignalCount; }
    }
    
    public static class StruggleSignal {
        @JsonProperty("feature")
        private String feature;
        
        @JsonProperty("attemptCount")
        private Integer attemptCount;
        
        @JsonProperty("severity")
        private String severity;
        
        @JsonProperty("lastOccurrence")
        private Long lastOccurrence;
        
        @JsonProperty("resolved")
        private Boolean resolved;
        
        public StruggleSignal() {}
        
        public StruggleSignal(String feature, Integer attemptCount, String severity, Long lastOccurrence) {
            this.feature = feature;
            this.attemptCount = attemptCount;
            this.severity = severity;
            this.lastOccurrence = lastOccurrence;
            this.resolved = false;
        }
        
        // Getters and Setters
        public String getFeature() { return feature; }
        public void setFeature(String feature) { this.feature = feature; }
        
        public Integer getAttemptCount() { return attemptCount; }
        public void setAttemptCount(Integer attemptCount) { this.attemptCount = attemptCount; }
        
        public String getSeverity() { return severity; }
        public void setSeverity(String severity) { this.severity = severity; }
        
        public Long getLastOccurrence() { return lastOccurrence; }
        public void setLastOccurrence(Long lastOccurrence) { this.lastOccurrence = lastOccurrence; }
        
        public Boolean getResolved() { return resolved; }
        public void setResolved(Boolean resolved) { this.resolved = resolved; }
    }
}