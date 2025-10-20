package com.userjourney.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class EventResponse {
    
    @JsonProperty("eventId")
    private String eventId;
    
    @JsonProperty("message")
    private String message;
    
    @JsonProperty("timestamp")
    private Long timestamp;
    
    @JsonProperty("status")
    private String status;
    
    public EventResponse() {}
    
    public EventResponse(String eventId, String message, Long timestamp) {
        this.eventId = eventId;
        this.message = message;
        this.timestamp = timestamp;
        this.status = eventId != null ? "success" : "error";
    }
    
    // Getters and Setters
    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public Long getTimestamp() { return timestamp; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
    
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}