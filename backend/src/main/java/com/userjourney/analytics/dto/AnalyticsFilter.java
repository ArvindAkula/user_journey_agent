package com.userjourney.analytics.dto;

import java.time.LocalDate;
import java.util.List;

public class AnalyticsFilter {
    private DateRange dateRange;
    private List<String> userSegments;
    private List<String> platforms;
    private List<String> features;
    
    public static class DateRange {
        private LocalDate start;
        private LocalDate end;
        
        // Constructors
        public DateRange() {}
        
        public DateRange(LocalDate start, LocalDate end) {
            this.start = start;
            this.end = end;
        }
        
        // Getters and Setters
        public LocalDate getStart() {
            return start;
        }
        
        public void setStart(LocalDate start) {
            this.start = start;
        }
        
        public LocalDate getEnd() {
            return end;
        }
        
        public void setEnd(LocalDate end) {
            this.end = end;
        }
    }
    
    // Constructors
    public AnalyticsFilter() {}
    
    // Getters and Setters
    public DateRange getDateRange() {
        return dateRange;
    }
    
    public void setDateRange(DateRange dateRange) {
        this.dateRange = dateRange;
    }
    
    public List<String> getUserSegments() {
        return userSegments;
    }
    
    public void setUserSegments(List<String> userSegments) {
        this.userSegments = userSegments;
    }
    
    public List<String> getPlatforms() {
        return platforms;
    }
    
    public void setPlatforms(List<String> platforms) {
        this.platforms = platforms;
    }
    
    public List<String> getFeatures() {
        return features;
    }
    
    public void setFeatures(List<String> features) {
        this.features = features;
    }
    
    @Override
    public String toString() {
        return "AnalyticsFilter{" +
                "dateRange=" + dateRange +
                ", userSegments=" + userSegments +
                ", platforms=" + platforms +
                ", features=" + features +
                '}';
    }
}