package com.userjourney.analytics.service;

import com.userjourney.analytics.model.ExitRiskFeatures;
import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.model.UserProfile;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for engineering features from user behavior data for ML models
 */
@Service
public class FeatureEngineeringService {
    
    private static final Logger logger = LoggerFactory.getLogger(FeatureEngineeringService.class);
    
    /**
     * Extract features from user events and profile for exit risk prediction
     */
    public ExitRiskFeatures extractExitRiskFeatures(String userId, List<UserEvent> userEvents, UserProfile userProfile) {
        logger.debug("Extracting exit risk features for user: {}", userId);
        
        ExitRiskFeatures features = new ExitRiskFeatures(userId);
        
        if (userEvents.isEmpty()) {
            logger.warn("No events found for user: {}", userId);
            return features;
        }
        
        // Sort events by timestamp
        List<UserEvent> sortedEvents = userEvents.stream()
            .sorted(Comparator.comparing(UserEvent::getTimestamp))
            .collect(Collectors.toList());
        
        Instant now = Instant.now();
        Instant sevenDaysAgo = now.minus(7, ChronoUnit.DAYS);
        
        // Filter events for different time windows
        List<UserEvent> last7DaysEvents = filterEventsByTimeWindow(sortedEvents, sevenDaysAgo, now);
        List<UserEvent> last30DaysEvents = filterEventsByTimeWindow(sortedEvents, 
            now.minus(30, ChronoUnit.DAYS), now);
        
        // Extract behavioral features
        features.setStruggleSignalCount7d(calculateStruggleSignalCount(last7DaysEvents));
        features.setVideoEngagementScore(calculateVideoEngagementScore(last7DaysEvents));
        features.setFeatureCompletionRate(calculateFeatureCompletionRate(last7DaysEvents));
        features.setSessionFrequencyTrend(calculateSessionFrequencyTrend(sortedEvents));
        features.setSupportInteractionCount(calculateSupportInteractionCount(last30DaysEvents));
        features.setDaysSinceLastLogin(calculateDaysSinceLastLogin(sortedEvents, now));
        features.setApplicationProgressPercentage(calculateApplicationProgress(sortedEvents));
        
        // Extract session-based features
        features.setAvgSessionDuration(calculateAvgSessionDuration(last7DaysEvents));
        features.setTotalSessions(calculateTotalSessions(last7DaysEvents));
        
        // Extract error and help-seeking features
        features.setErrorRate(calculateErrorRate(last7DaysEvents));
        features.setHelpSeekingBehavior(calculateHelpSeekingBehavior(last7DaysEvents));
        
        // Extract content engagement features
        features.setContentEngagementScore(calculateContentEngagementScore(last7DaysEvents));
        features.setPlatformUsagePattern(determinePlatformUsagePattern(last7DaysEvents));
        
        logger.debug("Successfully extracted features for user: {}", userId);
        return features;
    }
    
    /**
     * Filter events by time window
     */
    private List<UserEvent> filterEventsByTimeWindow(List<UserEvent> events, Instant start, Instant end) {
        return events.stream()
            .filter(event -> {
                Instant eventTime = Instant.ofEpochMilli(event.getTimestamp());
                return eventTime.isAfter(start) && eventTime.isBefore(end);
            })
            .collect(Collectors.toList());
    }
    
    /**
     * Calculate struggle signal count in the last 7 days
     */
    private Integer calculateStruggleSignalCount(List<UserEvent> events) {
        return (int) events.stream()
            .filter(event -> "struggle_signal".equals(event.getEventType()))
            .count();
    }
    
    /**
     * Calculate video engagement score
     */
    private Double calculateVideoEngagementScore(List<UserEvent> events) {
        List<UserEvent> videoEvents = events.stream()
            .filter(event -> "video_engagement".equals(event.getEventType()))
            .filter(event -> event.getEventData() != null && event.getEventData().getCompletionRate() != null)
            .collect(Collectors.toList());
        
        if (videoEvents.isEmpty()) {
            return 0.0;
        }
        
        double avgCompletionRate = videoEvents.stream()
            .mapToDouble(event -> event.getEventData().getCompletionRate())
            .average()
            .orElse(0.0);
        
        // Weight by number of videos watched
        double videoCount = videoEvents.size();
        double engagementScore = avgCompletionRate * Math.min(1.0, videoCount / 5.0); // Normalize to 5 videos
        
        return Math.min(100.0, engagementScore);
    }
    
    /**
     * Calculate feature completion rate
     */
    private Double calculateFeatureCompletionRate(List<UserEvent> events) {
        Map<String, List<UserEvent>> featureEvents = events.stream()
            .filter(event -> "feature_interaction".equals(event.getEventType()))
            .filter(event -> event.getEventData() != null && event.getEventData().getFeature() != null)
            .collect(Collectors.groupingBy(event -> event.getEventData().getFeature()));
        
        if (featureEvents.isEmpty()) {
            return 0.0;
        }
        
        int completedFeatures = 0;
        int totalFeatures = featureEvents.size();
        
        for (Map.Entry<String, List<UserEvent>> entry : featureEvents.entrySet()) {
            List<UserEvent> featureEventList = entry.getValue();
            
            // Check if feature was completed (no struggle signals in last attempts)
            boolean hasRecentStruggle = featureEventList.stream()
                .sorted(Comparator.comparing(UserEvent::getTimestamp).reversed())
                .limit(3) // Check last 3 attempts
                .anyMatch(event -> event.getEventData().getAttemptCount() != null && 
                    event.getEventData().getAttemptCount() > 1);
            
            if (!hasRecentStruggle) {
                completedFeatures++;
            }
        }
        
        return (double) completedFeatures / totalFeatures * 100.0;
    }
    
    /**
     * Calculate session frequency trend
     */
    private Double calculateSessionFrequencyTrend(List<UserEvent> events) {
        if (events.size() < 2) {
            return 0.0;
        }
        
        // Group events by day
        Map<String, Long> dailySessionCounts = events.stream()
            .collect(Collectors.groupingBy(
                event -> {
                    Instant eventTime = Instant.ofEpochMilli(event.getTimestamp());
                    return eventTime.truncatedTo(ChronoUnit.DAYS).toString();
                },
                Collectors.counting()
            ));
        
        if (dailySessionCounts.size() < 2) {
            return 0.0;
        }
        
        // Calculate trend (simple linear regression slope)
        List<Map.Entry<String, Long>> sortedDays = dailySessionCounts.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .collect(Collectors.toList());
        
        double n = sortedDays.size();
        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (int i = 0; i < sortedDays.size(); i++) {
            double x = i + 1; // Day number
            double y = sortedDays.get(i).getValue(); // Session count
            
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }
        
        // Calculate slope (trend)
        double slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }
    
    /**
     * Calculate support interaction count
     */
    private Integer calculateSupportInteractionCount(List<UserEvent> events) {
        return (int) events.stream()
            .filter(event -> event.getEventData() != null)
            .filter(event -> "help_request".equals(event.getEventType()) || 
                           "support_chat".equals(event.getEventType()) ||
                           (event.getEventData().getFeature() != null && 
                            event.getEventData().getFeature().contains("help")))
            .count();
    }
    
    /**
     * Calculate days since last login
     */
    private Integer calculateDaysSinceLastLogin(List<UserEvent> events, Instant now) {
        if (events.isEmpty()) {
            return 999; // Large number indicating no recent activity
        }
        
        long lastEventTimestamp = events.stream()
            .mapToLong(UserEvent::getTimestamp)
            .max()
            .orElse(0);
        
        Instant lastEvent = Instant.ofEpochMilli(lastEventTimestamp);
        return (int) ChronoUnit.DAYS.between(lastEvent, now);
    }
    
    /**
     * Calculate application progress percentage
     */
    private Double calculateApplicationProgress(List<UserEvent> events) {
        // Define key milestones in the application process
        Set<String> milestones = Set.of(
            "registration", "profile_setup", "document_upload", 
            "verification", "application_submit", "approval"
        );
        
        Set<String> completedMilestones = events.stream()
            .filter(event -> event.getEventData() != null && event.getEventData().getFeature() != null)
            .map(event -> event.getEventData().getFeature())
            .filter(milestones::contains)
            .collect(Collectors.toSet());
        
        return (double) completedMilestones.size() / milestones.size() * 100.0;
    }
    
    /**
     * Calculate average session duration
     */
    private Double calculateAvgSessionDuration(List<UserEvent> events) {
        Map<String, List<UserEvent>> sessionEvents = events.stream()
            .collect(Collectors.groupingBy(UserEvent::getSessionId));
        
        if (sessionEvents.isEmpty()) {
            return 0.0;
        }
        
        double totalDuration = 0.0;
        int validSessions = 0;
        
        for (List<UserEvent> sessionEventList : sessionEvents.values()) {
            if (sessionEventList.size() >= 2) {
                long minTime = sessionEventList.stream().mapToLong(UserEvent::getTimestamp).min().orElse(0);
                long maxTime = sessionEventList.stream().mapToLong(UserEvent::getTimestamp).max().orElse(0);
                
                double duration = (maxTime - minTime) / 1000.0; // Convert to seconds
                if (duration > 0 && duration < 3600) { // Ignore sessions longer than 1 hour (likely errors)
                    totalDuration += duration;
                    validSessions++;
                }
            }
        }
        
        return validSessions > 0 ? totalDuration / validSessions : 0.0;
    }
    
    /**
     * Calculate total sessions
     */
    private Integer calculateTotalSessions(List<UserEvent> events) {
        return (int) events.stream()
            .map(UserEvent::getSessionId)
            .distinct()
            .count();
    }
    
    /**
     * Calculate error rate
     */
    private Double calculateErrorRate(List<UserEvent> events) {
        long totalInteractions = events.stream()
            .filter(event -> "feature_interaction".equals(event.getEventType()) || 
                           "struggle_signal".equals(event.getEventType()))
            .count();
        
        if (totalInteractions == 0) {
            return 0.0;
        }
        
        long errorEvents = events.stream()
            .filter(event -> event.getEventData() != null)
            .filter(event -> event.getEventData().getErrorType() != null || 
                           "struggle_signal".equals(event.getEventType()))
            .count();
        
        return (double) errorEvents / totalInteractions * 100.0;
    }
    
    /**
     * Calculate help-seeking behavior score
     */
    private Double calculateHelpSeekingBehavior(List<UserEvent> events) {
        long totalEvents = events.size();
        if (totalEvents == 0) {
            return 0.0;
        }
        
        long helpEvents = events.stream()
            .filter(event -> event.getEventData() != null)
            .filter(event -> {
                String feature = event.getEventData().getFeature();
                return feature != null && (feature.contains("help") || 
                                         feature.contains("tutorial") || 
                                         feature.contains("guide"));
            })
            .count();
        
        return (double) helpEvents / totalEvents * 100.0;
    }
    
    /**
     * Calculate content engagement score
     */
    private Double calculateContentEngagementScore(List<UserEvent> events) {
        List<UserEvent> contentEvents = events.stream()
            .filter(event -> "video_engagement".equals(event.getEventType()) || 
                           "page_view".equals(event.getEventType()) ||
                           "content_interaction".equals(event.getEventType()))
            .collect(Collectors.toList());
        
        if (contentEvents.isEmpty()) {
            return 0.0;
        }
        
        // Calculate engagement based on time spent and interaction depth
        double totalEngagement = 0.0;
        
        for (UserEvent event : contentEvents) {
            double eventEngagement = 0.0;
            
            if (event.getEventData() != null) {
                // Video engagement
                if (event.getEventData().getCompletionRate() != null) {
                    eventEngagement += event.getEventData().getCompletionRate() * 0.6;
                }
                
                // Duration engagement
                if (event.getEventData().getDuration() != null) {
                    double normalizedDuration = Math.min(1.0, event.getEventData().getDuration() / 300.0); // Normalize to 5 minutes
                    eventEngagement += normalizedDuration * 40.0;
                }
            }
            
            totalEngagement += eventEngagement;
        }
        
        return Math.min(100.0, totalEngagement / contentEvents.size());
    }
    
    /**
     * Determine platform usage pattern
     */
    private String determinePlatformUsagePattern(List<UserEvent> events) {
        Map<String, Long> platformCounts = events.stream()
            .filter(event -> event.getDeviceInfo() != null && event.getDeviceInfo().getPlatform() != null)
            .collect(Collectors.groupingBy(
                event -> event.getDeviceInfo().getPlatform(),
                Collectors.counting()
            ));
        
        if (platformCounts.isEmpty()) {
            return "unknown";
        }
        
        if (platformCounts.size() == 1) {
            String platform = platformCounts.keySet().iterator().next();
            return "Web".equals(platform) ? "web_only" : "mobile_only";
        }
        
        return "mixed";
    }
    
    /**
     * Create training dataset from historical user data
     */
    public List<ExitRiskFeatures> createTrainingDataset(Map<String, List<UserEvent>> historicalUserEvents,
                                                       Map<String, UserProfile> userProfiles,
                                                       Map<String, Boolean> exitLabels) {
        logger.info("Creating training dataset from {} users", historicalUserEvents.size());
        
        List<ExitRiskFeatures> trainingData = new ArrayList<>();
        
        for (Map.Entry<String, List<UserEvent>> entry : historicalUserEvents.entrySet()) {
            String userId = entry.getKey();
            List<UserEvent> events = entry.getValue();
            UserProfile profile = userProfiles.get(userId);
            
            try {
                ExitRiskFeatures features = extractExitRiskFeatures(userId, events, profile);
                
                // Set the target label if available
                Boolean exited = exitLabels.get(userId);
                if (exited != null) {
                    features.setExitedWithin72h(exited);
                    trainingData.add(features);
                }
                
            } catch (Exception e) {
                logger.warn("Failed to extract features for user {}: {}", userId, e.getMessage());
            }
        }
        
        logger.info("Created training dataset with {} samples", trainingData.size());
        return trainingData;
    }
    
    /**
     * Validate feature quality and completeness
     */
    public boolean validateFeatures(ExitRiskFeatures features) {
        if (features.getUserId() == null || features.getUserId().trim().isEmpty()) {
            return false;
        }
        
        // Check for reasonable feature values
        if (features.getStruggleSignalCount7d() != null && features.getStruggleSignalCount7d() < 0) {
            return false;
        }
        
        if (features.getVideoEngagementScore() != null && 
            (features.getVideoEngagementScore() < 0 || features.getVideoEngagementScore() > 100)) {
            return false;
        }
        
        if (features.getDaysSinceLastLogin() != null && features.getDaysSinceLastLogin() < 0) {
            return false;
        }
        
        return true;
    }
}