package com.userjourney.analytics.util;

import com.userjourney.analytics.model.UserEvent;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class EventValidator {
    
    private static final Logger logger = LoggerFactory.getLogger(EventValidator.class);
    
    // Valid event types
    private static final List<String> VALID_EVENT_TYPES = Arrays.asList(
        "page_view", 
        "video_engagement", 
        "feature_interaction", 
        "struggle_signal",
        "pricing_page_view",
        "checkout_abandon",
        "form_error",
        "video_complete",
        "user_action",
        "error_event"
    );
    
    // Valid platforms
    private static final List<String> VALID_PLATFORMS = Arrays.asList(
        "iOS", "Android", "Web"
    );
    
    // Valid user segments
    private static final List<String> VALID_USER_SEGMENTS = Arrays.asList(
        "new_user", "active_user", "engaged_user", "at_risk", "churned", "default"
    );
    
    // Regex patterns for validation
    private static final Pattern USER_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{1,200}$");
    private static final Pattern SESSION_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{1,200}$");
    private static final Pattern FEATURE_NAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._-]{1,200}$");
    private static final Pattern VIDEO_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9._-]{1,200}$");
    
    /**
     * Validate a user event
     */
    public void validateEvent(UserEvent event) {
        if (event == null) {
            throw new IllegalArgumentException("Event cannot be null");
        }
        
        validateBasicFields(event);
        validateEventData(event);
        validateDeviceInfo(event);
        validateUserContext(event);
        validateBusinessRules(event);
        
        logger.debug("Event validation passed for user: {}", event.getUserId());
    }
    
    /**
     * Validate basic required fields
     */
    private void validateBasicFields(UserEvent event) {
        // Event type validation
        if (event.getEventType() == null || event.getEventType().trim().isEmpty()) {
            throw new IllegalArgumentException("Event type is required");
        }
        
        if (!VALID_EVENT_TYPES.contains(event.getEventType())) {
            throw new IllegalArgumentException("Invalid event type: " + event.getEventType() + 
                ". Valid types are: " + VALID_EVENT_TYPES);
        }
        
        // User ID validation
        if (event.getUserId() == null || event.getUserId().trim().isEmpty()) {
            throw new IllegalArgumentException("User ID is required");
        }
        
        // Allow "anonymous" or pattern-matched user IDs
        if (!"anonymous".equals(event.getUserId()) && !USER_ID_PATTERN.matcher(event.getUserId()).matches()) {
            throw new IllegalArgumentException("Invalid user ID format. Must be 'anonymous' or alphanumeric with underscores/hyphens, 1-200 characters");
        }
        
        // Session ID validation
        if (event.getSessionId() == null || event.getSessionId().trim().isEmpty()) {
            throw new IllegalArgumentException("Session ID is required");
        }
        
        if (!SESSION_ID_PATTERN.matcher(event.getSessionId()).matches()) {
            throw new IllegalArgumentException("Invalid session ID format. Must be alphanumeric with underscores/hyphens, 1-200 characters");
        }
        
        // Timestamp validation
        if (event.getTimestamp() == null) {
            throw new IllegalArgumentException("Timestamp is required");
        }
        
        long now = System.currentTimeMillis();
        long oneHourAgo = now - (60 * 60 * 1000);
        long oneHourFromNow = now + (60 * 60 * 1000);
        
        if (event.getTimestamp() < oneHourAgo || event.getTimestamp() > oneHourFromNow) {
            throw new IllegalArgumentException("Timestamp must be within one hour of current time");
        }
    }
    
    /**
     * Validate event data based on event type
     */
    private void validateEventData(UserEvent event) {
        UserEvent.EventData eventData = event.getEventData();
        
        switch (event.getEventType()) {
            case "page_view":
                validatePageViewData(eventData);
                break;
            case "video_engagement":
                validateVideoEngagementData(eventData);
                break;
            case "feature_interaction":
                validateFeatureInteractionData(eventData);
                break;
            case "struggle_signal":
                validateStruggleSignalData(eventData);
                break;
            case "pricing_page_view":
                validatePricingPageViewData(eventData);
                break;
            case "checkout_abandon":
            case "form_error":
            case "video_complete":
            case "user_action":
            case "error_event":
                // These events have flexible data requirements
                if (eventData == null) {
                    throw new IllegalArgumentException("Event data is required for " + event.getEventType() + " events");
                }
                break;
        }
    }
    
    /**
     * Validate page view event data
     */
    private void validatePageViewData(UserEvent.EventData eventData) {
        if (eventData == null) {
            throw new IllegalArgumentException("Event data is required for page_view events");
        }
        
        if (eventData.getFeature() == null || eventData.getFeature().trim().isEmpty()) {
            throw new IllegalArgumentException("Feature (page name) is required for page_view events");
        }
        
        if (!FEATURE_NAME_PATTERN.matcher(eventData.getFeature()).matches()) {
            throw new IllegalArgumentException("Invalid feature name format");
        }
    }
    
    /**
     * Validate video engagement event data
     */
    private void validateVideoEngagementData(UserEvent.EventData eventData) {
        if (eventData == null) {
            throw new IllegalArgumentException("Event data is required for video_engagement events");
        }
        
        if (eventData.getVideoId() == null || eventData.getVideoId().trim().isEmpty()) {
            throw new IllegalArgumentException("Video ID is required for video_engagement events");
        }
        
        if (!VIDEO_ID_PATTERN.matcher(eventData.getVideoId()).matches()) {
            throw new IllegalArgumentException("Invalid video ID format");
        }
        
        // Validate numeric fields
        if (eventData.getDuration() != null && eventData.getDuration() < 0) {
            throw new IllegalArgumentException("Duration cannot be negative");
        }
        
        if (eventData.getWatchDuration() != null && eventData.getWatchDuration() < 0) {
            throw new IllegalArgumentException("Watch duration cannot be negative");
        }
        
        if (eventData.getCompletionRate() != null && 
            (eventData.getCompletionRate() < 0 || eventData.getCompletionRate() > 100)) {
            throw new IllegalArgumentException("Completion rate must be between 0 and 100");
        }
        
        if (eventData.getPlaybackSpeed() != null && 
            (eventData.getPlaybackSpeed() < 0.25 || eventData.getPlaybackSpeed() > 4.0)) {
            throw new IllegalArgumentException("Playback speed must be between 0.25 and 4.0");
        }
        
        // Validate pause points
        if (eventData.getPausePoints() != null) {
            for (Integer pausePoint : eventData.getPausePoints()) {
                if (pausePoint < 0) {
                    throw new IllegalArgumentException("Pause points cannot be negative");
                }
            }
        }
        
        // Validate skip segments
        if (eventData.getSkipSegments() != null) {
            for (UserEvent.TimeRange segment : eventData.getSkipSegments()) {
                if (segment.getStart() < 0 || segment.getEnd() < 0) {
                    throw new IllegalArgumentException("Skip segment times cannot be negative");
                }
                if (segment.getStart() >= segment.getEnd()) {
                    throw new IllegalArgumentException("Skip segment start time must be less than end time");
                }
            }
        }
    }
    
    /**
     * Validate feature interaction event data
     */
    private void validateFeatureInteractionData(UserEvent.EventData eventData) {
        if (eventData == null) {
            throw new IllegalArgumentException("Event data is required for feature_interaction events");
        }
        
        if (eventData.getFeature() == null || eventData.getFeature().trim().isEmpty()) {
            throw new IllegalArgumentException("Feature name is required for feature_interaction events");
        }
        
        if (!FEATURE_NAME_PATTERN.matcher(eventData.getFeature()).matches()) {
            throw new IllegalArgumentException("Invalid feature name format");
        }
        
        if (eventData.getAttemptCount() != null && eventData.getAttemptCount() < 1) {
            throw new IllegalArgumentException("Attempt count must be at least 1");
        }
        
        if (eventData.getDuration() != null && eventData.getDuration() < 0) {
            throw new IllegalArgumentException("Duration cannot be negative");
        }
    }
    
    /**
     * Validate struggle signal event data
     */
    private void validateStruggleSignalData(UserEvent.EventData eventData) {
        if (eventData == null) {
            throw new IllegalArgumentException("Event data is required for struggle_signal events");
        }
        
        if (eventData.getFeature() == null || eventData.getFeature().trim().isEmpty()) {
            throw new IllegalArgumentException("Feature name is required for struggle_signal events");
        }
        
        if (!FEATURE_NAME_PATTERN.matcher(eventData.getFeature()).matches()) {
            throw new IllegalArgumentException("Invalid feature name format");
        }
        
        if (eventData.getAttemptCount() == null || eventData.getAttemptCount() < 2) {
            throw new IllegalArgumentException("Attempt count must be at least 2 for struggle signals");
        }
    }
    
    /**
     * Validate pricing page view event data
     */
    private void validatePricingPageViewData(UserEvent.EventData eventData) {
        if (eventData == null) {
            throw new IllegalArgumentException("Event data is required for pricing_page_view events");
        }
        
        // Page and action are optional but if present should be valid
        if (eventData.getPage() != null && eventData.getPage().trim().isEmpty()) {
            throw new IllegalArgumentException("Page cannot be empty if provided");
        }
        
        if (eventData.getAction() != null && eventData.getAction().trim().isEmpty()) {
            throw new IllegalArgumentException("Action cannot be empty if provided");
        }
        
        // Feature is optional for pricing events
        if (eventData.getFeature() != null && !eventData.getFeature().trim().isEmpty()) {
            if (!FEATURE_NAME_PATTERN.matcher(eventData.getFeature()).matches()) {
                throw new IllegalArgumentException("Invalid feature name format");
            }
        }
    }
    
    /**
     * Validate device information
     */
    private void validateDeviceInfo(UserEvent event) {
        UserEvent.DeviceInfo deviceInfo = event.getDeviceInfo();
        
        if (deviceInfo != null) {
            if (deviceInfo.getPlatform() != null && !VALID_PLATFORMS.contains(deviceInfo.getPlatform())) {
                throw new IllegalArgumentException("Invalid platform: " + deviceInfo.getPlatform() + 
                    ". Valid platforms are: " + VALID_PLATFORMS);
            }
            
            if (deviceInfo.getAppVersion() != null && deviceInfo.getAppVersion().length() > 100) {
                throw new IllegalArgumentException("App version cannot exceed 100 characters");
            }
            
            if (deviceInfo.getDeviceModel() != null && deviceInfo.getDeviceModel().length() > 500) {
                System.err.println("❌ [EventValidator] Device model validation failed:");
                System.err.println("   Device Model Length: " + deviceInfo.getDeviceModel().length());
                System.err.println("   Device Model: " + deviceInfo.getDeviceModel());
                System.err.println("   First 100 chars: " + deviceInfo.getDeviceModel().substring(0, Math.min(100, deviceInfo.getDeviceModel().length())));
                throw new IllegalArgumentException("Device model cannot exceed 500 characters");
            }
            
            System.out.println("✅ [EventValidator] Device info validated successfully:");
            System.out.println("   Platform: " + deviceInfo.getPlatform());
            System.out.println("   App Version: " + deviceInfo.getAppVersion());
            System.out.println("   Device Model Length: " + (deviceInfo.getDeviceModel() != null ? deviceInfo.getDeviceModel().length() : "null"));
        }
    }
    
    /**
     * Validate user context
     */
    private void validateUserContext(UserEvent event) {
        UserEvent.UserContext userContext = event.getUserContext();
        
        if (userContext != null) {
            if (userContext.getUserSegment() != null && 
                !VALID_USER_SEGMENTS.contains(userContext.getUserSegment())) {
                throw new IllegalArgumentException("Invalid user segment: " + userContext.getUserSegment() + 
                    ". Valid segments are: " + VALID_USER_SEGMENTS);
            }
            
            if (userContext.getSessionStage() != null && userContext.getSessionStage().length() > 200) {
                throw new IllegalArgumentException("Session stage cannot exceed 200 characters");
            }
            
            if (userContext.getPreviousActions() != null && userContext.getPreviousActions().size() > 20) {
                throw new IllegalArgumentException("Previous actions list cannot exceed 20 items");
            }
        }
    }
    
    /**
     * Validate business rules
     */
    private void validateBusinessRules(UserEvent event) {
        // Rule 1: Video engagement events should have either duration or watch duration
        if ("video_engagement".equals(event.getEventType()) && event.getEventData() != null) {
            UserEvent.EventData data = event.getEventData();
            if (data.getDuration() == null && data.getWatchDuration() == null && data.getCompletionRate() == null) {
                throw new IllegalArgumentException("Video engagement events must have at least one metric (duration, watchDuration, or completionRate)");
            }
        }
        
        // Rule 2: Struggle signals should have a reasonable attempt count
        if ("struggle_signal".equals(event.getEventType()) && event.getEventData() != null) {
            UserEvent.EventData data = event.getEventData();
            if (data.getAttemptCount() != null && data.getAttemptCount() > 50) {
                throw new IllegalArgumentException("Attempt count seems unreasonably high (>50). Please verify the data.");
            }
        }
        
        // Rule 3: Feature interactions should not have video-specific fields
        if ("feature_interaction".equals(event.getEventType()) && event.getEventData() != null) {
            UserEvent.EventData data = event.getEventData();
            if (data.getVideoId() != null || data.getCompletionRate() != null || data.getPlaybackSpeed() != null) {
                throw new IllegalArgumentException("Feature interaction events should not contain video-specific fields");
            }
        }
        
        // Rule 4: Page view events should not have interaction-specific fields
        if ("page_view".equals(event.getEventType()) && event.getEventData() != null) {
            UserEvent.EventData data = event.getEventData();
            if (data.getAttemptCount() != null || data.getErrorType() != null) {
                throw new IllegalArgumentException("Page view events should not contain interaction-specific fields");
            }
        }
    }
    
    /**
     * Validate event for specific business context (can be extended)
     */
    public void validateForContext(UserEvent event, String context) {
        validateEvent(event); // Basic validation first
        
        switch (context) {
            case "demo":
                validateDemoContext(event);
                break;
            case "production":
                validateProductionContext(event);
                break;
            default:
                // No additional validation for unknown contexts
                break;
        }
    }
    
    /**
     * Additional validation for demo environment
     */
    private void validateDemoContext(UserEvent event) {
        // In demo, we might be more lenient or have specific test patterns
        if (event.getUserId().startsWith("test_") && event.getUserId().length() > 20) {
            throw new IllegalArgumentException("Demo test user IDs should not exceed 20 characters");
        }
    }
    
    /**
     * Additional validation for production environment
     */
    private void validateProductionContext(UserEvent event) {
        // In production, we might have stricter validation
        if (event.getUserId().startsWith("test_")) {
            throw new IllegalArgumentException("Test user IDs are not allowed in production");
        }
        
        // Ensure all required fields are present for production
        if (event.getDeviceInfo() == null) {
            throw new IllegalArgumentException("Device info is required in production");
        }
        
        if (event.getUserContext() == null) {
            throw new IllegalArgumentException("User context is required in production");
        }
    }
}