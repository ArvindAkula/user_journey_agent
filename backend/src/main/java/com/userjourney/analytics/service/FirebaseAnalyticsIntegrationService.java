package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class FirebaseAnalyticsIntegrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(FirebaseAnalyticsIntegrationService.class);
    
    // Firebase event name mapping
    private static final Map<String, String> EVENT_NAME_MAPPING = Map.of(
        "page_view", "page_view",
        "feature_interaction", "select_content",
        "video_engagement", "video_play",
        "loan_calculation", "generate_lead",
        "document_upload", "file_upload",
        "profile_update", "profile_update",
        "user_struggle", "exception",
        "error_occurred", "exception"
    );
    
    // Maximum parameters per Firebase event
    private static final int MAX_PARAMETERS = 25;
    
    /**
     * Send event to Firebase Analytics
     */
    public CompletableFuture<Boolean> sendEventToFirebase(UserEvent event) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Sending event to Firebase Analytics: {} for user: {}", 
                           event.getEventType(), event.getUserId());
                
                Map<String, Object> firebaseEvent = convertToFirebaseEvent(event);
                
                // Simulate Firebase Analytics call
                // In production, this would use Firebase Admin SDK
                boolean success = simulateFirebaseCall(firebaseEvent);
                
                if (success) {
                    logger.info("Successfully sent event to Firebase Analytics: {}", event.getEventType());
                } else {
                    logger.error("Failed to send event to Firebase Analytics: {}", event.getEventType());
                }
                
                return success;
                
            } catch (Exception e) {
                logger.error("Error sending event to Firebase Analytics: {}", e.getMessage(), e);
                return false;
            }
        });
    }
    
    /**
     * Send batch events to Firebase Analytics
     */
    public CompletableFuture<Map<String, Boolean>> sendBatchEventsToFirebase(List<UserEvent> events) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Sending batch of {} events to Firebase Analytics", events.size());
            
            Map<String, Boolean> results = new HashMap<>();
            
            for (UserEvent event : events) {
                try {
                    Map<String, Object> firebaseEvent = convertToFirebaseEvent(event);
                    boolean success = simulateFirebaseCall(firebaseEvent);
                    results.put(event.getEventType() + "_" + event.getTimestamp(), success);
                    
                } catch (Exception e) {
                    logger.error("Error in batch Firebase event processing: {}", e.getMessage(), e);
                    results.put(event.getEventType() + "_" + event.getTimestamp(), false);
                }
            }
            
            long successCount = results.values().stream().mapToLong(success -> success ? 1 : 0).sum();
            logger.info("Firebase batch processing completed: {}/{} events successful", successCount, events.size());
            
            return results;
        });
    }
    
    /**
     * Send user property update to Firebase
     */
    public CompletableFuture<Boolean> updateUserProperties(String userId, Map<String, Object> properties) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Updating Firebase user properties for user: {}", userId);
                
                Map<String, Object> firebaseProperties = sanitizeUserProperties(properties);
                
                // Simulate Firebase user property update
                boolean success = simulateFirebaseUserPropertyUpdate(userId, firebaseProperties);
                
                if (success) {
                    logger.info("Successfully updated Firebase user properties for user: {}", userId);
                } else {
                    logger.error("Failed to update Firebase user properties for user: {}", userId);
                }
                
                return success;
                
            } catch (Exception e) {
                logger.error("Error updating Firebase user properties for user {}: {}", userId, e.getMessage(), e);
                return false;
            }
        });
    }
    
    /**
     * Convert UserEvent to Firebase Analytics event format
     */
    private Map<String, Object> convertToFirebaseEvent(UserEvent event) {
        Map<String, Object> firebaseEvent = new HashMap<>();
        
        // Map event name
        String firebaseEventName = EVENT_NAME_MAPPING.getOrDefault(event.getEventType(), "custom_event");
        firebaseEvent.put("name", firebaseEventName);
        
        // Add standard parameters
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("user_id", event.getUserId());
        parameters.put("session_id", event.getSessionId());
        parameters.put("timestamp", event.getTimestamp());
        parameters.put("original_event_type", event.getEventType());
        
        // Add event data parameters
        if (event.getEventData() != null) {
            addEventDataParameters(parameters, event.getEventData());
        }
        
        // Add device info parameters
        if (event.getDeviceInfo() != null) {
            addDeviceInfoParameters(parameters, event.getDeviceInfo());
        }
        
        // Add user context parameters
        if (event.getUserContext() != null) {
            addUserContextParameters(parameters, event.getUserContext());
        }
        
        // Limit parameters to Firebase maximum
        if (parameters.size() > MAX_PARAMETERS) {
            parameters = limitParameters(parameters);
        }
        
        firebaseEvent.put("parameters", parameters);
        
        return firebaseEvent;
    }
    
    /**
     * Add event data parameters
     */
    private void addEventDataParameters(Map<String, Object> parameters, UserEvent.EventData eventData) {
        if (eventData.getFeature() != null) {
            parameters.put("feature", eventData.getFeature());
        }
        if (eventData.getVideoId() != null) {
            parameters.put("video_id", eventData.getVideoId());
        }
        if (eventData.getDuration() != null) {
            parameters.put("duration", eventData.getDuration());
        }
        if (eventData.getCompletionRate() != null) {
            parameters.put("completion_rate", eventData.getCompletionRate());
        }
        if (eventData.getAttemptCount() != null) {
            parameters.put("attempt_count", eventData.getAttemptCount());
        }
        if (eventData.getErrorType() != null) {
            parameters.put("error_type", eventData.getErrorType());
        }
        if (eventData.getWatchDuration() != null) {
            parameters.put("watch_duration", eventData.getWatchDuration());
        }
        if (eventData.getPlaybackSpeed() != null) {
            parameters.put("playback_speed", eventData.getPlaybackSpeed());
        }
    }
    
    /**
     * Add device info parameters
     */
    private void addDeviceInfoParameters(Map<String, Object> parameters, UserEvent.DeviceInfo deviceInfo) {
        if (deviceInfo.getPlatform() != null) {
            parameters.put("platform", deviceInfo.getPlatform());
        }
        if (deviceInfo.getAppVersion() != null) {
            parameters.put("app_version", deviceInfo.getAppVersion());
        }
        if (deviceInfo.getDeviceModel() != null) {
            parameters.put("device_model", deviceInfo.getDeviceModel());
        }
    }
    
    /**
     * Add user context parameters
     */
    private void addUserContextParameters(Map<String, Object> parameters, UserEvent.UserContext userContext) {
        if (userContext.getUserSegment() != null) {
            parameters.put("user_segment", userContext.getUserSegment());
        }
        if (userContext.getSessionStage() != null) {
            parameters.put("session_stage", userContext.getSessionStage());
        }
        if (userContext.getPreviousActions() != null && !userContext.getPreviousActions().isEmpty()) {
            // Take only the last few actions to avoid parameter limit
            List<String> recentActions = userContext.getPreviousActions();
            if (recentActions.size() > 3) {
                recentActions = recentActions.subList(recentActions.size() - 3, recentActions.size());
            }
            parameters.put("previous_actions", String.join(",", recentActions));
        }
    }
    
    /**
     * Limit parameters to Firebase maximum
     */
    private Map<String, Object> limitParameters(Map<String, Object> parameters) {
        Map<String, Object> limitedParameters = new HashMap<>();
        
        // Priority order for parameters
        String[] priorityKeys = {
            "user_id", "session_id", "timestamp", "feature", "video_id", 
            "duration", "error_type", "platform", "user_segment"
        };
        
        // Add priority parameters first
        for (String key : priorityKeys) {
            if (parameters.containsKey(key) && limitedParameters.size() < MAX_PARAMETERS) {
                limitedParameters.put(key, parameters.get(key));
            }
        }
        
        // Add remaining parameters up to limit
        for (Map.Entry<String, Object> entry : parameters.entrySet()) {
            if (!limitedParameters.containsKey(entry.getKey()) && limitedParameters.size() < MAX_PARAMETERS) {
                limitedParameters.put(entry.getKey(), entry.getValue());
            }
        }
        
        if (parameters.size() > MAX_PARAMETERS) {
            logger.warn("Firebase event parameters limited from {} to {}", parameters.size(), limitedParameters.size());
        }
        
        return limitedParameters;
    }
    
    /**
     * Sanitize user properties for Firebase
     */
    private Map<String, Object> sanitizeUserProperties(Map<String, Object> properties) {
        Map<String, Object> sanitized = new HashMap<>();
        
        for (Map.Entry<String, Object> entry : properties.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            // Firebase user property name restrictions
            if (key.length() <= 24 && key.matches("^[a-zA-Z][a-zA-Z0-9_]*$")) {
                // Firebase user property value restrictions
                if (value instanceof String && ((String) value).length() <= 36) {
                    sanitized.put(key, value);
                } else if (value instanceof Number) {
                    sanitized.put(key, value);
                } else if (value instanceof Boolean) {
                    sanitized.put(key, value);
                }
            }
        }
        
        return sanitized;
    }
    
    /**
     * Simulate Firebase Analytics call (for demo purposes)
     */
    private boolean simulateFirebaseCall(Map<String, Object> firebaseEvent) {
        try {
            // Simulate network delay
            Thread.sleep(50 + (int) (Math.random() * 100));
            
            // Simulate 95% success rate
            boolean success = Math.random() < 0.95;
            
            if (success) {
                logger.debug("Firebase Analytics Event Sent: {}", firebaseEvent.get("name"));
            } else {
                logger.warn("Firebase Analytics Event Failed: {}", firebaseEvent.get("name"));
            }
            
            return success;
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
    
    /**
     * Simulate Firebase user property update (for demo purposes)
     */
    private boolean simulateFirebaseUserPropertyUpdate(String userId, Map<String, Object> properties) {
        try {
            // Simulate network delay
            Thread.sleep(30 + (int) (Math.random() * 70));
            
            // Simulate 98% success rate for user properties
            boolean success = Math.random() < 0.98;
            
            if (success) {
                logger.debug("Firebase User Properties Updated for user: {} with {} properties", userId, properties.size());
            } else {
                logger.warn("Firebase User Properties Update Failed for user: {}", userId);
            }
            
            return success;
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
    
    /**
     * Get Firebase Analytics integration statistics
     */
    public Map<String, Object> getIntegrationStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        // In a real implementation, these would be actual metrics
        stats.put("eventsProcessed", 1000 + (int) (Math.random() * 5000));
        stats.put("successRate", 0.95 + (Math.random() * 0.04)); // 95-99%
        stats.put("averageLatency", 75 + (int) (Math.random() * 50)); // 75-125ms
        stats.put("lastEventTime", System.currentTimeMillis());
        stats.put("integrationStatus", "active");
        
        return stats;
    }
}