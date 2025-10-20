package com.userjourney.analytics.dto;

public class UserJourneyMetrics {
    private int totalUsers;
    private int activeUsers;
    private double conversionRate;
    private double averageSessionDuration;
    private double dropOffRate;
    private int struggleSignals;
    
    // Constructors
    public UserJourneyMetrics() {}
    
    private UserJourneyMetrics(Builder builder) {
        this.totalUsers = builder.totalUsers;
        this.activeUsers = builder.activeUsers;
        this.conversionRate = builder.conversionRate;
        this.averageSessionDuration = builder.averageSessionDuration;
        this.dropOffRate = builder.dropOffRate;
        this.struggleSignals = builder.struggleSignals;
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private int totalUsers;
        private int activeUsers;
        private double conversionRate;
        private double averageSessionDuration;
        private double dropOffRate;
        private int struggleSignals;
        
        public Builder totalUsers(int totalUsers) {
            this.totalUsers = totalUsers;
            return this;
        }
        
        public Builder activeUsers(int activeUsers) {
            this.activeUsers = activeUsers;
            return this;
        }
        
        public Builder conversionRate(double conversionRate) {
            this.conversionRate = conversionRate;
            return this;
        }
        
        public Builder averageSessionDuration(double averageSessionDuration) {
            this.averageSessionDuration = averageSessionDuration;
            return this;
        }
        
        public Builder dropOffRate(double dropOffRate) {
            this.dropOffRate = dropOffRate;
            return this;
        }
        
        public Builder struggleSignals(int struggleSignals) {
            this.struggleSignals = struggleSignals;
            return this;
        }
        
        public UserJourneyMetrics build() {
            return new UserJourneyMetrics(this);
        }
    }
    
    // Getters and Setters
    public int getTotalUsers() {
        return totalUsers;
    }
    
    public void setTotalUsers(int totalUsers) {
        this.totalUsers = totalUsers;
    }
    
    public int getActiveUsers() {
        return activeUsers;
    }
    
    public void setActiveUsers(int activeUsers) {
        this.activeUsers = activeUsers;
    }
    
    public double getConversionRate() {
        return conversionRate;
    }
    
    public void setConversionRate(double conversionRate) {
        this.conversionRate = conversionRate;
    }
    
    public double getAverageSessionDuration() {
        return averageSessionDuration;
    }
    
    public void setAverageSessionDuration(double averageSessionDuration) {
        this.averageSessionDuration = averageSessionDuration;
    }
    
    public double getDropOffRate() {
        return dropOffRate;
    }
    
    public void setDropOffRate(double dropOffRate) {
        this.dropOffRate = dropOffRate;
    }
    
    public int getStruggleSignals() {
        return struggleSignals;
    }
    
    public void setStruggleSignals(int struggleSignals) {
        this.struggleSignals = struggleSignals;
    }
}