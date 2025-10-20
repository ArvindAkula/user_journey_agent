package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;

public class StruggleSignal {
    
    @NotBlank(message = "User ID is required")
    @JsonProperty("userId")
    private String userId;
    
    @NotBlank(message = "Feature ID is required")
    @JsonProperty("featureId")
    private String featureId;
    
    @NotNull(message = "Detection timestamp is required")
    @JsonProperty("detectedAt")
    private Instant detectedAt;
    
    @NotBlank(message = "Signal type is required")
    @JsonProperty("signalType")
    private String signalType;
    
    @NotBlank(message = "Severity is required")
    @JsonProperty("severity")
    private String severity;
    
    @JsonProperty("context")
    private Context context;
    
    @JsonProperty("interventionTriggered")
    private Boolean interventionTriggered;
    
    @JsonProperty("interventionType")
    private String interventionType;
    
    @JsonProperty("resolved")
    private Boolean resolved;
    
    @JsonProperty("resolutionTime")
    private Integer resolutionTime;
    
    @NotBlank(message = "Session ID is required")
    @JsonProperty("sessionId")
    private String sessionId;
    
    // Constructors
    public StruggleSignal() {}
    
    public StruggleSignal(String userId, String featureId, String signalType, String severity, String sessionId) {
        this.userId = userId;
        this.featureId = featureId;
        this.signalType = signalType;
        this.severity = severity;
        this.sessionId = sessionId;
        this.detectedAt = Instant.now();
        this.interventionTriggered = false;
        this.resolved = false;
    }
    
    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getFeatureId() { return featureId; }
    public void setFeatureId(String featureId) { this.featureId = featureId; }
    
    public Instant getDetectedAt() { return detectedAt; }
    public void setDetectedAt(Instant detectedAt) { this.detectedAt = detectedAt; }
    
    public String getSignalType() { return signalType; }
    public void setSignalType(String signalType) { this.signalType = signalType; }
    
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    
    public Context getContext() { return context; }
    public void setContext(Context context) { this.context = context; }
    
    public Boolean getInterventionTriggered() { return interventionTriggered; }
    public void setInterventionTriggered(Boolean interventionTriggered) { this.interventionTriggered = interventionTriggered; }
    
    public String getInterventionType() { return interventionType; }
    public void setInterventionType(String interventionType) { this.interventionType = interventionType; }
    
    public Boolean getResolved() { return resolved; }
    public void setResolved(Boolean resolved) { this.resolved = resolved; }
    
    public Integer getResolutionTime() { return resolutionTime; }
    public void setResolutionTime(Integer resolutionTime) { this.resolutionTime = resolutionTime; }
    
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    
    // Inner class
    public static class Context {
        private Integer attemptCount;
        private Integer timeSpent;
        private List<String> errorsEncountered;
        private List<String> userActions;
        
        // Getters and Setters
        public Integer getAttemptCount() { return attemptCount; }
        public void setAttemptCount(Integer attemptCount) { this.attemptCount = attemptCount; }
        
        public Integer getTimeSpent() { return timeSpent; }
        public void setTimeSpent(Integer timeSpent) { this.timeSpent = timeSpent; }
        
        public List<String> getErrorsEncountered() { return errorsEncountered; }
        public void setErrorsEncountered(List<String> errorsEncountered) { this.errorsEncountered = errorsEncountered; }
        
        public List<String> getUserActions() { return userActions; }
        public void setUserActions(List<String> userActions) { this.userActions = userActions; }
    }
}