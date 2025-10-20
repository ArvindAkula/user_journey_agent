package com.userjourney.analytics.controller;

import com.userjourney.analytics.model.*;
import com.userjourney.analytics.service.NovaContextAnalysisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * REST Controller for Nova context analysis endpoints
 */
@RestController
@RequestMapping("/api/nova")
@CrossOrigin(origins = "*")
public class NovaAnalysisController {
    
    private static final Logger logger = LoggerFactory.getLogger(NovaAnalysisController.class);
    
    @Autowired
    private NovaContextAnalysisService novaContextAnalysisService;
    
    /**
     * Analyze user context from events and profile
     */
    @PostMapping("/analyze/context")
    public CompletableFuture<ResponseEntity<NovaContextInsights>> analyzeUserContext(
            @RequestBody ContextAnalysisRequest request) {
        
        logger.info("Analyzing user context for user: {}", request.getUserProfile().getUserId());
        
        return novaContextAnalysisService.analyzeUserContext(
                request.getRecentEvents(), 
                request.getUserProfile()
        ).thenApply(insights -> {
            if (insights.isSuccess()) {
                return ResponseEntity.ok(insights);
            } else {
                return ResponseEntity.status(500).body(insights);
            }
        }).exceptionally(throwable -> {
            logger.error("Error in context analysis", throwable);
            NovaContextInsights errorInsights = NovaContextInsights.builder()
                    .userId(request.getUserProfile().getUserId())
                    .success(false)
                    .errorMessage(throwable.getMessage())
                    .build();
            return ResponseEntity.status(500).body(errorInsights);
        });
    }
    
    /**
     * Generate personalized recommendations
     */
    @PostMapping("/recommendations/{type}")
    public CompletableFuture<ResponseEntity<List<PersonalizedRecommendation>>> generateRecommendations(
            @PathVariable String type,
            @RequestBody UserProfile userProfile) {
        
        logger.info("Generating {} recommendations for user: {}", type, userProfile.getUserId());
        
        return novaContextAnalysisService.generateRecommendations(userProfile, type)
                .thenApply(recommendations -> ResponseEntity.ok(recommendations))
                .exceptionally(throwable -> {
                    logger.error("Error generating recommendations", throwable);
                    return ResponseEntity.status(500).body(List.of());
                });
    }
    
    /**
     * Extract behavior insights from user events
     */
    @PostMapping("/analyze/behavior")
    public CompletableFuture<ResponseEntity<UserBehaviorInsights>> extractBehaviorInsights(
            @RequestBody BehaviorAnalysisRequest request) {
        
        logger.info("Extracting behavior insights for user: {}", request.getUserProfile().getUserId());
        
        return novaContextAnalysisService.extractBehaviorInsights(
                request.getUserEvents(),
                request.getUserProfile()
        ).thenApply(insights -> {
            if (insights.isSuccess()) {
                return ResponseEntity.ok(insights);
            } else {
                return ResponseEntity.status(500).body(insights);
            }
        }).exceptionally(throwable -> {
            logger.error("Error extracting behavior insights", throwable);
            UserBehaviorInsights errorInsights = UserBehaviorInsights.builder()
                    .userId(request.getUserProfile().getUserId())
                    .success(false)
                    .errorMessage(throwable.getMessage())
                    .build();
            return ResponseEntity.status(500).body(errorInsights);
        });
    }
    
    /**
     * Get user insights summary combining context and behavior analysis
     */
    @GetMapping("/insights/{userId}")
    public CompletableFuture<ResponseEntity<UserInsightsSummary>> getUserInsightsSummary(
            @PathVariable String userId,
            @RequestParam(defaultValue = "10") int eventLimit) {
        
        logger.info("Getting insights summary for user: {}", userId);
        
        // This would typically fetch user profile and recent events from database
        // For now, return a placeholder response
        UserInsightsSummary summary = UserInsightsSummary.builder()
                .userId(userId)
                .message("Nova insights integration ready. Provide user profile and events for analysis.")
                .build();
        
        return CompletableFuture.completedFuture(ResponseEntity.ok(summary));
    }
    
    /**
     * Request DTOs
     */
    public static class ContextAnalysisRequest {
        private List<UserEvent> recentEvents;
        private UserProfile userProfile;
        
        // Getters and Setters
        public List<UserEvent> getRecentEvents() {
            return recentEvents;
        }
        
        public void setRecentEvents(List<UserEvent> recentEvents) {
            this.recentEvents = recentEvents;
        }
        
        public UserProfile getUserProfile() {
            return userProfile;
        }
        
        public void setUserProfile(UserProfile userProfile) {
            this.userProfile = userProfile;
        }
    }
    
    public static class BehaviorAnalysisRequest {
        private List<UserEvent> userEvents;
        private UserProfile userProfile;
        
        // Getters and Setters
        public List<UserEvent> getUserEvents() {
            return userEvents;
        }
        
        public void setUserEvents(List<UserEvent> userEvents) {
            this.userEvents = userEvents;
        }
        
        public UserProfile getUserProfile() {
            return userProfile;
        }
        
        public void setUserProfile(UserProfile userProfile) {
            this.userProfile = userProfile;
        }
    }
    
    public static class UserInsightsSummary {
        private String userId;
        private String message;
        private NovaContextInsights contextInsights;
        private UserBehaviorInsights behaviorInsights;
        private List<PersonalizedRecommendation> recommendations;
        
        public static Builder builder() {
            return new Builder();
        }
        
        public static class Builder {
            private UserInsightsSummary summary = new UserInsightsSummary();
            
            public Builder userId(String userId) {
                summary.userId = userId;
                return this;
            }
            
            public Builder message(String message) {
                summary.message = message;
                return this;
            }
            
            public Builder contextInsights(NovaContextInsights contextInsights) {
                summary.contextInsights = contextInsights;
                return this;
            }
            
            public Builder behaviorInsights(UserBehaviorInsights behaviorInsights) {
                summary.behaviorInsights = behaviorInsights;
                return this;
            }
            
            public Builder recommendations(List<PersonalizedRecommendation> recommendations) {
                summary.recommendations = recommendations;
                return this;
            }
            
            public UserInsightsSummary build() {
                return summary;
            }
        }
        
        // Getters and Setters
        public String getUserId() {
            return userId;
        }
        
        public void setUserId(String userId) {
            this.userId = userId;
        }
        
        public String getMessage() {
            return message;
        }
        
        public void setMessage(String message) {
            this.message = message;
        }
        
        public NovaContextInsights getContextInsights() {
            return contextInsights;
        }
        
        public void setContextInsights(NovaContextInsights contextInsights) {
            this.contextInsights = contextInsights;
        }
        
        public UserBehaviorInsights getBehaviorInsights() {
            return behaviorInsights;
        }
        
        public void setBehaviorInsights(UserBehaviorInsights behaviorInsights) {
            this.behaviorInsights = behaviorInsights;
        }
        
        public List<PersonalizedRecommendation> getRecommendations() {
            return recommendations;
        }
        
        public void setRecommendations(List<PersonalizedRecommendation> recommendations) {
            this.recommendations = recommendations;
        }
    }
}