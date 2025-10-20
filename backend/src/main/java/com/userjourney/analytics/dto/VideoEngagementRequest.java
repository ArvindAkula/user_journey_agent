package com.userjourney.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import java.util.List;

public class VideoEngagementRequest {
    
    @NotBlank(message = "User ID is required")
    @JsonProperty("userId")
    private String userId;
    
    @NotBlank(message = "Session ID is required")
    @JsonProperty("sessionId")
    private String sessionId;
    
    @NotNull(message = "Watch duration is required")
    @Min(value = 0, message = "Watch duration must be non-negative")
    @JsonProperty("watchDuration")
    private Integer watchDuration; // Duration watched in seconds
    
    @Min(value = 0, message = "Current position must be non-negative")
    @JsonProperty("currentPosition")
    private Integer currentPosition; // Current position in video
    
    @JsonProperty("completed")
    private Boolean completed = false;
    
    @Min(value = 1, message = "Rating must be between 1 and 5")
    @Max(value = 5, message = "Rating must be between 1 and 5")
    @JsonProperty("rating")
    private Integer rating;
    
    @JsonProperty("pausePoints")
    private List<Integer> pausePoints; // Timestamps where user paused
    
    @JsonProperty("seekEvents")
    private List<SeekEvent> seekEvents; // Seek/skip events
    
    @JsonProperty("playbackSpeed")
    private Double playbackSpeed = 1.0;
    
    @JsonProperty("qualityChanges")
    private List<QualityChange> qualityChanges;
    
    @JsonProperty("interactionEvents")
    private List<InteractionEvent> interactionEvents;
    
    @JsonProperty("deviceInfo")
    private DeviceInfo deviceInfo;
    
    // Constructors
    public VideoEngagementRequest() {}
    
    public VideoEngagementRequest(String userId, String sessionId, Integer watchDuration) {
        this.userId = userId;
        this.sessionId = sessionId;
        this.watchDuration = watchDuration;
        this.completed = false;
        this.playbackSpeed = 1.0;
    }
    
    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    
    public Integer getWatchDuration() { return watchDuration; }
    public void setWatchDuration(Integer watchDuration) { this.watchDuration = watchDuration; }
    
    public Integer getCurrentPosition() { return currentPosition; }
    public void setCurrentPosition(Integer currentPosition) { this.currentPosition = currentPosition; }
    
    public Boolean getCompleted() { return completed; }
    public void setCompleted(Boolean completed) { this.completed = completed; }
    
    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }
    
    public List<Integer> getPausePoints() { return pausePoints; }
    public void setPausePoints(List<Integer> pausePoints) { this.pausePoints = pausePoints; }
    
    public List<SeekEvent> getSeekEvents() { return seekEvents; }
    public void setSeekEvents(List<SeekEvent> seekEvents) { this.seekEvents = seekEvents; }
    
    public Double getPlaybackSpeed() { return playbackSpeed; }
    public void setPlaybackSpeed(Double playbackSpeed) { this.playbackSpeed = playbackSpeed; }
    
    public List<QualityChange> getQualityChanges() { return qualityChanges; }
    public void setQualityChanges(List<QualityChange> qualityChanges) { this.qualityChanges = qualityChanges; }
    
    public List<InteractionEvent> getInteractionEvents() { return interactionEvents; }
    public void setInteractionEvents(List<InteractionEvent> interactionEvents) { this.interactionEvents = interactionEvents; }
    
    public DeviceInfo getDeviceInfo() { return deviceInfo; }
    public void setDeviceInfo(DeviceInfo deviceInfo) { this.deviceInfo = deviceInfo; }
    
    // Inner classes
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
        private String eventType; // "play", "pause", "fullscreen", "volume_change"
        private Long timestamp;
        private String value; // Additional data like volume level
        
        public InteractionEvent() {}
        
        public InteractionEvent(String eventType, Long timestamp) {
            this.eventType = eventType;
            this.timestamp = timestamp;
        }
        
        public String getEventType() { return eventType; }
        public void setEventType(String eventType) { this.eventType = eventType; }
        
        public Long getTimestamp() { return timestamp; }
        public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
        
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
    }
    
    public static class DeviceInfo {
        private String platform;
        private String browser;
        private String screenResolution;
        private String connectionType;
        
        public DeviceInfo() {}
        
        public String getPlatform() { return platform; }
        public void setPlatform(String platform) { this.platform = platform; }
        
        public String getBrowser() { return browser; }
        public void setBrowser(String browser) { this.browser = browser; }
        
        public String getScreenResolution() { return screenResolution; }
        public void setScreenResolution(String screenResolution) { this.screenResolution = screenResolution; }
        
        public String getConnectionType() { return connectionType; }
        public void setConnectionType(String connectionType) { this.connectionType = connectionType; }
    }
}