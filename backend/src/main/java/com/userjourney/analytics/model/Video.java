package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;

public class Video {
    
    @NotBlank(message = "Video ID is required")
    @JsonProperty("id")
    private String id;
    
    @NotBlank(message = "Title is required")
    @JsonProperty("title")
    private String title;
    
    @JsonProperty("description")
    private String description;
    
    @JsonProperty("thumbnailUrl")
    private String thumbnailUrl;
    
    @NotBlank(message = "Video URL is required")
    @JsonProperty("videoUrl")
    private String videoUrl;
    
    @NotNull(message = "Duration is required")
    @JsonProperty("duration")
    private Integer duration; // Duration in seconds
    
    @JsonProperty("category")
    private String category;
    
    @JsonProperty("tags")
    private List<String> tags;
    
    @NotNull(message = "Upload date is required")
    @JsonProperty("uploadDate")
    private Instant uploadDate;
    
    @JsonProperty("isActive")
    private Boolean isActive = true;
    
    @JsonProperty("viewCount")
    private Long viewCount = 0L;
    
    @JsonProperty("averageRating")
    private Double averageRating = 0.0;
    
    @JsonProperty("metadata")
    private VideoMetadata metadata;
    
    // Constructors
    public Video() {}
    
    public Video(String id, String title, String videoUrl, Integer duration) {
        this.id = id;
        this.title = title;
        this.videoUrl = videoUrl;
        this.duration = duration;
        this.uploadDate = Instant.now();
        this.isActive = true;
        this.viewCount = 0L;
        this.averageRating = 0.0;
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }
    
    public String getVideoUrl() { return videoUrl; }
    public void setVideoUrl(String videoUrl) { this.videoUrl = videoUrl; }
    
    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }
    
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    
    public Instant getUploadDate() { return uploadDate; }
    public void setUploadDate(Instant uploadDate) { this.uploadDate = uploadDate; }
    
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    
    public Long getViewCount() { return viewCount; }
    public void setViewCount(Long viewCount) { this.viewCount = viewCount; }
    
    public Double getAverageRating() { return averageRating; }
    public void setAverageRating(Double averageRating) { this.averageRating = averageRating; }
    
    public VideoMetadata getMetadata() { return metadata; }
    public void setMetadata(VideoMetadata metadata) { this.metadata = metadata; }
    
    // Inner class for video metadata
    public static class VideoMetadata {
        private String resolution;
        private String format;
        private Long fileSize;
        private String language;
        private List<String> subtitleLanguages;
        private String difficulty;
        
        // Getters and Setters
        public String getResolution() { return resolution; }
        public void setResolution(String resolution) { this.resolution = resolution; }
        
        public String getFormat() { return format; }
        public void setFormat(String format) { this.format = format; }
        
        public Long getFileSize() { return fileSize; }
        public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
        
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
        
        public List<String> getSubtitleLanguages() { return subtitleLanguages; }
        public void setSubtitleLanguages(List<String> subtitleLanguages) { this.subtitleLanguages = subtitleLanguages; }
        
        public String getDifficulty() { return difficulty; }
        public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    }
}