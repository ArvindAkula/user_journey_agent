package com.userjourney.analytics.dto;

import java.time.LocalDate;
import java.util.Map;

/**
 * Event Count Aggregation DTO
 * 
 * Represents aggregated event counts from BigQuery
 */
public class EventCountAggregation {
    private LocalDate date;
    private Map<String, Long> eventCounts;
    private long totalEvents;
    private long uniqueUsers;

    // Constructors
    public EventCountAggregation() {}

    public EventCountAggregation(LocalDate date, Map<String, Long> eventCounts, long totalEvents, long uniqueUsers) {
        this.date = date;
        this.eventCounts = eventCounts;
        this.totalEvents = totalEvents;
        this.uniqueUsers = uniqueUsers;
    }

    // Getters and setters
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Map<String, Long> getEventCounts() { return eventCounts; }
    public void setEventCounts(Map<String, Long> eventCounts) { this.eventCounts = eventCounts; }

    public long getTotalEvents() { return totalEvents; }
    public void setTotalEvents(long totalEvents) { this.totalEvents = totalEvents; }

    public long getUniqueUsers() { return uniqueUsers; }
    public void setUniqueUsers(long uniqueUsers) { this.uniqueUsers = uniqueUsers; }
}
