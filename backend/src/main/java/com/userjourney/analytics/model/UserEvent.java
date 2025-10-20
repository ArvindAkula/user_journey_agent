package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class UserEvent {
    
    @JsonProperty("eventId")
    private String eventId;
    
    @NotBlank(message = "Event type is required")
    @JsonProperty("eventType")
    private String eventType;
    
    @NotBlank(message = "User ID is required")
    @JsonProperty("userId")
    private String userId;
    
    @NotBlank(message = "Session ID is required")
    @JsonProperty("sessionId")
    private String sessionId;
    
    @NotNull(message = "Timestamp is required")
    @JsonProperty("timestamp")
    private Long timestamp;
    
    @JsonProperty("eventData")
    private EventData eventData;
    
    @JsonProperty("deviceInfo")
    private DeviceInfo deviceInfo;
    
    @JsonProperty("userContext")
    private UserContext userContext;
    
    // Constructors
    public UserEvent() {}
    
    public UserEvent(String eventType, String userId, String sessionId, Long timestamp) {
        this.eventType = eventType;
        this.userId = userId;
        this.sessionId = sessionId;
        this.timestamp = timestamp;
    }
    
    // Getters and Setters
    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    
    public Long getTimestamp() { return timestamp; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
    
    public EventData getEventData() { return eventData; }
    public void setEventData(EventData eventData) { this.eventData = eventData; }
    
    public DeviceInfo getDeviceInfo() { return deviceInfo; }
    public void setDeviceInfo(DeviceInfo deviceInfo) { this.deviceInfo = deviceInfo; }
    
    public UserContext getUserContext() { return userContext; }
    public void setUserContext(UserContext userContext) { this.userContext = userContext; }
    
    // Inner classes for nested data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EventData {
        private String feature;
        private String videoId;
        private Integer duration;
        private Double completionRate;
        private Integer attemptCount;
        private String errorType;
        private Integer watchDuration;
        private List<Integer> pausePoints;
        private List<TimeRange> skipSegments;
        private Double playbackSpeed;
        private String page;
        private String action;
        private Integer calculationsCompleted;
        private Boolean success;
        
        // Getters and Setters
        public String getFeature() { return feature; }
        public void setFeature(String feature) { this.feature = feature; }
        
        public String getVideoId() { return videoId; }
        public void setVideoId(String videoId) { this.videoId = videoId; }
        
        public Integer getDuration() { return duration; }
        public void setDuration(Integer duration) { this.duration = duration; }
        
        public Double getCompletionRate() { return completionRate; }
        public void setCompletionRate(Double completionRate) { this.completionRate = completionRate; }
        
        public Integer getAttemptCount() { return attemptCount; }
        public void setAttemptCount(Integer attemptCount) { this.attemptCount = attemptCount; }
        
        public String getErrorType() { return errorType; }
        public void setErrorType(String errorType) { this.errorType = errorType; }
        
        public Integer getWatchDuration() { return watchDuration; }
        public void setWatchDuration(Integer watchDuration) { this.watchDuration = watchDuration; }
        
        public List<Integer> getPausePoints() { return pausePoints; }
        public void setPausePoints(List<Integer> pausePoints) { this.pausePoints = pausePoints; }
        
        public List<TimeRange> getSkipSegments() { return skipSegments; }
        public void setSkipSegments(List<TimeRange> skipSegments) { this.skipSegments = skipSegments; }
        
        public Double getPlaybackSpeed() { return playbackSpeed; }
        public void setPlaybackSpeed(Double playbackSpeed) { this.playbackSpeed = playbackSpeed; }
        
        public String getPage() { return page; }
        public void setPage(String page) { this.page = page; }
        
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        
        public Integer getCalculationsCompleted() { return calculationsCompleted; }
        public void setCalculationsCompleted(Integer calculationsCompleted) { this.calculationsCompleted = calculationsCompleted; }
        
        public Boolean getSuccess() { return success; }
        public void setSuccess(Boolean success) { this.success = success; }
    }
    
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DeviceInfo {
        private String platform;
        private String appVersion;
        private String deviceModel;
        
        // Getters and Setters
        public String getPlatform() { return platform; }
        public void setPlatform(String platform) { this.platform = platform; }
        
        public String getAppVersion() { return appVersion; }
        public void setAppVersion(String appVersion) { this.appVersion = appVersion; }
        
        public String getDeviceModel() { return deviceModel; }
        public void setDeviceModel(String deviceModel) { this.deviceModel = deviceModel; }
    }
    
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UserContext {
        private String userSegment;
        private String sessionStage;
        private List<String> previousActions;
        private String deviceType;
        private String browserInfo;
        private String location;
        private String persona;
        
        // Getters and Setters
        public String getUserSegment() { return userSegment; }
        public void setUserSegment(String userSegment) { this.userSegment = userSegment; }
        
        public String getSessionStage() { return sessionStage; }
        public void setSessionStage(String sessionStage) { this.sessionStage = sessionStage; }
        
        public List<String> getPreviousActions() { return previousActions; }
        public void setPreviousActions(List<String> previousActions) { this.previousActions = previousActions; }
        
        public String getDeviceType() { return deviceType; }
        public void setDeviceType(String deviceType) { this.deviceType = deviceType; }
        
        public String getBrowserInfo() { return browserInfo; }
        public void setBrowserInfo(String browserInfo) { this.browserInfo = browserInfo; }
        
        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }
        
        public String getPersona() { return persona; }
        public void setPersona(String persona) { this.persona = persona; }
    }
    
    @JsonIgnoreProperties(ignoreUnknown = true)
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