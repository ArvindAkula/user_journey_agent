package com.userjourney.analytics.service;

import com.userjourney.analytics.model.Video;
import com.userjourney.analytics.model.VideoEngagement;
import com.userjourney.analytics.dto.VideoEngagementRequest;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class VideoService {
    
    private static final Logger logger = LoggerFactory.getLogger(VideoService.class);
    
    // In-memory storage for demo purposes - in production, this would use DynamoDB
    private final Map<String, Video> videoStorage = new HashMap<>();
    private final Map<String, List<VideoEngagement>> engagementStorage = new HashMap<>();
    
    public VideoService() {
        initializeDemoVideos();
    }
    
    /**
     * Get all videos with pagination and filtering
     */
    public List<Video> getAllVideos(int page, int size, String category, String search) {
        logger.info("Fetching videos - page: {}, size: {}, category: {}, search: {}", page, size, category, search);
        
        List<Video> allVideos = new ArrayList<>(videoStorage.values());
        
        // Filter by category if specified
        if (category != null && !category.isEmpty()) {
            allVideos = allVideos.stream()
                .filter(video -> category.equals(video.getCategory()))
                .collect(Collectors.toList());
        }
        
        // Filter by search term if specified
        if (search != null && !search.isEmpty()) {
            String searchLower = search.toLowerCase();
            allVideos = allVideos.stream()
                .filter(video -> 
                    video.getTitle().toLowerCase().contains(searchLower) ||
                    (video.getDescription() != null && video.getDescription().toLowerCase().contains(searchLower)) ||
                    (video.getTags() != null && video.getTags().stream()
                        .anyMatch(tag -> tag.toLowerCase().contains(searchLower)))
                )
                .collect(Collectors.toList());
        }
        
        // Filter only active videos
        allVideos = allVideos.stream()
            .filter(Video::getIsActive)
            .collect(Collectors.toList());
        
        // Sort by upload date (newest first)
        allVideos.sort((v1, v2) -> v2.getUploadDate().compareTo(v1.getUploadDate()));
        
        // Apply pagination
        int start = page * size;
        int end = Math.min(start + size, allVideos.size());
        
        if (start >= allVideos.size()) {
            return new ArrayList<>();
        }
        
        return allVideos.subList(start, end);
    }
    
    /**
     * Get video by ID
     */
    public Video getVideoById(String videoId) {
        logger.info("Fetching video by ID: {}", videoId);
        
        Video video = videoStorage.get(videoId);
        if (video == null) {
            throw new RuntimeException("Video not found with ID: " + videoId);
        }
        
        if (!video.getIsActive()) {
            throw new RuntimeException("Video is not available: " + videoId);
        }
        
        return video;
    }
    
    /**
     * Track video engagement
     */
    public String trackVideoEngagement(String videoId, VideoEngagementRequest request) {
        logger.info("Tracking engagement for video: {} by user: {}", videoId, request.getUserId());
        
        // Validate video exists
        getVideoById(videoId);
        
        // Create engagement record
        VideoEngagement engagement = new VideoEngagement();
        engagement.setVideoId(videoId);
        engagement.setUserId(request.getUserId());
        engagement.setSessionId(request.getSessionId());
        engagement.setWatchDuration(request.getWatchDuration());
        engagement.setCurrentPosition(request.getCurrentPosition());
        engagement.setCompleted(request.getCompleted());
        engagement.setRating(request.getRating());
        engagement.setTimestamp(Instant.now());
        
        // Set engagement data
        VideoEngagement.EngagementData engagementData = new VideoEngagement.EngagementData();
        engagementData.setPausePoints(request.getPausePoints());
        engagementData.setPlaybackSpeed(request.getPlaybackSpeed());
        
        if (request.getSeekEvents() != null) {
            List<VideoEngagement.SeekEvent> seekEvents = request.getSeekEvents().stream()
                .map(se -> new VideoEngagement.SeekEvent(se.getFromPosition(), se.getToPosition(), se.getTimestamp()))
                .collect(Collectors.toList());
            engagementData.setSeekEvents(seekEvents);
        }
        
        if (request.getQualityChanges() != null) {
            List<VideoEngagement.QualityChange> qualityChanges = request.getQualityChanges().stream()
                .map(qc -> new VideoEngagement.QualityChange(qc.getFromQuality(), qc.getToQuality(), qc.getTimestamp()))
                .collect(Collectors.toList());
            engagementData.setQualityChanges(qualityChanges);
        }
        
        if (request.getInteractionEvents() != null) {
            List<VideoEngagement.InteractionEvent> interactionEvents = request.getInteractionEvents().stream()
                .map(ie -> new VideoEngagement.InteractionEvent(ie.getEventType(), ie.getTimestamp(), ie.getValue()))
                .collect(Collectors.toList());
            engagementData.setInteractionEvents(interactionEvents);
        }
        
        engagement.setEngagementData(engagementData);
        
        // Set device info if provided
        if (request.getDeviceInfo() != null) {
            VideoEngagement.ContextData contextData = new VideoEngagement.ContextData();
            contextData.setPlatform(request.getDeviceInfo().getPlatform());
            contextData.setBrowser(request.getDeviceInfo().getBrowser());
            contextData.setScreenResolution(request.getDeviceInfo().getScreenResolution());
            contextData.setConnectionType(request.getDeviceInfo().getConnectionType());
            engagement.setContextData(contextData);
        }
        
        // Store engagement
        String engagementId = UUID.randomUUID().toString();
        engagement.setEngagementId(engagementId);
        
        engagementStorage.computeIfAbsent(videoId, k -> new ArrayList<>()).add(engagement);
        
        // Update video view count if this is a new session
        updateVideoMetrics(videoId, engagement);
        
        logger.info("Successfully tracked engagement: {} for video: {}", engagementId, videoId);
        return engagementId;
    }
    
    /**
     * Get video categories
     */
    public List<String> getVideoCategories() {
        logger.info("Fetching video categories");
        
        return videoStorage.values().stream()
            .filter(Video::getIsActive)
            .map(Video::getCategory)
            .filter(Objects::nonNull)
            .distinct()
            .sorted()
            .collect(Collectors.toList());
    }
    
    /**
     * Get video engagement analytics
     */
    public Map<String, Object> getVideoAnalytics(String videoId) {
        logger.info("Fetching analytics for video: {}", videoId);
        
        Video video = getVideoById(videoId);
        List<VideoEngagement> engagements = engagementStorage.getOrDefault(videoId, new ArrayList<>());
        
        Map<String, Object> analytics = new HashMap<>();
        analytics.put("video", video);
        analytics.put("totalViews", engagements.size());
        analytics.put("totalWatchTime", engagements.stream().mapToInt(VideoEngagement::getWatchDuration).sum());
        analytics.put("averageWatchTime", engagements.stream().mapToInt(VideoEngagement::getWatchDuration).average().orElse(0.0));
        analytics.put("completionRate", engagements.stream().mapToDouble(e -> e.getCompleted() ? 1.0 : 0.0).average().orElse(0.0));
        analytics.put("averageRating", engagements.stream()
            .filter(e -> e.getRating() != null)
            .mapToInt(VideoEngagement::getRating)
            .average().orElse(0.0));
        
        return analytics;
    }
    
    /**
     * Update video metrics based on engagement
     */
    private void updateVideoMetrics(String videoId, VideoEngagement engagement) {
        Video video = videoStorage.get(videoId);
        if (video != null) {
            // Update view count
            video.setViewCount(video.getViewCount() + 1);
            
            // Update average rating if rating is provided
            if (engagement.getRating() != null) {
                List<VideoEngagement> allEngagements = engagementStorage.getOrDefault(videoId, new ArrayList<>());
                double avgRating = allEngagements.stream()
                    .filter(e -> e.getRating() != null)
                    .mapToInt(VideoEngagement::getRating)
                    .average().orElse(0.0);
                video.setAverageRating(avgRating);
            }
        }
    }
    
    /**
     * Initialize demo videos for testing
     */
    private void initializeDemoVideos() {
        logger.info("Initializing demo videos");
        
        // Financial Planning Videos
        createDemoVideo("video-1", "Understanding Personal Budgets", 
            "Learn the basics of creating and maintaining a personal budget", 
            "financial-planning", 
            Arrays.asList("budget", "finance", "planning", "money-management"),
            480); // 8 minutes
            
        createDemoVideo("video-2", "Investment Strategies for Beginners", 
            "Introduction to different investment options and strategies", 
            "financial-planning", 
            Arrays.asList("investment", "stocks", "bonds", "portfolio"),
            720); // 12 minutes
            
        createDemoVideo("video-3", "Loan Types and Interest Rates", 
            "Understanding different types of loans and how interest rates work", 
            "financial-planning", 
            Arrays.asList("loans", "interest", "mortgage", "credit"),
            600); // 10 minutes
            
        // Educational Content
        createDemoVideo("video-4", "Digital Financial Tools", 
            "How to use digital tools for financial management", 
            "education", 
            Arrays.asList("digital", "tools", "apps", "technology"),
            540); // 9 minutes
            
        createDemoVideo("video-5", "Retirement Planning Basics", 
            "Essential concepts for planning your retirement", 
            "financial-planning", 
            Arrays.asList("retirement", "401k", "savings", "planning"),
            900); // 15 minutes
            
        // Tutorial Videos
        createDemoVideo("video-6", "Using Our Loan Calculator", 
            "Step-by-step guide to using the loan payment calculator", 
            "tutorial", 
            Arrays.asList("calculator", "tutorial", "how-to", "guide"),
            300); // 5 minutes
            
        createDemoVideo("video-7", "Document Upload Best Practices", 
            "How to securely upload and manage your financial documents", 
            "tutorial", 
            Arrays.asList("documents", "upload", "security", "management"),
            420); // 7 minutes
            
        createDemoVideo("video-8", "Profile Management Tips", 
            "Managing your user profile and preferences effectively", 
            "tutorial", 
            Arrays.asList("profile", "settings", "preferences", "account"),
            360); // 6 minutes
            
        logger.info("Initialized {} demo videos", videoStorage.size());
    }
    
    /**
     * Helper method to create demo videos
     */
    private void createDemoVideo(String id, String title, String description, String category, List<String> tags, int duration) {
        Video video = new Video(id, title, "https://example.com/videos/" + id + ".mp4", duration);
        video.setDescription(description);
        video.setCategory(category);
        video.setTags(tags);
        video.setThumbnailUrl("https://example.com/thumbnails/" + id + ".jpg");
        
        // Set metadata
        Video.VideoMetadata metadata = new Video.VideoMetadata();
        metadata.setResolution("1080p");
        metadata.setFormat("mp4");
        metadata.setFileSize((long) (duration * 1024 * 1024 / 60)); // Rough estimate
        metadata.setLanguage("en");
        metadata.setSubtitleLanguages(Arrays.asList("en", "es"));
        metadata.setDifficulty("beginner");
        video.setMetadata(metadata);
        
        videoStorage.put(id, video);
    }
}