package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;

public class VideoEngagement {
    
    @NotBlank(message = "User ID is required")
    @JsonProperty("userId")
    private String userId;
    
    @NotBlank(message = "Video ID is required")
    @JsonProperty("videoId")
    private String videoId;
    
    @JsonProperty("engagementData")
    private EngagementData engagementData;
    
    @JsonProperty("contextData")
    private ContextData contextData;
    
    @JsonProperty("intelligenceMetrics")
    private IntelligenceMetrics intelligenceMetrics;
    
    @NotNull(message = "Timestamp is required")
    @JsonProperty("timestamp")
    private Instant timestamp;
    
    @NotBlank(message = "Session ID is required")
    @JsonProperty("sessionId")
    private String sessionId;
    
    @JsonProperty("engagementId")
    private String engagementId;
    
    @JsonProperty("watchDuration")
    private Integer watchDuration;
    
    @JsonProperty("currentPosition")
    private Integer currentPosition;
    
    @JsonProperty("completed")
    private Boolean completed = false;
    
    @JsonProperty("rating")
    private Integer rating;
    
    // Constructors
    public VideoEngagement() {}
    
    public VideoEngagement(String userId, String videoId, String sessionId, Instant timestamp) {
        this.userId = userId;
        this.videoId = videoId;
        this.sessionId = sessionId;
        this.timestamp = timestamp;
    }
    
    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getVideoId() { return videoId; }
    public void setVideoId(String videoId) { this.videoId = videoId; }
    
    public EngagementData getEngagementData() { return engagementData; }
    public void setEngagementData(EngagementData engagementData) { this.engagementData = engagementData; }
    
    public ContextData getContextData() { return contextData; }
    public void setContextData(ContextData contextData) { this.contextData = contextData; }
    
    public IntelligenceMetrics getIntelligenceMetrics() { return intelligenceMetrics; }
    public void setIntelligenceMetrics(IntelligenceMetrics intelligenceMetrics) { this.intelligenceMetrics = intelligenceMetrics; }
    
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    
    public String getEngagementId() { return engagementId; }
    public void setEngagementId(String engagementId) { this.engagementId = engagementId; }
    
    public Integer getWatchDuration() { return watchDuration; }
    public void setWatchDuration(Integer watchDuration) { this.watchDuration = watchDuration; }
    
    public Integer getCurrentPosition() { return currentPosition; }
    public void setCurrentPosition(Integer currentPosition) { this.currentPosition = currentPosition; }
    
    public Boolean getCompleted() { return completed; }
    public void setCompleted(Boolean completed) { this.completed = completed; }
    
    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }
    
    // Inner classes
    public static class EngagementData {
        private Integer viewCount;
        private Integer totalWatchTime;
        private Double completionRate;
        private List<TimeRange> segmentsReplayed;
        private List<Integer> pausePoints;
        private List<TimeRange> skipSegments;
        private Double playbackSpeed;
        private List<SeekEvent> seekEvents;
        private List<QualityChange> qualityChanges;
        private List<InteractionEvent> interactionEvents;
        
        // Getters and Setters
        public Integer getViewCount() { return viewCount; }
        public void setViewCount(Integer viewCount) { this.viewCount = viewCount; }
        
        public Integer getTotalWatchTime() { return totalWatchTime; }
        public void setTotalWatchTime(Integer totalWatchTime) { this.totalWatchTime = totalWatchTime; }
        
        public Double getCompletionRate() { return completionRate; }
        public void setCompletionRate(Double completionRate) { this.completionRate = completionRate; }
        
        public List<TimeRange> getSegmentsReplayed() { return segmentsReplayed; }
        public void setSegmentsReplayed(List<TimeRange> segmentsReplayed) { this.segmentsReplayed = segmentsReplayed; }
        
        public List<Integer> getPausePoints() { return pausePoints; }
        public void setPausePoints(List<Integer> pausePoints) { this.pausePoints = pausePoints; }
        
        public List<TimeRange> getSkipSegments() { return skipSegments; }
        public void setSkipSegments(List<TimeRange> skipSegments) { this.skipSegments = skipSegments; }
        
        public Double getPlaybackSpeed() { return playbackSpeed; }
        public void setPlaybackSpeed(Double playbackSpeed) { this.playbackSpeed = playbackSpeed; }
        
        public List<SeekEvent> getSeekEvents() { return seekEvents; }
        public void setSeekEvents(List<SeekEvent> seekEvents) { this.seekEvents = seekEvents; }
        
        public List<QualityChange> getQualityChanges() { return qualityChanges; }
        public void setQualityChanges(List<QualityChange> qualityChanges) { this.qualityChanges = qualityChanges; }
        
        public List<InteractionEvent> getInteractionEvents() { return interactionEvents; }
        public void setInteractionEvents(List<InteractionEvent> interactionEvents) { this.interactionEvents = interactionEvents; }
    }
    
    public static class ContextData {
        private String accessedFrom;
        private String deviceType;
        private String sessionStage;
        private List<String> postViewActions;
        private String platform;
        private String browser;
        private String screenResolution;
        private String connectionType;
        
        // Getters and Setters
        public String getAccessedFrom() { return accessedFrom; }
        public void setAccessedFrom(String accessedFrom) { this.accessedFrom = accessedFrom; }
        
        public String getDeviceType() { return deviceType; }
        public void setDeviceType(String deviceType) { this.deviceType = deviceType; }
        
        public String getSessionStage() { return sessionStage; }
        public void setSessionStage(String sessionStage) { this.sessionStage = sessionStage; }
        
        public List<String> getPostViewActions() { return postViewActions; }
        public void setPostViewActions(List<String> postViewActions) { this.postViewActions = postViewActions; }
        
        public String getPlatform() { return platform; }
        public void setPlatform(String platform) { this.platform = platform; }
        
        public String getBrowser() { return browser; }
        public void setBrowser(String browser) { this.browser = browser; }
        
        public String getScreenResolution() { return screenResolution; }
        public void setScreenResolution(String screenResolution) { this.screenResolution = screenResolution; }
        
        public String getConnectionType() { return connectionType; }
        public void setConnectionType(String connectionType) { this.connectionType = connectionType; }
    }
    
    public static class IntelligenceMetrics {
        private Double interestScore;
        private List<String> comprehensionIndicators;
        private List<String> readinessSignals;
        
        // Getters and Setters
        public Double getInterestScore() { return interestScore; }
        public void setInterestScore(Double interestScore) { this.interestScore = interestScore; }
        
        public List<String> getComprehensionIndicators() { return comprehensionIndicators; }
        public void setComprehensionIndicators(List<String> comprehensionIndicators) { this.comprehensionIndicators = comprehensionIndicators; }
        
        public List<String> getReadinessSignals() { return readinessSignals; }
        public void setReadinessSignals(List<String> readinessSignals) { this.readinessSignals = readinessSignals; }
    }
    
    public static class SeekEvent {
        private Integer fromPosition;
        private Integer toPosition;
        private Long timestamp;
        
        public SeekEvent() {}
        
        public SeekEvent(Integer fromPosition, Integer toPosition, Long timestamp) {
            this.fromPosition = fromPosition;
            this.toPosition = toPosition;
            this.timestamp = timestamp;
        }
        
        public Integer getFromPosition() { return fromPosition; }
        public void setFromPosition(Integer fromPosition) { this.fromPosition = fromPosition; }
        
        public Integer getToPosition() { return toPosition; }
        public void setToPosition(Integer toPosition) { this.toPosition = toPosition; }
        
        public Long getTimestamp() { return timestamp; }
        public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
    }
    
    public static class QualityChange {
        private String fromQuality;
        private String toQuality;
        private Long timestamp;
        
        public QualityChange() {}
        
        public QualityChange(String fromQuality, String toQuality, Long timestamp) {
            this.fromQuality = fromQuality;
            this.toQuality = toQuality;
            this.timestamp = timestamp;
        }
        
        public String getFromQuality() { return fromQuality; }
        public void setFromQuality(String fromQuality) { this.fromQuality = fromQuality; }
        
        public String getToQuality() { return toQuality; }
        public void setToQuality(String toQuality) { this.toQuality = toQuality; }
        
        public Long getTimestamp() { return timestamp; }
        public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
    }
    
    public static class InteractionEvent {
        private String eventType;
        private Long timestamp;
        private String value;
        
        public InteractionEvent() {}
        
        public InteractionEvent(String eventType, Long timestamp, String value) {
            this.eventType = eventType;
            this.timestamp = timestamp;
            this.value = value;
        }
        
        public String getEventType() { return eventType; }
        public void setEventType(String eventType) { this.eventType = eventType; }
        
        public Long getTimestamp() { return timestamp; }
        public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
        
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
    }
    
    public static class TimeRange {
        private Integer start;
        private Integer end;
        
        public TimeRange() {}
        
        public TimeRange(Integer start, Integer end) {
            this.start = start;
            this.end = end;
        }
        
        public Integer getStart() { return start; }
        public void setStart(Integer start) { this.start = start; }
        
        public Integer getEnd() { return end; }
        public void setEnd(Integer end) { this.end = end; }
    }
}