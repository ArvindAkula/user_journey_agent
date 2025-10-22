package com.userjourney.analytics.controller;

import com.userjourney.analytics.dto.BigQueryEventResult;
import com.userjourney.analytics.dto.EventCountAggregation;
import com.userjourney.analytics.dto.UserJourneyAnalysis;
import com.userjourney.analytics.service.BigQueryAnalyticsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * BigQuery Analytics Controller
 * 
 * Provides REST API endpoints for querying historical analytics data
 * from BigQuery. This enables cost-effective long-term analytics
 * while keeping real-time queries on DynamoDB.
 */
@RestController
@RequestMapping("/api/bigquery")
@CrossOrigin(origins = {"${cors.allowed-origins}"})
public class BigQueryAnalyticsController {

    private static final Logger logger = LoggerFactory.getLogger(BigQueryAnalyticsController.class);

    private final BigQueryAnalyticsService bigQueryService;

    @Autowired
    public BigQueryAnalyticsController(BigQueryAnalyticsService bigQueryService) {
        this.bigQueryService = bigQueryService;
    }

    /**
     * Check if BigQuery is available
     */
    @GetMapping("/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("available", bigQueryService.isAvailable());
        status.put("message", bigQueryService.isAvailable() 
            ? "BigQuery is available for historical analytics"
            : "BigQuery is not configured. Using DynamoDB for all queries.");
        
        return ResponseEntity.ok(status);
    }

    /**
     * Get historical events for a user
     */
    @GetMapping("/events/user/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> getUserHistoricalEvents(
            @PathVariable String userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        if (!bigQueryService.isAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "BigQuery is not available"));
        }

        try {
            logger.info("Fetching historical events for user {} from {} to {}", userId, startDate, endDate);
            List<BigQueryEventResult> events = bigQueryService.getHistoricalEvents(userId, startDate, endDate);
            
            return ResponseEntity.ok(Map.of(
                    "userId", userId,
                    "startDate", startDate,
                    "endDate", endDate,
                    "events", events,
                    "count", events.size()
            ));
        } catch (Exception e) {
            logger.error("Error fetching historical events", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch historical events: " + e.getMessage()));
        }
    }

    /**
     * Analyze user journey
     */
    @GetMapping("/journey/user/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> analyzeUserJourney(
            @PathVariable String userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        if (!bigQueryService.isAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "BigQuery is not available"));
        }

        try {
            logger.info("Analyzing user journey for user {} from {} to {}", userId, startDate, endDate);
            UserJourneyAnalysis analysis = bigQueryService.analyzeUserJourney(userId, startDate, endDate);
            
            if (analysis == null) {
                return ResponseEntity.notFound().build();
            }
            
            return ResponseEntity.ok(analysis);
        } catch (Exception e) {
            logger.error("Error analyzing user journey", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to analyze user journey: " + e.getMessage()));
        }
    }

    /**
     * Get event count aggregations
     */
    @GetMapping("/events/aggregations")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> getEventAggregations(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        if (!bigQueryService.isAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "BigQuery is not available"));
        }

        try {
            logger.info("Fetching event aggregations from {} to {}", startDate, endDate);
            List<EventCountAggregation> aggregations = bigQueryService.getEventCountAggregations(startDate, endDate);
            
            return ResponseEntity.ok(Map.of(
                    "startDate", startDate,
                    "endDate", endDate,
                    "aggregations", aggregations
            ));
        } catch (Exception e) {
            logger.error("Error fetching event aggregations", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch event aggregations: " + e.getMessage()));
        }
    }

    /**
     * Get calculator statistics
     */
    @GetMapping("/calculator/statistics")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> getCalculatorStatistics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        if (!bigQueryService.isAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "BigQuery is not available"));
        }

        try {
            logger.info("Fetching calculator statistics from {} to {}", startDate, endDate);
            Map<String, Object> stats = bigQueryService.getCalculatorStatistics(startDate, endDate);
            
            return ResponseEntity.ok(Map.of(
                    "startDate", startDate,
                    "endDate", endDate,
                    "statistics", stats
            ));
        } catch (Exception e) {
            logger.error("Error fetching calculator statistics", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch calculator statistics: " + e.getMessage()));
        }
    }

    /**
     * Get video engagement metrics
     */
    @GetMapping("/video/engagement")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> getVideoEngagementMetrics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        if (!bigQueryService.isAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "BigQuery is not available"));
        }

        try {
            logger.info("Fetching video engagement metrics from {} to {}", startDate, endDate);
            Map<String, Object> metrics = bigQueryService.getVideoEngagementMetrics(startDate, endDate);
            
            return ResponseEntity.ok(Map.of(
                    "startDate", startDate,
                    "endDate", endDate,
                    "metrics", metrics
            ));
        } catch (Exception e) {
            logger.error("Error fetching video engagement metrics", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch video engagement metrics: " + e.getMessage()));
        }
    }
}
