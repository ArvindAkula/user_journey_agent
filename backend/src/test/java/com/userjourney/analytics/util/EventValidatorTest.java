package com.userjourney.analytics.util;

import com.userjourney.analytics.model.UserEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EventValidatorTest {
    
    private EventValidator eventValidator;
    
    @BeforeEach
    void setUp() {
        eventValidator = new EventValidator();
    }
    
    @Nested
    @DisplayName("Basic Field Validation Tests")
    class BasicFieldValidationTests {
        
        @Test
        @DisplayName("Should validate a complete valid event")
        void shouldValidateCompleteValidEvent() {
            UserEvent event = createValidEvent();
            
            assertDoesNotThrow(() -> eventValidator.validateEvent(event));
        }
        
        @Test
        @DisplayName("Should throw exception for null event")
        void shouldThrowExceptionForNullEvent() {
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(null)
            );
            assertEquals("Event cannot be null", exception.getMessage());
        }
        
        @Test
        @DisplayName("Should throw exception for null event type")
        void shouldThrowExceptionForNullEventType() {
            UserEvent event = createValidEvent();
            event.setEventType(null);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertEquals("Event type is required", exception.getMessage());
        }
        
        @Test
        @DisplayName("Should throw exception for invalid event type")
        void shouldThrowExceptionForInvalidEventType() {
            UserEvent event = createValidEvent();
            event.setEventType("invalid_type");
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Invalid event type"));
        }
        
        @Test
        @DisplayName("Should throw exception for null user ID")
        void shouldThrowExceptionForNullUserId() {
            UserEvent event = createValidEvent();
            event.setUserId(null);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertEquals("User ID is required", exception.getMessage());
        }
        
        @Test
        @DisplayName("Should throw exception for invalid user ID format")
        void shouldThrowExceptionForInvalidUserIdFormat() {
            UserEvent event = createValidEvent();
            event.setUserId("invalid@user#id");
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Invalid user ID format"));
        }
        
        @Test
        @DisplayName("Should throw exception for null session ID")
        void shouldThrowExceptionForNullSessionId() {
            UserEvent event = createValidEvent();
            event.setSessionId(null);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertEquals("Session ID is required", exception.getMessage());
        }
        
        @Test
        @DisplayName("Should throw exception for null timestamp")
        void shouldThrowExceptionForNullTimestamp() {
            UserEvent event = createValidEvent();
            event.setTimestamp(null);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertEquals("Timestamp is required", exception.getMessage());
        }
        
        @Test
        @DisplayName("Should throw exception for timestamp too far in past")
        void shouldThrowExceptionForOldTimestamp() {
            UserEvent event = createValidEvent();
            event.setTimestamp(System.currentTimeMillis() - (2 * 60 * 60 * 1000)); // 2 hours ago
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Timestamp must be within one hour"));
        }
    }
    
    @Nested
    @DisplayName("Event Type Specific Validation Tests")
    class EventTypeSpecificValidationTests {
        
        @Test
        @DisplayName("Should validate page view event with required fields")
        void shouldValidatePageViewEvent() {
            UserEvent event = createValidEvent();
            event.setEventType("page_view");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature("home_page");
            event.setEventData(eventData);
            
            assertDoesNotThrow(() -> eventValidator.validateEvent(event));
        }
        
        @Test
        @DisplayName("Should throw exception for page view without feature")
        void shouldThrowExceptionForPageViewWithoutFeature() {
            UserEvent event = createValidEvent();
            event.setEventType("page_view");
            event.setEventData(new UserEvent.EventData());
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Feature (page name) is required"));
        }
        
        @Test
        @DisplayName("Should validate video engagement event with required fields")
        void shouldValidateVideoEngagementEvent() {
            UserEvent event = createValidEvent();
            event.setEventType("video_engagement");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setVideoId("video_123");
            eventData.setDuration(300);
            eventData.setWatchDuration(250);
            eventData.setCompletionRate(83.3);
            event.setEventData(eventData);
            
            assertDoesNotThrow(() -> eventValidator.validateEvent(event));
        }
        
        @Test
        @DisplayName("Should throw exception for video engagement without video ID")
        void shouldThrowExceptionForVideoEngagementWithoutVideoId() {
            UserEvent event = createValidEvent();
            event.setEventType("video_engagement");
            event.setEventData(new UserEvent.EventData());
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Video ID is required"));
        }
        
        @Test
        @DisplayName("Should throw exception for invalid completion rate")
        void shouldThrowExceptionForInvalidCompletionRate() {
            UserEvent event = createValidEvent();
            event.setEventType("video_engagement");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setVideoId("video_123");
            eventData.setCompletionRate(150.0); // Invalid: > 100
            event.setEventData(eventData);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Completion rate must be between 0 and 100"));
        }
        
        @Test
        @DisplayName("Should validate feature interaction event")
        void shouldValidateFeatureInteractionEvent() {
            UserEvent event = createValidEvent();
            event.setEventType("feature_interaction");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature("document_upload");
            eventData.setAttemptCount(1);
            eventData.setDuration(5000);
            event.setEventData(eventData);
            
            assertDoesNotThrow(() -> eventValidator.validateEvent(event));
        }
        
        @Test
        @DisplayName("Should validate struggle signal event")
        void shouldValidateStruggleSignalEvent() {
            UserEvent event = createValidEvent();
            event.setEventType("struggle_signal");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature("form_submission");
            eventData.setAttemptCount(3);
            eventData.setErrorType("validation_error");
            event.setEventData(eventData);
            
            assertDoesNotThrow(() -> eventValidator.validateEvent(event));
        }
        
        @Test
        @DisplayName("Should throw exception for struggle signal with low attempt count")
        void shouldThrowExceptionForStruggleSignalWithLowAttemptCount() {
            UserEvent event = createValidEvent();
            event.setEventType("struggle_signal");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature("form_submission");
            eventData.setAttemptCount(1); // Invalid: must be >= 2
            event.setEventData(eventData);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Attempt count must be at least 2"));
        }
    }
    
    @Nested
    @DisplayName("Device Info Validation Tests")
    class DeviceInfoValidationTests {
        
        @Test
        @DisplayName("Should validate valid device info")
        void shouldValidateValidDeviceInfo() {
            UserEvent event = createValidEvent();
            
            UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
            deviceInfo.setPlatform("Web");
            deviceInfo.setAppVersion("1.0.0");
            deviceInfo.setDeviceModel("Chrome/91.0");
            event.setDeviceInfo(deviceInfo);
            
            assertDoesNotThrow(() -> eventValidator.validateEvent(event));
        }
        
        @Test
        @DisplayName("Should throw exception for invalid platform")
        void shouldThrowExceptionForInvalidPlatform() {
            UserEvent event = createValidEvent();
            
            UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
            deviceInfo.setPlatform("InvalidPlatform");
            event.setDeviceInfo(deviceInfo);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Invalid platform"));
        }
        
        @Test
        @DisplayName("Should throw exception for app version too long")
        void shouldThrowExceptionForAppVersionTooLong() {
            UserEvent event = createValidEvent();
            
            UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
            deviceInfo.setPlatform("Web");
            deviceInfo.setAppVersion("1.0.0.very.long.version.string.that.exceeds.limit");
            event.setDeviceInfo(deviceInfo);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("App version cannot exceed 20 characters"));
        }
    }
    
    @Nested
    @DisplayName("User Context Validation Tests")
    class UserContextValidationTests {
        
        @Test
        @DisplayName("Should validate valid user context")
        void shouldValidateValidUserContext() {
            UserEvent event = createValidEvent();
            
            UserEvent.UserContext userContext = new UserEvent.UserContext();
            userContext.setUserSegment("active_user");
            userContext.setSessionStage("exploration");
            userContext.setPreviousActions(Arrays.asList("page_view:home", "feature_interaction:search"));
            event.setUserContext(userContext);
            
            assertDoesNotThrow(() -> eventValidator.validateEvent(event));
        }
        
        @Test
        @DisplayName("Should throw exception for invalid user segment")
        void shouldThrowExceptionForInvalidUserSegment() {
            UserEvent event = createValidEvent();
            
            UserEvent.UserContext userContext = new UserEvent.UserContext();
            userContext.setUserSegment("invalid_segment");
            event.setUserContext(userContext);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("Invalid user segment"));
        }
    }
    
    @Nested
    @DisplayName("Business Rules Validation Tests")
    class BusinessRulesValidationTests {
        
        @Test
        @DisplayName("Should throw exception for video engagement without metrics")
        void shouldThrowExceptionForVideoEngagementWithoutMetrics() {
            UserEvent event = createValidEvent();
            event.setEventType("video_engagement");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setVideoId("video_123");
            // No duration, watchDuration, or completionRate
            event.setEventData(eventData);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("must have at least one metric"));
        }
        
        @Test
        @DisplayName("Should throw exception for feature interaction with video fields")
        void shouldThrowExceptionForFeatureInteractionWithVideoFields() {
            UserEvent event = createValidEvent();
            event.setEventType("feature_interaction");
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature("button_click");
            eventData.setVideoId("video_123"); // Invalid for feature interaction
            event.setEventData(eventData);
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateEvent(event)
            );
            assertTrue(exception.getMessage().contains("should not contain video-specific fields"));
        }
    }
    
    @Nested
    @DisplayName("Context Specific Validation Tests")
    class ContextSpecificValidationTests {
        
        @Test
        @DisplayName("Should validate demo context")
        void shouldValidateDemoContext() {
            UserEvent event = createValidEvent();
            event.setUserId("test_user_123");
            
            assertDoesNotThrow(() -> eventValidator.validateForContext(event, "demo"));
        }
        
        @Test
        @DisplayName("Should throw exception for long test user ID in demo")
        void shouldThrowExceptionForLongTestUserIdInDemo() {
            UserEvent event = createValidEvent();
            event.setUserId("test_very_long_user_id_that_exceeds_limit");
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateForContext(event, "demo")
            );
            assertTrue(exception.getMessage().contains("should not exceed 20 characters"));
        }
        
        @Test
        @DisplayName("Should throw exception for test user in production")
        void shouldThrowExceptionForTestUserInProduction() {
            UserEvent event = createValidEvent();
            event.setUserId("test_user");
            
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> eventValidator.validateForContext(event, "production")
            );
            assertTrue(exception.getMessage().contains("Test user IDs are not allowed in production"));
        }
    }
    
    /**
     * Helper method to create a valid event for testing
     */
    private UserEvent createValidEvent() {
        UserEvent event = new UserEvent();
        event.setEventType("page_view");
        event.setUserId("user_123");
        event.setSessionId("session_456");
        event.setTimestamp(System.currentTimeMillis());
        
        UserEvent.EventData eventData = new UserEvent.EventData();
        eventData.setFeature("home_page");
        event.setEventData(eventData);
        
        UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
        deviceInfo.setPlatform("Web");
        deviceInfo.setAppVersion("1.0.0");
        deviceInfo.setDeviceModel("Chrome");
        event.setDeviceInfo(deviceInfo);
        
        UserEvent.UserContext userContext = new UserEvent.UserContext();
        userContext.setUserSegment("new_user");
        userContext.setSessionStage("onboarding");
        userContext.setPreviousActions(Arrays.asList());
        event.setUserContext(userContext);
        
        return event;
    }
}