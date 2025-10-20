package com.userjourney.analytics.controller;

import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.service.EventCollectionService;
import com.userjourney.analytics.service.ComprehensiveEventTrackingService;
import com.userjourney.analytics.dto.EventResponse;
import com.userjourney.analytics.dto.UserInsightsResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
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
@RequestMapping("/api/events")
@CrossOrigin(origins = "*", maxAge = 3600)
public class EventController {

    private static final Logger logger = LoggerFactory.getLogger(EventController.class);

    @Autowired
    private EventCollectionService eventCollectionService;

    @Autowired
    private ComprehensiveEventTrackingService comprehensiveEventTrackingService;

    /**
     * Track a single user event
     */
    @PostMapping("/track")
    public ResponseEntity<EventResponse> trackEvent(@RequestBody String rawBody) {
        logger.info("📥 [BACKEND] Received RAW request body: {}", rawBody);
        
        try {
            // Try to parse manually to see what's wrong
            ObjectMapper mapper = new ObjectMapper();
            UserEvent event = mapper.readValue(rawBody, UserEvent.class);
            
            logger.info("📥 [BACKEND] Parsed event: {} for user: {}", event.getEventType(), event.getUserId());
            
            // Special logging for pricing_page_view events
            if ("pricing_page_view".equals(event.getEventType())) {
                logger.info("🤖 [BACKEND] PRICING_PAGE_VIEW EVENT RECEIVED!");
                logger.info("🤖 [BACKEND] User: {}, EventData: {}", event.getUserId(), event.getEventData());
            }

            // Process the event
            String eventId = eventCollectionService.processEvent(event);
            
            if ("pricing_page_view".equals(event.getEventType())) {
                logger.info("✅ [BACKEND] pricing_page_view event processed with ID: {}", eventId);
            }

            EventResponse response = new EventResponse(
                    eventId,
                    "Event tracked successfully",
                    System.currentTimeMillis());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("❌ [BACKEND] Error parsing/tracking event: {}", e.getMessage(), e);
            logger.error("❌ [BACKEND] Raw body was: {}", rawBody);

            EventResponse errorResponse = new EventResponse(
                    null,
                    "Failed to track event: " + e.getMessage(),
                    System.currentTimeMillis());

            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        }
    }

    /**
     * Track multiple events in batch
     */
    @PostMapping("/track/batch")
    public ResponseEntity<?> trackEventsBatch(@RequestBody String rawBody) {
        logger.info("📥 [BACKEND] Received BATCH RAW request body: {}", rawBody);
        
        try {
            // Parse the batch request which contains events array, batchId, and timestamp
            ObjectMapper mapper = new ObjectMapper();
            
            // First parse as a generic map to extract the events array
            @SuppressWarnings("unchecked")
            Map<String, Object> batchRequest = mapper.readValue(rawBody, Map.class);
            
            // Extract the events array
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> eventsData = (List<Map<String, Object>>) batchRequest.get("events");
            
            if (eventsData == null || eventsData.isEmpty()) {
                logger.warn("📥 [BACKEND] No events found in batch request");
                return ResponseEntity.badRequest().body(Map.of("error", "No events provided in batch"));
            }
            
            // Convert each event map to UserEvent object
            List<UserEvent> events = eventsData.stream()
                .map(eventMap -> mapper.convertValue(eventMap, UserEvent.class))
                .toList();
            
            logger.info("📥 [BACKEND] Parsed batch of {} events (batchId: {})", 
                events.size(), batchRequest.get("batchId"));
            
            // Count and log pricing_page_view events
            long pricingEvents = events.stream()
                .filter(e -> "pricing_page_view".equals(e.getEventType()))
                .count();
            
            if (pricingEvents > 0) {
                logger.info("🤖 [BACKEND] Batch contains {} PRICING_PAGE_VIEW events!", pricingEvents);
                events.stream()
                    .filter(e -> "pricing_page_view".equals(e.getEventType()))
                    .forEach(e -> logger.info("🤖 [BACKEND] pricing_page_view - User: {}, EventData: {}", 
                        e.getUserId(), e.getEventData()));
            }
            
            // Log all event types in batch
            logger.info("📊 [BACKEND] Event types in batch: {}", 
                events.stream().map(UserEvent::getEventType).toList());
            
            // Log device info for first event
            if (!events.isEmpty() && events.get(0).getDeviceInfo() != null) {
                logger.info("🔍 [BACKEND] First event device info - Model length: {}, Model: {}", 
                    events.get(0).getDeviceInfo().getDeviceModel() != null ? events.get(0).getDeviceInfo().getDeviceModel().length() : "null",
                    events.get(0).getDeviceInfo().getDeviceModel());
            }

            // Use comprehensive tracking for batch events
            List<EventResponse> responses = comprehensiveEventTrackingService.trackBatchEvents(events);
            
            if (pricingEvents > 0) {
                logger.info("✅ [BACKEND] Batch with {} pricing_page_view events processed successfully", pricingEvents);
            }

            return ResponseEntity.ok(responses);

        } catch (Exception e) {
            logger.error("❌ [BACKEND] Error parsing/tracking batch events: {}", e.getMessage(), e);
            logger.error("❌ [BACKEND] Raw body was: {}", rawBody);
            logger.error("❌ [BACKEND] Stack trace:", e);
            
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getMessage(), "rawBody", rawBody));
        }
    }

    /**
     * Track event with comprehensive logging
     */
    @PostMapping("/track/comprehensive")
    public ResponseEntity<EventResponse> trackComprehensiveEvent(@Valid @RequestBody UserEvent event) {
        try {
            logger.info("Received comprehensive event: {} for user: {}", event.getEventType(), event.getUserId());

            EventResponse response = comprehensiveEventTrackingService.trackEvent(event);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error tracking comprehensive event for user {}: {}", event.getUserId(), e.getMessage(), e);

            EventResponse errorResponse = new EventResponse(
                    null,
                    "Failed to track comprehensive event: " + e.getMessage(),
                    System.currentTimeMillis());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Get user insights and analytics
     */
    @GetMapping("/user/{userId}/insights")
    public ResponseEntity<UserInsightsResponse> getUserInsights(@PathVariable String userId) {
        try {
            logger.info("Fetching insights for user: {}", userId);

            UserInsightsResponse insights = eventCollectionService.getUserInsights(userId);

            return ResponseEntity.ok(insights);

        } catch (Exception e) {
            logger.error("Error fetching insights for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get user events history
     */
    @GetMapping("/user/{userId}/history")
    public ResponseEntity<List<UserEvent>> getUserEventHistory(
            @PathVariable String userId,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime) {

        try {
            logger.info("Fetching event history for user: {} with limit: {}", userId, limit);

            List<UserEvent> events = eventCollectionService.getUserEventHistory(userId, limit, startTime, endTime);

            return ResponseEntity.ok(events);

        } catch (Exception e) {
            logger.error("Error fetching event history for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get struggle signals for a user
     */
    @GetMapping("/user/{userId}/struggles")
    public ResponseEntity<List<Map<String, Object>>> getUserStruggleSignals(@PathVariable String userId) {
        try {
            logger.info("Fetching struggle signals for user: {}", userId);

            List<Map<String, Object>> struggles = eventCollectionService.getUserStruggleSignals(userId);

            return ResponseEntity.ok(struggles);

        } catch (Exception e) {
            logger.error("Error fetching struggle signals for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get real-time analytics dashboard data
     */
    @GetMapping("/analytics/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardAnalytics(
            @RequestParam(defaultValue = "24") int hours) {

        try {
            logger.info("Fetching dashboard analytics for last {} hours", hours);

            Map<String, Object> analytics = eventCollectionService.getDashboardAnalytics(hours);

            return ResponseEntity.ok(analytics);

        } catch (Exception e) {
            logger.error("Error fetching dashboard analytics: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get comprehensive analytics for a user
     */
    @GetMapping("/analytics/comprehensive/{userId}")
    public ResponseEntity<Map<String, Object>> getComprehensiveAnalytics(
            @PathVariable String userId,
            @RequestParam(defaultValue = "24") int hours) {

        try {
            logger.info("Fetching comprehensive analytics for user: {} over {} hours", userId, hours);

            Map<String, Object> analytics = comprehensiveEventTrackingService.getComprehensiveAnalytics(userId, hours);

            return ResponseEntity.ok(analytics);

        } catch (Exception e) {
            logger.error("Error fetching comprehensive analytics for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get real-time event stream for a user
     */
    @GetMapping("/realtime/{userId}")
    public ResponseEntity<List<UserEvent>> getRealTimeEvents(
            @PathVariable String userId,
            @RequestParam(defaultValue = "50") int limit) {

        try {
            logger.info("Fetching real-time events for user: {} with limit: {}", userId, limit);

            List<UserEvent> events = comprehensiveEventTrackingService.getRealTimeEvents(userId, limit);

            return ResponseEntity.ok(events);

        } catch (Exception e) {
            logger.error("Error fetching real-time events for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get session correlation data
     */
    @GetMapping("/session/{sessionId}/correlation")
    public ResponseEntity<Map<String, Object>> getSessionCorrelation(@PathVariable String sessionId) {
        try {
            logger.info("Fetching session correlation for session: {}", sessionId);

            Map<String, Object> correlation = comprehensiveEventTrackingService.getSessionCorrelation(sessionId);

            return ResponseEntity.ok(correlation);

        } catch (Exception e) {
            logger.error("Error fetching session correlation for session {}: {}", sessionId, e.getMessage(), e);
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
                "service", "event-collection"));
    }
}