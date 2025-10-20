package com.userjourney.analytics.dto;

public class UserSegmentData {
    private String segment;
    private int userCount;
    private double conversionRate;
    private double avgEngagement;
    
    // Constructors
    public UserSegmentData() {}
    
    private UserSegmentData(Builder builder) {
        this.segment = builder.segment;
        this.userCount = builder.userCount;
        this.conversionRate = builder.conversionRate;
        this.avgEngagement = builder.avgEngagement;
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String segment;
        private int userCount;
        private double conversionRate;
        private double avgEngagement;
        
        public Builder segment(String segment) {
            this.segment = segment;
            return this;
        }
        
        public Builder userCount(int userCount) {
            this.userCount = userCount;
            return this;
        }
        
        public Builder conversionRate(double conversionRate) {
            this.conversionRate = conversionRate;
            return this;
        }
        
        public Builder avgEngagement(double avgEngagement) {
            this.avgEngagement = avgEngagement;
            return this;
        }
        
        public UserSegmentData build() {
            return new UserSegmentData(this);
        }
    }
    
    // Getters and Setters
    public String getSegment() {
        return segment;
    }
    
    public void setSegment(String segment) {
        this.segment = segment;
    }
    
    public int getUserCount() {
        return userCount;
    }
    
    public void setUserCount(int userCount) {
        this.userCount = userCount;
    }
    
    public double getConversionRate() {
        return conversionRate;
    }
    
    public void setConversionRate(double conversionRate) {
        this.conversionRate = conversionRate;
    }
    
    public double getAvgEngagement() {
        return avgEngagement;
    }
    
    public void setAvgEngagement(double avgEngagement) {
        this.avgEngagement = avgEngagement;
    }
}