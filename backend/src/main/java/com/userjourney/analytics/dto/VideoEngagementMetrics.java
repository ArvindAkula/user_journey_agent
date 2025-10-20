package com.userjourney.analytics.dto;

import java.util.List;

public class VideoEngagementMetrics {
    private int totalViews;
    private double averageWatchTime;
    private double completionRate;
    private List<VideoMetric> topVideos;
    
    // Constructors
    public VideoEngagementMetrics() {}
    
    private VideoEngagementMetrics(Builder builder) {
        this.totalViews = builder.totalViews;
        this.averageWatchTime = builder.averageWatchTime;
        this.completionRate = builder.completionRate;
        this.topVideos = builder.topVideos;
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private int totalViews;
        private double averageWatchTime;
        private double completionRate;
        private List<VideoMetric> topVideos;
        
        public Builder totalViews(int totalViews) {
            this.totalViews = totalViews;
            return this;
        }
        
        public Builder averageWatchTime(double averageWatchTime) {
            this.averageWatchTime = averageWatchTime;
            return this;
        }
        
        public Builder completionRate(double completionRate) {
            this.completionRate = completionRate;
            return this;
        }
        
        public Builder topVideos(List<VideoMetric> topVideos) {
            this.topVideos = topVideos;
            return this;
        }
        
        public VideoEngagementMetrics build() {
            return new VideoEngagementMetrics(this);
        }
    }
    
    public static class VideoMetric {
        private String videoId;
        private String title;
        private int views;
        private double avgWatchTime;
        private double completionRate;
        
        // Constructors
        public VideoMetric() {}
        
        private VideoMetric(Builder builder) {
            this.videoId = builder.videoId;
            this.title = builder.title;
            this.views = builder.views;
            this.avgWatchTime = builder.avgWatchTime;
            this.completionRate = builder.completionRate;
        }
        
        public static Builder builder() {
            return new Builder();
        }
        
        public static class Builder {
            private String videoId;
            private String title;
            private int views;
            private double avgWatchTime;
            private double completionRate;
            
            public Builder videoId(String videoId) {
                this.videoId = videoId;
                return this;
            }
            
            public Builder title(String title) {
                this.title = title;
                return this;
            }
            
            public Builder views(int views) {
                this.views = views;
                return this;
            }
            
            public Builder avgWatchTime(double avgWatchTime) {
                this.avgWatchTime = avgWatchTime;
                return this;
            }
            
            public Builder completionRate(double completionRate) {
                this.completionRate = completionRate;
                return this;
            }
            
            public VideoMetric build() {
                return new VideoMetric(this);
            }
        }
        
        // Getters and Setters
        public String getVideoId() {
            return videoId;
        }
        
        public void setVideoId(String videoId) {
            this.videoId = videoId;
        }
        
        public String getTitle() {
            return title;
        }
        
        public void setTitle(String title) {
            this.title = title;
        }
        
        public int getViews() {
            return views;
        }
        
        public void setViews(int views) {
            this.views = views;
        }
        
        public double getAvgWatchTime() {
            return avgWatchTime;
        }
        
        public void setAvgWatchTime(double avgWatchTime) {
            this.avgWatchTime = avgWatchTime;
        }
        
        public double getCompletionRate() {
            return completionRate;
        }
        
        public void setCompletionRate(double completionRate) {
            this.completionRate = completionRate;
        }
    }
    
    // Getters and Setters
    public int getTotalViews() {
        return totalViews;
    }
    
    public void setTotalViews(int totalViews) {
        this.totalViews = totalViews;
    }
    
    public double getAverageWatchTime() {
        return averageWatchTime;
    }
    
    public void setAverageWatchTime(double averageWatchTime) {
        this.averageWatchTime = averageWatchTime;
    }
    
    public double getCompletionRate() {
        return completionRate;
    }
    
    public void setCompletionRate(double completionRate) {
        this.completionRate = completionRate;
    }
    
    public List<VideoMetric> getTopVideos() {
        return topVideos;
    }
    
    public void setTopVideos(List<VideoMetric> topVideos) {
        this.topVideos = topVideos;
    }
}