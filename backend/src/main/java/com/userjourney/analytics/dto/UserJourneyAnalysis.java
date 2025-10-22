package com.userjourney.analytics.dto;

import java.time.Instant;
import java.util.List;

/**
 * User Journey Analysis DTO
 * 
 * Represents analyzed user journey data from BigQuery
 */
public class UserJourneyAnalysis {
    private String userId;
    private Instant startTime;
    private Instant endTime;
    private List<JourneyStep> steps;
    private int totalEvents;
    private long durationSeconds;
    private String conversionStatus;

    public static class JourneyStep {
        private String eventName;
        private Instant timestamp;
        private int sequenceNumber;
        private String pageLocation;

        public JourneyStep() {}

        public JourneyStep(String eventName, Instant timestamp, int sequenceNumber, String pageLocation) {
            this.eventName = eventName;
            this.timestamp = timestamp;
            this.sequenceNumber = sequenceNumber;
            this.pageLocation = pageLocation;
        }

        // Getters and setters
        public String getEventName() { return eventName; }
        public void setEventName(String eventName) { this.eventName = eventName; }
        public Instant getTimestamp() { return timestamp; }
        public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
        public int getSequenceNumber() { return sequenceNumber; }
        public void setSequenceNumber(int sequenceNumber) { this.sequenceNumber = sequenceNumber; }
        public String getPageLocation() { return pageLocation; }
        public void setPageLocation(String pageLocation) { this.pageLocation = pageLocation; }
    }

    // Constructors
    public UserJourneyAnalysis() {}

    // Getters and setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }

    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }

    public List<JourneyStep> getSteps() { return steps; }
    public void setSteps(List<JourneyStep> steps) { this.steps = steps; }

    public int getTotalEvents() { return totalEvents; }
    public void setTotalEvents(int totalEvents) { this.totalEvents = totalEvents; }

    public long getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(long durationSeconds) { this.durationSeconds = durationSeconds; }

    public String getConversionStatus() { return conversionStatus; }
    public void setConversionStatus(String conversionStatus) { this.conversionStatus = conversionStatus; }
}
