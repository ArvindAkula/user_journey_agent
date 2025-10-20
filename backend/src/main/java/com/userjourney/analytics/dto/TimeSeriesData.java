package com.userjourney.analytics.dto;

public class TimeSeriesData {
    private String timestamp;
    private double value;
    private String metric;
    
    // Constructors
    public TimeSeriesData() {}
    
    private TimeSeriesData(Builder builder) {
        this.timestamp = builder.timestamp;
        this.value = builder.value;
        this.metric = builder.metric;
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String timestamp;
        private double value;
        private String metric;
        
        public Builder timestamp(String timestamp) {
            this.timestamp = timestamp;
            return this;
        }
        
        public Builder value(double value) {
            this.value = value;
            return this;
        }
        
        public Builder metric(String metric) {
            this.metric = metric;
            return this;
        }
        
        public TimeSeriesData build() {
            return new TimeSeriesData(this);
        }
    }
    
    // Getters and Setters
    public String getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
    
    public double getValue() {
        return value;
    }
    
    public void setValue(double value) {
        this.value = value;
    }
    
    public String getMetric() {
        return metric;
    }
    
    public void setMetric(String metric) {
        this.metric = metric;
    }
}