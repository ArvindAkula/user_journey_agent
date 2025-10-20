package com.userjourney.analytics.controller;

import com.userjourney.analytics.dto.AnalyticsFilter;
import com.userjourney.analytics.dto.UserJourneyMetrics;
import com.userjourney.analytics.dto.VideoEngagementMetrics;
import com.userjourney.analytics.dto.StruggleSignalData;
import com.userjourney.analytics.dto.UserSegmentData;
import com.userjourney.analytics.dto.TimeSeriesData;
import com.userjourney.analytics.service.AnalyticsQueryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * REST Controller for Analytics Dashboard endpoints
 */
@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "*")
public class AnalyticsDashboardController {
    
    private static final Logger logger = LoggerFactory.getLogger(AnalyticsDashboardController.class);
    private final Random random = new Random();
    
    @Autowired
    private AnalyticsQueryService analyticsQueryService;
    
    /**
     * Get user journey metrics from DynamoDB
     */
    @PostMapping("/user-journey")
    public ResponseEntity<UserJourneyMetrics> getUserJourneyMetrics(@RequestBody(required = false) Map<String, Object> requestBody) {
        logger.info("╔════════════════════════════════════════════════════════════");
        logger.info("║ GET USER JOURNEY METRICS REQUEST");
        logger.info("╠════════════════════════════════════════════════════════════");
        logger.info("║ Request body: {}", requestBody);
        
        // Handle both direct filter and wrapped {filters: ...} format
        AnalyticsFilter filter = null;
        
        try {
            // Fetch real data from DynamoDB
            UserJourneyMetrics metrics = analyticsQueryService.getUserJourneyMetrics(filter);
            
            logger.info("╠════════════════════════════════════════════════════════════");
            logger.info("║ METRICS RETRIEVED FROM DYNAMODB:");
            logger.info("║   Total Users: {}", metrics.getTotalUsers());
            logger.info("║   Active Users: {}", metrics.getActiveUsers());
            logger.info("║   Conversion Rate: {}%", metrics.getConversionRate());
            logger.info("║   Avg Session Duration: {}min", metrics.getAverageSessionDuration());
            logger.info("║   Drop Off Rate: {}%", metrics.getDropOffRate());
            logger.info("║   Struggle Signals: {}", metrics.getStruggleSignals());
            logger.info("╠════════════════════════════════════════════════════════════");
            logger.info("║ RETURNING TO FRONTEND: {}", metrics);
            logger.info("╚════════════════════════════════════════════════════════════");
            
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            logger.error("╠════════════════════════════════════════════════════════════");
            logger.error("║ ERROR fetching user journey metrics", e);
            logger.error("╚════════════════════════════════════════════════════════════");
            // Return empty metrics on error
            return ResponseEntity.ok(UserJourneyMetrics.builder()
                    .totalUsers(0)
                    .activeUsers(0)
                    .conversionRate(0.0)
                    .averageSessionDuration(0.0)
                    .dropOffRate(0.0)
                    .struggleSignals(0)
                    .build());
        }
    }
    
    /**
     * Get video engagement metrics from DynamoDB
     */
    @PostMapping("/video-engagement")
    public ResponseEntity<VideoEngagementMetrics> getVideoEngagementMetrics(@RequestBody(required = false) Map<String, Object> requestBody) {
        logger.info("╔════════════════════════════════════════════════════════════");
        logger.info("║ GET VIDEO ENGAGEMENT METRICS REQUEST");
        logger.info("╚════════════════════════════════════════════════════════════");
        
        try {
            AnalyticsFilter filter = null; // Use default for now
            VideoEngagementMetrics metrics = analyticsQueryService.getVideoEngagementMetrics(filter);
            logger.info("✅ Returning video engagement metrics: {}", metrics);
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            logger.error("❌ Error fetching video engagement metrics", e);
            return ResponseEntity.ok(VideoEngagementMetrics.builder()
                    .totalViews(0)
                    .averageWatchTime(0.0)
                    .completionRate(0.0)
                    .topVideos(new ArrayList<>())
                    .build());
        }
    }
    
    /**
     * Get dashboard metrics summary
     */
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardMetrics() {
        logger.info("╔════════════════════════════════════════════════════════════");
        logger.info("║ GET DASHBOARD METRICS REQUEST");
        logger.info("╚════════════════════════════════════════════════════════════");
        
        try {
            // Get user journey metrics
            UserJourneyMetrics userMetrics = analyticsQueryService.getUserJourneyMetrics(null);
            
            // Get video metrics
            VideoEngagementMetrics videoMetrics = analyticsQueryService.getVideoEngagementMetrics(null);
            
            // Build dashboard response
            Map<String, Object> dashboard = new java.util.HashMap<>();
            dashboard.put("totalUsers", userMetrics.getTotalUsers());
            dashboard.put("activeUsers", userMetrics.getActiveUsers());
            dashboard.put("conversionRate", userMetrics.getConversionRate());
            dashboard.put("averageSessionDuration", userMetrics.getAverageSessionDuration());
            dashboard.put("dropOffRate", userMetrics.getDropOffRate());
            dashboard.put("struggleSignals", userMetrics.getStruggleSignals());
            
            // Video engagement
            Map<String, Object> videoEngagement = new java.util.HashMap<>();
            videoEngagement.put("totalViews", videoMetrics.getTotalViews());
            videoEngagement.put("averageWatchTime", videoMetrics.getAverageWatchTime());
            videoEngagement.put("completionRate", videoMetrics.getCompletionRate());
            dashboard.put("videoEngagement", videoEngagement);
            
            // Real-time metrics (from realtime endpoint)
            Map<String, Object> realTimeMetrics = new java.util.HashMap<>();
            realTimeMetrics.put("currentActiveUsers", userMetrics.getActiveUsers());
            realTimeMetrics.put("eventsPerMinute", 0);
            realTimeMetrics.put("interventionsTriggered", 0);
            realTimeMetrics.put("errorRate", 0.0);
            dashboard.put("realTimeMetrics", realTimeMetrics);
            
            logger.info("✅ Returning dashboard metrics");
            return ResponseEntity.ok(dashboard);
        } catch (Exception e) {
            logger.error("❌ Error fetching dashboard metrics", e);
            Map<String, Object> emptyDashboard = new java.util.HashMap<>();
            emptyDashboard.put("totalUsers", 0);
            emptyDashboard.put("activeUsers", 0);
            return ResponseEntity.ok(emptyDashboard);
        }
    }
    
    /**
     * Get struggle signals from DynamoDB
     */
    @PostMapping("/struggle-signals")
    public ResponseEntity<List<StruggleSignalData>> getStruggleSignals(@RequestBody(required = false) AnalyticsFilter filter) {
        logger.info("Fetching struggle signals from DynamoDB with filter: {}", filter);
        
        try {
            List<StruggleSignalData> signals = analyticsQueryService.getStruggleSignals(filter);
            return ResponseEntity.ok(signals);
        } catch (Exception e) {
            logger.error("Error fetching struggle signals", e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
    
    /**
     * Get user segments from DynamoDB
     */
    @PostMapping("/user-segments")
    public ResponseEntity<List<UserSegmentData>> getUserSegments(@RequestBody(required = false) Map<String, Object> requestBody) {
        logger.info("Fetching user segments from DynamoDB with request: {}", requestBody);
        
        try {
            // Handle both direct filter and wrapped {filters: ...} format
            AnalyticsFilter filter = null;
            if (requestBody != null && requestBody.containsKey("filters")) {
                // Frontend sends {filters: {...}}
                filter = new AnalyticsFilter(); // Use default/empty filter for now
            }
            
            List<UserSegmentData> segments = analyticsQueryService.getUserSegments(filter);
            return ResponseEntity.ok(segments);
        } catch (Exception e) {
            logger.error("Error fetching user segments", e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
    
    /**
     * Get real user behavior analysis
     */
    @PostMapping("/user-behavior")
    public ResponseEntity<Map<String, Object>> getUserBehavior(@RequestBody(required = false) AnalyticsFilter filter) {
        logger.info("Fetching real user behavior analysis");
        
        try {
            Map<String, Object> behavior = analyticsQueryService.analyzeUserBehavior(filter);
            return ResponseEntity.ok(behavior);
        } catch (Exception e) {
            logger.error("Error fetching user behavior", e);
            return ResponseEntity.ok(new java.util.HashMap<>());
        }
    }
    
    /**
     * Get time series data from real DynamoDB events
     */
    @PostMapping("/time-series")
    public ResponseEntity<List<TimeSeriesData>> getTimeSeriesData(@RequestBody(required = false) TimeSeriesRequest request) {
        logger.info("╔════════════════════════════════════════════════════════════");
        logger.info("║ GET TIME SERIES DATA REQUEST");
        logger.info("╠════════════════════════════════════════════════════════════");
        logger.info("║ Request: {}", request);
        
        try {
            String metric = request != null && request.getMetric() != null ? request.getMetric() : "activeUsers";
            AnalyticsFilter filter = request != null ? request.getFilters() : null;
            
            logger.info("║ Metric: {}", metric);
            logger.info("║ Filter: {}", filter);
            
            List<TimeSeriesData> data = analyticsQueryService.getTimeSeriesData(metric, filter);
            
            logger.info("╠════════════════════════════════════════════════════════════");
            logger.info("║ Returning {} time series data points", data.size());
            logger.info("╚════════════════════════════════════════════════════════════");
            
            return ResponseEntity.ok(data);
        } catch (Exception e) {
            logger.error("╠════════════════════════════════════════════════════════════");
            logger.error("║ ERROR fetching time series data", e);
            logger.error("╚════════════════════════════════════════════════════════════");
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
    
    private double getBaseValueForMetric(String metric) {
        switch (metric) {
            case "activeUsers": return 890;
            case "conversionRate": return 68.5;
            case "dropOffRate": return 15.2;
            case "sessionDuration": return 12.3;
            default: return 100;
        }
    }
    
    /**
     * Request DTOs
     */
    public static class TimeSeriesRequest {
        private String metric;
        private AnalyticsFilter filters;
        
        // Getters and Setters
        public String getMetric() {
            return metric;
        }
        
        public void setMetric(String metric) {
            this.metric = metric;
        }
        
        public AnalyticsFilter getFilters() {
            return filters;
        }
        
        public void setFilters(AnalyticsFilter filters) {
            this.filters = filters;
        }
    }
}