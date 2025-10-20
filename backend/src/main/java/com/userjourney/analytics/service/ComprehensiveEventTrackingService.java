package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.dto.EventResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ComprehensiveEventTrackingService {
    
    private static final Logger logger = LoggerFactory.getLogger(ComprehensiveEventTrackingService.class);
    
    @Autowired
    private EventCollectionService eventCollectionService;
    
    @Autowired
    private MonitoringService monitoringService;
    
    @Autowired
    private FirebaseAnalyticsIntegrationService firebaseAnalyticsService;
    
    @Autowired
    private CloudWatchLoggingService cloudWatchLoggingService;
    
    // In-memory storage for demo purposes - in production, this would use DynamoDB and Kinesis
    private final Map<String, List<UserEvent>> userEventHistory = new ConcurrentHashMap<>();
    private final Map<String, UserEvent> eventStorage = new ConcurrentHashMap<>();
    private final Queue<UserEvent> eventQueue = new LinkedList<>();
    
    // Event correlation tracking
    private final Map<String, List<String>> sessionEvents = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> sessionContext = new ConcurrentHashMap<>();
    
    /**
     * Track individual event with comprehensive logging
     */
    public EventResponse trackEvent(UserEvent event) {
        logger.info("Tracking comprehensive event: {} for user: {} in session: {}", 
                   event.getEventType(), event.getUserId(), event.getSessionId());
        
        try {
            // Validate and enrich event
            enrichEvent(event);
            
            // Store event
            String eventId = UUID.randomUUID().toString();
            event.setTimestamp(System.currentTimeMillis());
            eventStorage.put(eventId, event);
            
            // Add to user history
            userEventHistory.computeIfAbsent(event.getUserId(), k -> new ArrayList<>()).add(event);
            
            // Add to session tracking
            sessionEvents.computeIfAbsent(event.getSessionId(), k -> new ArrayList<>()).add(eventId);
            
            // Update session context
            updateSessionContext(event);
            
            // Add to processing queue
            eventQueue.offer(event);
            
            // Process through existing event collection service
            eventCollectionService.processEvent(event);
            
            // Log to AWS CloudWatch
            cloudWatchLoggingService.logUserEvent(event, eventId);
            
            // Send to Firebase Analytics
            firebaseAnalyticsService.sendEventToFirebase(event);
            
            // Update monitoring metrics
            updateMonitoringMetrics(event);
            
            logger.info("Successfully tracked comprehensive event: {} with ID: {}", event.getEventType(), eventId);
            
            return new EventResponse(
                eventId,
                "Event tracked successfully with comprehensive logging",
                System.currentTimeMillis()
            );
            
        } catch (Exception e) {
            logger.error("Error tracking comprehensive event for user {}: {}", event.getUserId(), e.getMessage(), e);
            
            // Log error event
            logErrorEvent(event, e);
            
            return new EventResponse(
                null,
                "Failed to track event: " + e.getMessage(),
                System.currentTimeMillis()
            );
        }
    }
    
    /**
     * Track batch events with correlation
     */
    public List<EventResponse> trackBatchEvents(List<UserEvent> events) {
        logger.info("Tracking batch of {} events with comprehensive logging", events.size());
        
        List<EventResponse> responses = new ArrayList<>();
        String batchId = UUID.randomUUID().toString();
        
        for (UserEvent event : events) {
            try {
                // Add batch correlation
                if (event.getUserContext() == null) {
                    event.setUserContext(new UserEvent.UserContext());
                }
                if (event.getUserContext().getPreviousActions() == null) {
                    event.getUserContext().setPreviousActions(new java.util.ArrayList<>());
                }
                event.getUserContext().getPreviousActions().add("batch_" + batchId);
                
                EventResponse response = trackEvent(event);
                responses.add(response);
                
            } catch (Exception e) {
                logger.error("Error in batch processing event: {}", e.getMessage(), e);
                responses.add(new EventResponse(
                    null,
                    "Batch event failed: " + e.getMessage(),
                    System.currentTimeMillis()
                ));
            }
        }
        
        // Log batch completion
        logBatchCompletion(batchId, events.size(), responses);
        
        return responses;
    }
    
    /**
     * Get comprehensive event analytics
     */
    public Map<String, Object> getComprehensiveAnalytics(String userId, int hours) {
        logger.info("Fetching comprehensive analytics for user: {} over {} hours", userId, hours);
        
        long cutoffTime = System.currentTimeMillis() - (hours * 3600 * 1000L);
        
        List<UserEvent> userEvents = userEventHistory.getOrDefault(userId, new ArrayList<>())
            .stream()
            .filter(event -> event.getTimestamp() >= cutoffTime)
            .collect(Collectors.toList());
        
        Map<String, Object> analytics = new HashMap<>();
        
        // Basic metrics
        analytics.put("totalEvents", userEvents.size());
        analytics.put("uniqueSessions", userEvents.stream()
            .map(UserEvent::getSessionId)
            .distinct()
            .count());
        
        // Event type distribution
        Map<String, Long> eventTypeDistribution = userEvents.stream()
            .collect(Collectors.groupingBy(UserEvent::getEventType, Collectors.counting()));
        analytics.put("eventTypeDistribution", eventTypeDistribution);
        
        // Feature usage
        Map<String, Long> featureUsage = userEvents.stream()
            .filter(event -> event.getEventData() != null && event.getEventData().getFeature() != null)
            .collect(Collectors.groupingBy(
                event -> event.getEventData().getFeature(),
                Collectors.counting()
            ));
        analytics.put("featureUsage", featureUsage);
        
        // Session analysis
        Map<String, Object> sessionAnalysis = analyzeUserSessions(userId, userEvents);
        analytics.put("sessionAnalysis", sessionAnalysis);
        
        // Error analysis
        Map<String, Object> errorAnalysis = analyzeUserErrors(userEvents);
        analytics.put("errorAnalysis", errorAnalysis);
        
        // Engagement metrics
        Map<String, Object> engagementMetrics = calculateEngagementMetrics(userEvents);
        analytics.put("engagementMetrics", engagementMetrics);
        
        return analytics;
    }
    
    /**
     * Get real-time event stream for a user
     */
    public List<UserEvent> getRealTimeEvents(String userId, int limit) {
        logger.info("Fetching real-time events for user: {} with limit: {}", userId, limit);
        
        return userEventHistory.getOrDefault(userId, new ArrayList<>())
            .stream()
            .sorted((e1, e2) -> Long.compare(e2.getTimestamp(), e1.getTimestamp()))
            .limit(limit)
            .collect(Collectors.toList());
    }
    
    /**
     * Get session correlation data
     */
    public Map<String, Object> getSessionCorrelation(String sessionId) {
        logger.info("Fetching session correlation for session: {}", sessionId);
        
        List<String> eventIds = sessionEvents.getOrDefault(sessionId, new ArrayList<>());
        List<UserEvent> sessionEventList = eventIds.stream()
            .map(eventStorage::get)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparing(UserEvent::getTimestamp))
            .collect(Collectors.toList());
        
        Map<String, Object> correlation = new HashMap<>();
        correlation.put("sessionId", sessionId);
        correlation.put("events", sessionEventList);
        correlation.put("eventCount", sessionEventList.size());
        correlation.put("context", sessionContext.get(sessionId));
        
        if (!sessionEventList.isEmpty()) {
            correlation.put("startTime", sessionEventList.get(0).getTimestamp());
            correlation.put("endTime", sessionEventList.get(sessionEventList.size() - 1).getTimestamp());
            correlation.put("duration", sessionEventList.get(sessionEventList.size() - 1).getTimestamp() - 
                                      sessionEventList.get(0).getTimestamp());
        }
        
        return correlation;
    }
    
    /**
     * Enrich event with additional context
     */
    private void enrichEvent(UserEvent event) {
        // Add server-side timestamp if not present
        if (event.getTimestamp() == null) {
            event.setTimestamp(System.currentTimeMillis());
        }
        
        // Enrich user context
        if (event.getUserContext() == null) {
            event.setUserContext(new UserEvent.UserContext());
        }
        
        // Add session stage based on event history
        String sessionStage = determineSessionStage(event.getSessionId(), event.getEventType());
        event.getUserContext().setSessionStage(sessionStage);
        
        // Add previous actions from session
        List<String> previousActions = getPreviousSessionActions(event.getSessionId());
        event.getUserContext().setPreviousActions(previousActions);
        
        // Enrich device info if missing
        if (event.getDeviceInfo() == null) {
            event.setDeviceInfo(new UserEvent.DeviceInfo());
            event.getDeviceInfo().setPlatform("web");
            event.getDeviceInfo().setAppVersion("1.0.0");
        }
    }
    
    /**
     * Update session context
     */
    private void updateSessionContext(UserEvent event) {
        Map<String, Object> context = sessionContext.computeIfAbsent(event.getSessionId(), k -> new HashMap<>());
        
        context.put("lastEventType", event.getEventType());
        context.put("lastEventTime", event.getTimestamp());
        context.put("userId", event.getUserId());
        
        if (event.getEventData() != null && event.getEventData().getFeature() != null) {
            context.put("lastFeature", event.getEventData().getFeature());
        }
        
        // Track session progression
        @SuppressWarnings("unchecked")
        List<String> eventSequence = (List<String>) context.computeIfAbsent("eventSequence", k -> new ArrayList<>());
        eventSequence.add(event.getEventType());
        
        // Keep only last 20 events in sequence
        if (eventSequence.size() > 20) {
            eventSequence.remove(0);
        }
    }
    
    /**
     * Determine session stage based on event history
     */
    private String determineSessionStage(String sessionId, String eventType) {
        List<String> eventIds = sessionEvents.getOrDefault(sessionId, new ArrayList<>());
        
        if (eventIds.isEmpty()) {
            return "start";
        } else if (eventIds.size() < 5) {
            return "early";
        } else if (eventType.contains("error") || eventType.contains("struggle")) {
            return "struggling";
        } else if (eventIds.size() > 20) {
            return "engaged";
        } else {
            return "active";
        }
    }
    
    /**
     * Get previous session actions
     */
    private List<String> getPreviousSessionActions(String sessionId) {
        List<String> eventIds = sessionEvents.getOrDefault(sessionId, new ArrayList<>());
        
        return eventIds.stream()
            .map(eventStorage::get)
            .filter(Objects::nonNull)
            .map(UserEvent::getEventType)
            .collect(Collectors.toList());
    }
    

    
    /**
     * Update monitoring metrics
     */
    private void updateMonitoringMetrics(UserEvent event) {
        try {
            // Update various metrics for monitoring
            monitoringService.incrementUserEventsProcessed(event.getEventType());
            
            // Track struggle signals
            if (event.getEventType().contains("struggle") || event.getEventType().contains("error")) {
                monitoringService.incrementStruggleSignalsDetected();
            }
            
            // Track video engagement
            if ("video_engagement".equals(event.getEventType()) && 
                event.getEventData() != null && event.getEventData().getCompletionRate() != null &&
                event.getEventData().getCompletionRate() > 0.8) {
                monitoringService.incrementHighVideoEngagement();
            }
            
            // Record performance metrics if available
            if (event.getEventData() != null && event.getEventData().getDuration() != null) {
                monitoringService.recordUserJourneyMetric("event_duration", event.getEventData().getDuration(), 
                                                         "event_type", event.getEventType());
            }
            
        } catch (Exception e) {
            logger.error("Failed to update monitoring metrics: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Log error event
     */
    private void logErrorEvent(UserEvent originalEvent, Exception error) {
        try {
            UserEvent errorEvent = new UserEvent();
            errorEvent.setEventType("tracking_error");
            errorEvent.setUserId(originalEvent.getUserId());
            errorEvent.setSessionId(originalEvent.getSessionId());
            errorEvent.setTimestamp(System.currentTimeMillis());
            
            UserEvent.EventData errorData = new UserEvent.EventData();
            errorData.setErrorType(error.getClass().getSimpleName());
            errorData.setFeature("event_tracking");
            errorEvent.setEventData(errorData);
            
            // Store error event
            String errorEventId = UUID.randomUUID().toString();
            eventStorage.put(errorEventId, errorEvent);
            
            logger.error("Logged tracking error event: {}", errorEventId);
            
        } catch (Exception e) {
            logger.error("Failed to log error event: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Log batch completion
     */
    private void logBatchCompletion(String batchId, int totalEvents, List<EventResponse> responses) {
        long successCount = responses.stream()
            .filter(r -> r.getEventId() != null)
            .count();
        
        logger.info("Batch {} completed: {}/{} events successful", batchId, successCount, totalEvents);
        
        // Update monitoring metrics
        monitoringService.recordUserJourneyMetric("batch_total", 1, "batch_id", batchId);
        monitoringService.recordUserJourneyMetric("batch_success_rate", (double) successCount / totalEvents, 
                                                 "batch_id", batchId);
    }
    
    /**
     * Analyze user sessions
     */
    private Map<String, Object> analyzeUserSessions(String userId, List<UserEvent> events) {
        Map<String, List<UserEvent>> sessionGroups = events.stream()
            .collect(Collectors.groupingBy(UserEvent::getSessionId));
        
        Map<String, Object> analysis = new HashMap<>();
        analysis.put("sessionCount", sessionGroups.size());
        
        if (!sessionGroups.isEmpty()) {
            double avgSessionLength = sessionGroups.values().stream()
                .mapToDouble(sessionEvents -> {
                    if (sessionEvents.size() < 2) return 0;
                    long start = sessionEvents.stream().mapToLong(UserEvent::getTimestamp).min().orElse(0);
                    long end = sessionEvents.stream().mapToLong(UserEvent::getTimestamp).max().orElse(0);
                    return (end - start) / 1000.0; // Convert to seconds
                })
                .average().orElse(0.0);
            
            analysis.put("averageSessionDuration", avgSessionLength);
            analysis.put("averageEventsPerSession", events.size() / (double) sessionGroups.size());
        }
        
        return analysis;
    }
    
    /**
     * Analyze user errors
     */
    private Map<String, Object> analyzeUserErrors(List<UserEvent> events) {
        List<UserEvent> errorEvents = events.stream()
            .filter(event -> event.getEventType().contains("error") || 
                           (event.getEventData() != null && event.getEventData().getErrorType() != null))
            .collect(Collectors.toList());
        
        Map<String, Object> analysis = new HashMap<>();
        analysis.put("errorCount", errorEvents.size());
        analysis.put("errorRate", events.isEmpty() ? 0.0 : (double) errorEvents.size() / events.size());
        
        if (!errorEvents.isEmpty()) {
            Map<String, Long> errorTypes = errorEvents.stream()
                .filter(event -> event.getEventData() != null && event.getEventData().getErrorType() != null)
                .collect(Collectors.groupingBy(
                    event -> event.getEventData().getErrorType(),
                    Collectors.counting()
                ));
            analysis.put("errorTypeDistribution", errorTypes);
        }
        
        return analysis;
    }
    
    /**
     * Calculate engagement metrics
     */
    private Map<String, Object> calculateEngagementMetrics(List<UserEvent> events) {
        Map<String, Object> metrics = new HashMap<>();
        
        if (events.isEmpty()) {
            return metrics;
        }
        
        // Time-based metrics
        long firstEvent = events.stream().mapToLong(UserEvent::getTimestamp).min().orElse(0);
        long lastEvent = events.stream().mapToLong(UserEvent::getTimestamp).max().orElse(0);
        long totalTimeSpan = lastEvent - firstEvent;
        
        metrics.put("totalTimeSpan", totalTimeSpan / 1000.0); // Convert to seconds
        metrics.put("eventsPerMinute", totalTimeSpan > 0 ? (events.size() * 60000.0) / totalTimeSpan : 0);
        
        // Feature engagement
        long featureInteractions = events.stream()
            .filter(event -> event.getEventData() != null && event.getEventData().getFeature() != null)
            .count();
        
        metrics.put("featureEngagementRate", (double) featureInteractions / events.size());
        
        return metrics;
    }
}