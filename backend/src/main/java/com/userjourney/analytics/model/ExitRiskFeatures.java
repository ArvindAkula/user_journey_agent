package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

/**
 * Model representing features used for exit risk prediction
 */
public class ExitRiskFeatures {
    
    @NotNull
    @JsonProperty("userId")
    private String userId;
    
    @JsonProperty("featureTimestamp")
    private Instant featureTimestamp;
    
    // Behavioral features
    @JsonProperty("struggleSignalCount7d")
    private Integer struggleSignalCount7d;
    
    @JsonProperty("videoEngagementScore")
    private Double videoEngagementScore;
    
    @JsonProperty("featureCompletionRate")
    private Double featureCompletionRate;
    
    @JsonProperty("sessionFrequencyTrend")
    private Double sessionFrequencyTrend;
    
    @JsonProperty("supportInteractionCount")
    private Integer supportInteractionCount;
    
    @JsonProperty("daysSinceLastLogin")
    private Integer daysSinceLastLogin;
    
    @JsonProperty("applicationProgressPercentage")
    private Double applicationProgressPercentage;
    
    // Additional derived features
    @JsonProperty("avgSessionDuration")
    private Double avgSessionDuration;
    
    @JsonProperty("totalSessions")
    private Integer totalSessions;
    
    @JsonProperty("errorRate")
    private Double errorRate;
    
    @JsonProperty("helpSeekingBehavior")
    private Double helpSeekingBehavior;
    
    @JsonProperty("contentEngagementScore")
    private Double contentEngagementScore;
    
    @JsonProperty("platformUsagePattern")
    private String platformUsagePattern;
    
    // Target variable for training
    @JsonProperty("exitedWithin72h")
    private Boolean exitedWithin72h;
    
    // Constructors
    public ExitRiskFeatures() {}
    
    public ExitRiskFeatures(String userId) {
        this.userId = userId;
        this.featureTimestamp = Instant.now();
    }
    
    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public Instant getFeatureTimestamp() { return featureTimestamp; }
    public void setFeatureTimestamp(Instant featureTimestamp) { this.featureTimestamp = featureTimestamp; }
    
    public Integer getStruggleSignalCount7d() { return struggleSignalCount7d; }
    public void setStruggleSignalCount7d(Integer struggleSignalCount7d) { this.struggleSignalCount7d = struggleSignalCount7d; }
    
    public Double getVideoEngagementScore() { return videoEngagementScore; }
    public void setVideoEngagementScore(Double videoEngagementScore) { this.videoEngagementScore = videoEngagementScore; }
    
    public Double getFeatureCompletionRate() { return featureCompletionRate; }
    public void setFeatureCompletionRate(Double featureCompletionRate) { this.featureCompletionRate = featureCompletionRate; }
    
    public Double getSessionFrequencyTrend() { return sessionFrequencyTrend; }
    public void setSessionFrequencyTrend(Double sessionFrequencyTrend) { this.sessionFrequencyTrend = sessionFrequencyTrend; }
    
    public Integer getSupportInteractionCount() { return supportInteractionCount; }
    public void setSupportInteractionCount(Integer supportInteractionCount) { this.supportInteractionCount = supportInteractionCount; }
    
    public Integer getDaysSinceLastLogin() { return daysSinceLastLogin; }
    public void setDaysSinceLastLogin(Integer daysSinceLastLogin) { this.daysSinceLastLogin = daysSinceLastLogin; }
    
    public Double getApplicationProgressPercentage() { return applicationProgressPercentage; }
    public void setApplicationProgressPercentage(Double applicationProgressPercentage) { this.applicationProgressPercentage = applicationProgressPercentage; }
    
    public Double getAvgSessionDuration() { return avgSessionDuration; }
    public void setAvgSessionDuration(Double avgSessionDuration) { this.avgSessionDuration = avgSessionDuration; }
    
    public Integer getTotalSessions() { return totalSessions; }
    public void setTotalSessions(Integer totalSessions) { this.totalSessions = totalSessions; }
    
    public Double getErrorRate() { return errorRate; }
    public void setErrorRate(Double errorRate) { this.errorRate = errorRate; }
    
    public Double getHelpSeekingBehavior() { return helpSeekingBehavior; }
    public void setHelpSeekingBehavior(Double helpSeekingBehavior) { this.helpSeekingBehavior = helpSeekingBehavior; }
    
    public Double getContentEngagementScore() { return contentEngagementScore; }
    public void setContentEngagementScore(Double contentEngagementScore) { this.contentEngagementScore = contentEngagementScore; }
    
    public String getPlatformUsagePattern() { return platformUsagePattern; }
    public void setPlatformUsagePattern(String platformUsagePattern) { this.platformUsagePattern = platformUsagePattern; }
    
    public Boolean getExitedWithin72h() { return exitedWithin72h; }
    public void setExitedWithin72h(Boolean exitedWithin72h) { this.exitedWithin72h = exitedWithin72h; }
    
    /**
     * Convert features to array format for ML model input
     */
    public double[] toFeatureArray() {
        return new double[] {
            struggleSignalCount7d != null ? struggleSignalCount7d.doubleValue() : 0.0,
            videoEngagementScore != null ? videoEngagementScore : 0.0,
            featureCompletionRate != null ? featureCompletionRate : 0.0,
            sessionFrequencyTrend != null ? sessionFrequencyTrend : 0.0,
            supportInteractionCount != null ? supportInteractionCount.doubleValue() : 0.0,
            daysSinceLastLogin != null ? daysSinceLastLogin.doubleValue() : 0.0,
            applicationProgressPercentage != null ? applicationProgressPercentage : 0.0,
            avgSessionDuration != null ? avgSessionDuration : 0.0,
            totalSessions != null ? totalSessions.doubleValue() : 0.0,
            errorRate != null ? errorRate : 0.0,
            helpSeekingBehavior != null ? helpSeekingBehavior : 0.0,
            contentEngagementScore != null ? contentEngagementScore : 0.0,
            encodePlatformUsage(platformUsagePattern)
        };
    }
    
    /**
     * Encode platform usage pattern as numeric value
     */
    private double encodePlatformUsage(String pattern) {
        if (pattern == null) return 0.0;
        switch (pattern.toLowerCase()) {
            case "web_only": return 1.0;
            case "mobile_only": return 2.0;
            case "mixed": return 3.0;
            default: return 0.0;
        }
    }
    
    /**
     * Get feature names for model interpretation
     */
    public static String[] getFeatureNames() {
        return new String[] {
            "struggle_signal_count_7d",
            "video_engagement_score",
            "feature_completion_rate",
            "session_frequency_trend",
            "support_interaction_count",
            "days_since_last_login",
            "application_progress_percentage",
            "avg_session_duration",
            "total_sessions",
            "error_rate",
            "help_seeking_behavior",
            "content_engagement_score",
            "platform_usage_pattern"
        };
    }
}