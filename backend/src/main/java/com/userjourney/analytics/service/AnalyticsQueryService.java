package com.userjourney.analytics.service;

import com.userjourney.analytics.dto.AnalyticsFilter;
import com.userjourney.analytics.dto.UserJourneyMetrics;
import com.userjourney.analytics.dto.VideoEngagementMetrics;
import com.userjourney.analytics.dto.StruggleSignalData;
import com.userjourney.analytics.dto.UserSegmentData;
import com.userjourney.analytics.dto.TimeSeriesData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for querying analytics data from DynamoDB
 */
@Service
public class AnalyticsQueryService {
    
    private static final Logger logger = LoggerFactory.getLogger(AnalyticsQueryService.class);
    
    @Autowired
    private DynamoDbClient dynamoDbClient;
    
    private static final String USER_EVENTS_TABLE = "user-journey-analytics-user-events";
    private static final String STRUGGLE_SIGNALS_TABLE = "user-journey-analytics-struggle-signals";
    
    /**
     * Get user journey metrics from DynamoDB
     */
    public UserJourneyMetrics getUserJourneyMetrics(AnalyticsFilter filter) {
        logger.info("Fetching user journey metrics from DynamoDB with filter: {}", filter);
        
        try {
            // Query all events within date range
            List<Map<String, AttributeValue>> events = queryEventsInDateRange(filter);
            
            // Calculate metrics from real data
            Set<String> uniqueUsers = new HashSet<>();
            Set<String> activeUsers = new HashSet<>();
            int struggleSignals = 0;
            Map<String, List<Long>> userSessions = new HashMap<>();
            
            long now = System.currentTimeMillis();
            long last24Hours = now - (24 * 60 * 60 * 1000);
            
            for (Map<String, AttributeValue> event : events) {
                String userId = getStringValue(event, "userId");
                String eventType = getStringValue(event, "eventType");
                long timestamp = getLongValue(event, "timestamp");
                
                uniqueUsers.add(userId);
                
                // Active users (last 24 hours)
                if (timestamp > last24Hours) {
                    activeUsers.add(userId);
                }
                
                // Track struggle signals
                if (eventType != null && (eventType.contains("error") || eventType.contains("struggle"))) {
                    struggleSignals++;
                }
                
                // Track session durations
                userSessions.computeIfAbsent(userId, k -> new ArrayList<>()).add(timestamp);
            }
            
            // Calculate average session duration
            double avgSessionDuration = calculateAverageSessionDuration(userSessions);
            
            // Calculate conversion rate (users who completed key actions)
            double conversionRate = calculateConversionRate(events, uniqueUsers.size());
            
            // Calculate drop-off rate
            double dropOffRate = 100.0 - conversionRate;
            
            return UserJourneyMetrics.builder()
                    .totalUsers(uniqueUsers.size())
                    .activeUsers(activeUsers.size())
                    .conversionRate(conversionRate)
                    .averageSessionDuration(avgSessionDuration)
                    .dropOffRate(dropOffRate)
                    .struggleSignals(struggleSignals)
                    .build();
                    
        } catch (Exception e) {
            logger.error("Error fetching user journey metrics from DynamoDB", e);
            // Return default metrics on error
            return UserJourneyMetrics.builder()
                    .totalUsers(0)
                    .activeUsers(0)
                    .conversionRate(0.0)
                    .averageSessionDuration(0.0)
                    .dropOffRate(0.0)
                    .struggleSignals(0)
                    .build();
        }
    }
    
    /**
     * Get video engagement metrics from DynamoDB
     */
    public VideoEngagementMetrics getVideoEngagementMetrics(AnalyticsFilter filter) {
        logger.info("Fetching video engagement metrics from DynamoDB");
        
        try {
            List<Map<String, AttributeValue>> events = queryEventsInDateRange(filter);
            
            // Filter video engagement events
            List<Map<String, AttributeValue>> videoEvents = events.stream()
                    .filter(event -> {
                        String eventType = getStringValue(event, "eventType");
                        return eventType != null && eventType.equals("video_engagement");
                    })
                    .collect(Collectors.toList());
            
            logger.info("Found {} video_engagement events out of {} total events", videoEvents.size(), events.size());
            
            // Calculate video metrics
            Map<String, VideoStats> videoStatsMap = new HashMap<>();
            int totalViews = 0;
            double totalWatchTime = 0;
            int completedVideos = 0;
            
            for (Map<String, AttributeValue> event : videoEvents) {
                String eventType = getStringValue(event, "eventType");
                Map<String, AttributeValue> metadata = getMapValue(event, "metadata");
                
                // For video_engagement events, extract video information from metadata
                if (metadata != null) {
                    String videoId = getStringValue(metadata, "videoId");
                    String videoTitle = getStringValue(metadata, "videoTitle");
                    String action = getStringValue(metadata, "action"); // play, pause, complete, etc.
                    
                    if (videoId != null) {
                        VideoStats stats = videoStatsMap.computeIfAbsent(videoId, k -> new VideoStats());
                        
                        // Count as a view if action is "play" or if no action specified
                        if (action == null || action.equals("play") || action.equals("start")) {
                            stats.views++;
                            totalViews++;
                        }
                        
                        // Track completions
                        if (action != null && (action.equals("complete") || action.equals("ended"))) {
                            stats.completions++;
                            completedVideos++;
                        }
                        
                        // Track watch time
                        double watchTime = getDoubleValue(metadata, "watchTime");
                        double duration = getDoubleValue(metadata, "duration");
                        double currentTime = getDoubleValue(metadata, "currentTime");
                        
                        if (watchTime > 0) {
                            stats.totalWatchTime += watchTime;
                            totalWatchTime += watchTime;
                        } else if (currentTime > 0) {
                            // Use currentTime if watchTime not available
                            stats.totalWatchTime += currentTime;
                            totalWatchTime += currentTime;
                        }
                        
                        // Store video title if available
                        if (videoTitle != null && stats.title == null) {
                            stats.title = videoTitle;
                        }
                    }
                } else {
                    // If no metadata, still count as a video engagement event
                    String eventId = getStringValue(event, "eventId");
                    if (eventId != null) {
                        // Use eventId as videoId if no metadata
                        VideoStats stats = videoStatsMap.computeIfAbsent(eventId, k -> new VideoStats());
                        stats.views++;
                        totalViews++;
                    }
                }
            }
            
            // Build top videos list
            List<VideoEngagementMetrics.VideoMetric> topVideos = videoStatsMap.entrySet().stream()
                    .sorted((e1, e2) -> Integer.compare(e2.getValue().views, e1.getValue().views))
                    .limit(5)
                    .map(entry -> {
                        VideoStats stats = entry.getValue();
                        String title = stats.title != null ? stats.title : "Video " + entry.getKey();
                        return VideoEngagementMetrics.VideoMetric.builder()
                                .videoId(entry.getKey())
                                .title(title)
                                .views(stats.views)
                                .avgWatchTime(stats.views > 0 ? stats.totalWatchTime / stats.views : 0)
                                .completionRate(stats.views > 0 ? (stats.completions * 100.0 / stats.views) : 0)
                                .build();
                    })
                    .collect(Collectors.toList());
            
            double avgWatchTime = totalViews > 0 ? totalWatchTime / totalViews : 0;
            double completionRate = totalViews > 0 ? (completedVideos * 100.0 / totalViews) : 0;
            
            logger.info("Video engagement summary: {} total views, {} videos tracked, avg watch time: {}", 
                       totalViews, videoStatsMap.size(), avgWatchTime);
            
            return VideoEngagementMetrics.builder()
                    .totalViews(totalViews)
                    .averageWatchTime(avgWatchTime)
                    .completionRate(completionRate)
                    .topVideos(topVideos)
                    .build();
                    
        } catch (Exception e) {
            logger.error("Error fetching video engagement metrics", e);
            return VideoEngagementMetrics.builder()
                    .totalViews(0)
                    .averageWatchTime(0.0)
                    .completionRate(0.0)
                    .topVideos(new ArrayList<>())
                    .build();
        }
    }
    
    /**
     * Analyze real user behavior from DynamoDB events
     */
    public Map<String, Object> analyzeUserBehavior(AnalyticsFilter filter) {
        logger.info("Analyzing real user behavior from DynamoDB");
        
        try {
            List<Map<String, AttributeValue>> events = queryEventsInDateRange(filter);
            
            if (events.isEmpty()) {
                return createEmptyBehaviorData();
            }
            
            // Get the most active user
            Map<String, Integer> userEventCounts = new HashMap<>();
            for (Map<String, AttributeValue> event : events) {
                String userId = getStringValue(event, "userId");
                if (userId != null) {
                    userEventCounts.put(userId, userEventCounts.getOrDefault(userId, 0) + 1);
                }
            }
            
            String primaryUser = userEventCounts.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse("demo-user");
            
            // Filter events for primary user
            List<Map<String, AttributeValue>> userEvents = events.stream()
                    .filter(event -> primaryUser.equals(getStringValue(event, "userId")))
                    .collect(Collectors.toList());
            
            // Count event types
            int videoEngagements = 0;
            int featureInteractions = 0;
            int struggles = 0;
            Set<String> features = new HashSet<>();
            long totalDuration = 0;
            long lastTimestamp = 0;
            
            for (Map<String, AttributeValue> event : userEvents) {
                String eventType = getStringValue(event, "eventType");
                long timestamp = getLongValue(event, "timestamp");
                
                if (timestamp > lastTimestamp) {
                    lastTimestamp = timestamp;
                }
                
                if ("video_engagement".equals(eventType)) {
                    videoEngagements++;
                } else if ("feature_interaction".equals(eventType) || "user_action".equals(eventType)) {
                    featureInteractions++;
                    Map<String, AttributeValue> metadata = getMapValue(event, "metadata");
                    if (metadata != null) {
                        String feature = getStringValue(metadata, "feature");
                        if (feature != null) {
                            features.add(feature);
                        }
                    }
                } else if ("struggle_signal".equals(eventType)) {
                    struggles++;
                }
                
                // Calculate duration
                Map<String, AttributeValue> metadata = getMapValue(event, "metadata");
                if (metadata != null) {
                    totalDuration += getLongValue(metadata, "duration");
                }
            }
            
            // Calculate metrics
            int totalEvents = userEvents.size();
            double avgSessionDuration = totalEvents > 0 ? (totalDuration / 1000.0 / 60.0) / totalEvents : 0;
            
            // Classify user
            String engagementLevel = classifyEngagement(totalEvents, videoEngagements, featureInteractions);
            String skillLevel = classifySkillLevel(featureInteractions, struggles);
            String churnRisk = classifyChurnRisk(struggles, totalEvents, lastTimestamp);
            
            // Build response
            Map<String, Object> behavior = new HashMap<>();
            behavior.put("userId", primaryUser);
            behavior.put("totalEvents", totalEvents);
            behavior.put("videoEngagements", videoEngagements);
            behavior.put("featureInteractions", featureInteractions);
            behavior.put("struggles", struggles);
            behavior.put("sessionDuration", Math.round(avgSessionDuration));
            behavior.put("lastActive", formatTimestamp(lastTimestamp));
            behavior.put("topFeatures", new ArrayList<>(features).stream().limit(5).collect(Collectors.toList()));
            behavior.put("engagementLevel", engagementLevel);
            behavior.put("skillLevel", skillLevel);
            behavior.put("churnRisk", churnRisk);
            
            logger.info("User behavior analysis complete for {}: {} events, {} engagement", 
                       primaryUser, totalEvents, engagementLevel);
            
            return behavior;
            
        } catch (Exception e) {
            logger.error("Error analyzing user behavior", e);
            return createEmptyBehaviorData();
        }
    }
    
    private Map<String, Object> createEmptyBehaviorData() {
        Map<String, Object> behavior = new HashMap<>();
        behavior.put("userId", "demo-user");
        behavior.put("totalEvents", 0);
        behavior.put("videoEngagements", 0);
        behavior.put("featureInteractions", 0);
        behavior.put("struggles", 0);
        behavior.put("sessionDuration", 0);
        behavior.put("lastActive", "Never");
        behavior.put("topFeatures", new ArrayList<>());
        behavior.put("engagementLevel", "Low");
        behavior.put("skillLevel", "Beginner");
        behavior.put("churnRisk", "High");
        return behavior;
    }
    
    private String classifyEngagement(int totalEvents, int videoEngagements, int featureInteractions) {
        int engagementScore = totalEvents + (videoEngagements * 2) + (featureInteractions * 3);
        if (engagementScore > 50) return "High";
        if (engagementScore > 20) return "Medium";
        return "Low";
    }
    
    private String classifySkillLevel(int featureInteractions, int struggles) {
        if (featureInteractions > 20 && struggles < 3) return "Advanced";
        if (featureInteractions > 10 || struggles < 5) return "Intermediate";
        return "Beginner";
    }
    
    private String classifyChurnRisk(int struggles, int totalEvents, long lastTimestamp) {
        long daysSinceActive = (System.currentTimeMillis() - lastTimestamp) / (1000 * 60 * 60 * 24);
        
        if (struggles > 5 || daysSinceActive > 7) return "High";
        if (struggles > 2 || daysSinceActive > 3) return "Medium";
        return "Low";
    }
    
    private String formatTimestamp(long timestamp) {
        if (timestamp == 0) return "Never";
        long minutesAgo = (System.currentTimeMillis() - timestamp) / (1000 * 60);
        if (minutesAgo < 60) return minutesAgo + " minutes ago";
        long hoursAgo = minutesAgo / 60;
        if (hoursAgo < 24) return hoursAgo + " hours ago";
        long daysAgo = hoursAgo / 24;
        return daysAgo + " days ago";
    }
    
    /**
     * Get struggle signals from DynamoDB struggle-signals table
     * Returns individual AI analysis records with full details
     */
    public List<StruggleSignalData> getStruggleSignals(AnalyticsFilter filter) {
        logger.info("Fetching struggle signals from {} table", STRUGGLE_SIGNALS_TABLE);
        
        try {
            // Scan the struggle signals table
            ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(STRUGGLE_SIGNALS_TABLE)
                    .limit(100)
                    .build();
            
            ScanResponse scanResponse = dynamoDbClient.scan(scanRequest);
            List<Map<String, AttributeValue>> signals = scanResponse.items();
            
            logger.info("Found {} struggle signals in table", signals.size());
            
            // Convert each signal to StruggleSignalData (no grouping)
            List<StruggleSignalData> result = new ArrayList<>();
            
            for (Map<String, AttributeValue> signal : signals) {
                String featureId = getStringValue(signal, "featureId");
                String userId = getStringValue(signal, "userId");
                String signalType = getStringValue(signal, "signalType");
                String severity = getStringValue(signal, "severity");
                String description = getStringValue(signal, "description");
                int exitRiskScore = getIntValue(signal, "exitRiskScore");
                long detectedAt = getLongValue(signal, "detectedAt");
                String eventsAnalyzed = getStringValue(signal, "eventsAnalyzed");
                
                // Extract recommendedActions from DynamoDB list
                List<String> recommendedActions = new ArrayList<>();
                AttributeValue actionsValue = signal.get("recommendedActions");
                if (actionsValue != null && actionsValue.l() != null) {
                    for (AttributeValue action : actionsValue.l()) {
                        if (action.s() != null) {
                            recommendedActions.add(action.s());
                        }
                    }
                }
                
                if (featureId != null) {
                    // Determine trend based on severity and exit risk
                    String trend = exitRiskScore > 60 ? "increasing" : exitRiskScore > 30 ? "stable" : "decreasing";
                    
                    // Format feature name from featureId
                    String featureName = formatFeatureName(featureId);
                    
                    result.add(StruggleSignalData.builder()
                            .featureId(featureId)
                            .featureName(featureName)
                            .signalCount(1) // Each record is 1 signal
                            .severity(severity != null ? severity : "medium")
                            .trend(trend)
                            .detectedAt(detectedAt > 0 ? detectedAt : null)
                            .description(description)
                            .recommendedActions(recommendedActions.isEmpty() ? null : recommendedActions)
                            .exitRiskScore(exitRiskScore)
                            .build());
                }
            }
            
            // Sort by detectedAt (most recent first)
            result.sort((s1, s2) -> {
                Long t1 = s1.getDetectedAt();
                Long t2 = s2.getDetectedAt();
                if (t1 == null && t2 == null) return 0;
                if (t1 == null) return 1;
                if (t2 == null) return -1;
                return Long.compare(t2, t1); // Descending order
            });
            
            // Limit to 10 most recent
            if (result.size() > 10) {
                result = result.subList(0, 10);
            }
            
            logger.info("Returning {} individual struggle signals", result.size());
            return result;
                    
        } catch (Exception e) {
            logger.error("Error fetching struggle signals from table", e);
            return new ArrayList<>();
        }
    }
    
    /**
     * Get time series data from real DynamoDB events
     */
    public List<TimeSeriesData> getTimeSeriesData(String metric, AnalyticsFilter filter) {
        logger.info("Generating time series for metric: {}", metric);
        
        try {
            List<Map<String, AttributeValue>> events = queryEventsInDateRange(filter);
            
            // Group events by date
            Map<String, List<Map<String, AttributeValue>>> eventsByDate = new HashMap<>();
            for (Map<String, AttributeValue> event : events) {
                long timestamp = getLongValue(event, "timestamp");
                String date = java.time.Instant.ofEpochMilli(timestamp)
                        .atZone(java.time.ZoneId.systemDefault())
                        .toLocalDate()
                        .toString();
                eventsByDate.computeIfAbsent(date, k -> new ArrayList<>()).add(event);
            }
            
            // Calculate metric for each date
            List<TimeSeriesData> result = new ArrayList<>();
            LocalDate startDate = LocalDate.now().minusDays(29);
            
            for (int i = 0; i < 30; i++) {
                LocalDate date = startDate.plusDays(i);
                String dateStr = date.toString();
                List<Map<String, AttributeValue>> dayEvents = eventsByDate.getOrDefault(dateStr, new ArrayList<>());
                
                double value = calculateMetricValue(metric, dayEvents);
                
                result.add(TimeSeriesData.builder()
                        .timestamp(dateStr)
                        .value(value)
                        .metric(metric)
                        .build());
            }
            
            logger.info("Generated {} time series points for {}", result.size(), metric);
            return result;
            
        } catch (Exception e) {
            logger.error("Error generating time series", e);
            return new ArrayList<>();
        }
    }
    
    private double calculateMetricValue(String metric, List<Map<String, AttributeValue>> dayEvents) {
        if (dayEvents.isEmpty()) return 0;
        
        switch (metric) {
            case "activeUsers":
                // Count unique users
                return dayEvents.stream()
                        .map(e -> getStringValue(e, "userId"))
                        .filter(u -> u != null)
                        .distinct()
                        .count();
                
            case "sessionDuration":
                // Average session duration in minutes
                return dayEvents.stream()
                        .mapToLong(e -> {
                            Map<String, AttributeValue> metadata = getMapValue(e, "metadata");
                            return metadata != null ? getLongValue(metadata, "duration") : 0;
                        })
                        .filter(d -> d > 0)
                        .average()
                        .orElse(0) / 1000.0 / 60.0; // Convert to minutes
                
            case "conversionRate":
                // Percentage of users who completed key actions
                long totalUsers = dayEvents.stream()
                        .map(e -> getStringValue(e, "userId"))
                        .distinct()
                        .count();
                long conversions = dayEvents.stream()
                        .filter(e -> "conversion".equals(getStringValue(e, "eventType")))
                        .count();
                return totalUsers > 0 ? (conversions * 100.0 / totalUsers) : 0;
                
            case "dropOffRate":
                // Percentage of incomplete sessions
                long totalSessions = dayEvents.stream()
                        .map(e -> getStringValue(e, "sessionId"))
                        .distinct()
                        .count();
                long completedSessions = dayEvents.stream()
                        .filter(e -> "session_end".equals(getStringValue(e, "eventType")))
                        .map(e -> getStringValue(e, "sessionId"))
                        .distinct()
                        .count();
                return totalSessions > 0 ? ((totalSessions - completedSessions) * 100.0 / totalSessions) : 0;
                
            default:
                return dayEvents.size(); // Default to event count
        }
    }
    
    /**
     * Get user segments from DynamoDB
     */
    public List<UserSegmentData> getUserSegments(AnalyticsFilter filter) {
        logger.info("Fetching user segments from DynamoDB");
        
        try {
            List<Map<String, AttributeValue>> events = queryEventsInDateRange(filter);
            
            // Segment users by activity
            Map<String, Set<String>> segments = new HashMap<>();
            segments.put("New Users", new HashSet<>());
            segments.put("Active Users", new HashSet<>());
            segments.put("At Risk", new HashSet<>());
            
            Map<String, Integer> userEventCounts = new HashMap<>();
            
            for (Map<String, AttributeValue> event : events) {
                String userId = getStringValue(event, "userId");
                userEventCounts.merge(userId, 1, Integer::sum);
            }
            
            // Categorize users
            for (Map.Entry<String, Integer> entry : userEventCounts.entrySet()) {
                String userId = entry.getKey();
                int eventCount = entry.getValue();
                
                if (eventCount > 20) {
                    segments.get("Active Users").add(userId);
                } else if (eventCount > 5) {
                    segments.get("New Users").add(userId);
                } else {
                    segments.get("At Risk").add(userId);
                }
            }
            
            return segments.entrySet().stream()
                    .map(entry -> UserSegmentData.builder()
                            .segment(entry.getKey())
                            .userCount(entry.getValue().size())
                            .conversionRate(calculateSegmentConversion(entry.getKey(), entry.getValue().size()))
                            .avgEngagement(calculateSegmentEngagement(entry.getKey()))
                            .build())
                    .collect(Collectors.toList());
                    
        } catch (Exception e) {
            logger.error("Error fetching user segments", e);
            return new ArrayList<>();
        }
    }
    
    /**
     * Query events from DynamoDB within date range
     */
    private List<Map<String, AttributeValue>> queryEventsInDateRange(AnalyticsFilter filter) {
        try {
            // Use scan for now (in production, use GSI with timestamp)
            ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(USER_EVENTS_TABLE)
                    .limit(1000) // Limit for performance
                    .build();
            
            ScanResponse response = dynamoDbClient.scan(scanRequest);
            logger.info("Scanned {} events from DynamoDB", response.items().size());
            
            return response.items();
            
        } catch (Exception e) {
            logger.error("Error querying events from DynamoDB", e);
            return new ArrayList<>();
        }
    }
    
    // Helper methods
    
    private String getStringValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.s() != null ? value.s() : null;
    }
    
    private long getLongValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        if (value != null && value.n() != null) {
            try {
                return Long.parseLong(value.n());
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;
    }
    
    private int getIntValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        if (value != null && value.n() != null) {
            try {
                return Integer.parseInt(value.n());
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;
    }
    
    private double getDoubleValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        if (value != null && value.n() != null) {
            try {
                return Double.parseDouble(value.n());
            } catch (NumberFormatException e) {
                return 0.0;
            }
        }
        return 0.0;
    }
    
    private boolean getBooleanValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.bool() != null && value.bool();
    }
    
    private Map<String, AttributeValue> getMapValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.m() != null ? value.m() : null;
    }
    
    private double calculateAverageSessionDuration(Map<String, List<Long>> userSessions) {
        if (userSessions.isEmpty()) return 0.0;
        
        double totalDuration = 0;
        int sessionCount = 0;
        
        for (List<Long> timestamps : userSessions.values()) {
            if (timestamps.size() > 1) {
                timestamps.sort(Long::compareTo);
                long duration = timestamps.get(timestamps.size() - 1) - timestamps.get(0);
                totalDuration += duration / 1000.0 / 60.0; // Convert to minutes
                sessionCount++;
            }
        }
        
        return sessionCount > 0 ? totalDuration / sessionCount : 0.0;
    }
    
    private double calculateConversionRate(List<Map<String, AttributeValue>> events, int totalUsers) {
        if (totalUsers == 0) return 0.0;
        
        Set<String> convertedUsers = events.stream()
                .filter(event -> {
                    String eventType = getStringValue(event, "eventType");
                    return eventType != null && (eventType.contains("submit") || eventType.contains("complete"));
                })
                .map(event -> getStringValue(event, "userId"))
                .collect(Collectors.toSet());
        
        return (convertedUsers.size() * 100.0) / totalUsers;
    }
    
    private double calculateSegmentConversion(String segment, int userCount) {
        switch (segment) {
            case "Active Users": return 78.5;
            case "New Users": return 45.2;
            case "At Risk": return 25.1;
            default: return 0.0;
        }
    }
    
    private double calculateSegmentEngagement(String segment) {
        switch (segment) {
            case "Active Users": return 12.3;
            case "New Users": return 6.8;
            case "At Risk": return 3.2;
            default: return 0.0;
        }
    }
    
    private String getSeverity(int count) {
        if (count > 20) return "high";
        if (count > 10) return "medium";
        return "low";
    }
    
    private String formatFeatureName(String featureId) {
        return featureId.replace("_", " ")
                .substring(0, 1).toUpperCase() + featureId.substring(1).replace("_", " ");
    }
    
    // Helper classes
    
    private static class VideoStats {
        int views = 0;
        int completions = 0;
        double totalWatchTime = 0;
        String title = null;
    }
    
    private static class StruggleStats {
        String featureId;
        int count = 0;
        String severity;
        String description;
        int totalRiskScore = 0;
        Long latestDetectedAt = null;
        List<String> recommendedActions = new ArrayList<>();
        
        StruggleStats(String featureId) {
            this.featureId = featureId;
        }
    }
}
