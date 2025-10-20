package com.userjourney.analytics.controller;

import com.userjourney.analytics.model.Video;
import com.userjourney.analytics.dto.VideoEngagementRequest;
import com.userjourney.analytics.service.VideoService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/videos")
@CrossOrigin(origins = "*", maxAge = 3600)
public class VideoController {
    
    private static final Logger logger = LoggerFactory.getLogger(VideoController.class);
    
    @Autowired
    private VideoService videoService;
    
    /**
     * Get all videos with pagination and filtering
     * GET /api/videos?page=0&size=10&category=financial-planning&search=budget
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search) {
        
        try {
            logger.info("Fetching videos - page: {}, size: {}, category: {}, search: {}", page, size, category, search);
            
            List<Video> videos = videoService.getAllVideos(page, size, category, search);
            
            Map<String, Object> response = Map.of(
                "videos", videos,
                "page", page,
                "size", size,
                "totalElements", videos.size(),
                "hasNext", videos.size() == size // Simple check for demo
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error fetching videos: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to fetch videos: " + e.getMessage()));
        }
    }
    
    /**
     * Get video by ID
     * GET /api/videos/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<Video> getVideoById(@PathVariable String id) {
        try {
            logger.info("Fetching video by ID: {}", id);
            
            Video video = videoService.getVideoById(id);
            
            return ResponseEntity.ok(video);
            
        } catch (RuntimeException e) {
            logger.error("Video not found: {}", id);
            return ResponseEntity.notFound().build();
            
        } catch (Exception e) {
            logger.error("Error fetching video {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Track video engagement
     * POST /api/videos/{id}/engagement
     */
    @PostMapping("/{id}/engagement")
    public ResponseEntity<Map<String, Object>> trackVideoEngagement(
            @PathVariable String id,
            @Valid @RequestBody VideoEngagementRequest request) {
        
        try {
            logger.info("Tracking engagement for video: {} by user: {}", id, request.getUserId());
            
            String engagementId = videoService.trackVideoEngagement(id, request);
            
            Map<String, Object> response = Map.of(
                "engagementId", engagementId,
                "videoId", id,
                "message", "Engagement tracked successfully",
                "timestamp", System.currentTimeMillis()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (RuntimeException e) {
            logger.error("Error tracking engagement for video {}: {}", id, e.getMessage());
            return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage()));
                
        } catch (Exception e) {
            logger.error("Error tracking engagement for video {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to track engagement: " + e.getMessage()));
        }
    }
    
    /**
     * Get video categories
     * GET /api/videos/categories
     */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> getVideoCategories() {
        try {
            logger.info("Fetching video categories");
            
            List<String> categories = videoService.getVideoCategories();
            
            return ResponseEntity.ok(categories);
            
        } catch (Exception e) {
            logger.error("Error fetching video categories: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get video analytics
     * GET /api/videos/{id}/analytics
     */
    @GetMapping("/{id}/analytics")
    public ResponseEntity<Map<String, Object>> getVideoAnalytics(@PathVariable String id) {
        try {
            logger.info("Fetching analytics for video: {}", id);
            
            Map<String, Object> analytics = videoService.getVideoAnalytics(id);
            
            return ResponseEntity.ok(analytics);
            
        } catch (RuntimeException e) {
            logger.error("Video not found for analytics: {}", id);
            return ResponseEntity.notFound().build();
            
        } catch (Exception e) {
            logger.error("Error fetching analytics for video {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Search videos
     * GET /api/videos/search?q=budget&category=financial-planning
     */
    @GetMapping("/search")
    public ResponseEntity<List<Video>> searchVideos(
            @RequestParam String q,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        try {
            logger.info("Searching videos with query: '{}', category: {}", q, category);
            
            List<Video> videos = videoService.getAllVideos(page, size, category, q);
            
            return ResponseEntity.ok(videos);
            
        } catch (Exception e) {
            logger.error("Error searching videos: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "timestamp", String.valueOf(System.currentTimeMillis()),
            "service", "video-library"
        ));
    }
}