package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.dto.EventResponse;
import com.userjourney.analytics.dto.UserInsightsResponse;
import com.userjourney.analytics.util.EventValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.PutRecordRequest;
import software.amazon.awssdk.services.kinesis.model.PutRecordResponse;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventCollectionServiceTest {
    
    @Mock
    private EventValidator eventValidator;
    
    @Mock
    private KinesisClient kinesisClient;
    
    @Mock
    private ObjectMapper objectMapper;
    
    private EventCollectionService eventCollectionService;
    
    @BeforeEach
    void setUp() {
        eventCollectionService = new EventCollectionService();
        // Use reflection to inject mocks (in real Spring app, use @InjectMocks)
        setField(eventCollectionService, "eventValidator", eventValidator);
        setField(eventCollectionService, "kinesisClient", kinesisClient);
        setField(eventCollectionService, "objectMapper", objectMapper);
    }
    
    @Nested
    @DisplayName("Single Event Processing Tests")
    class SingleEventProcessingTests {
        
        @Test
        @DisplayName("Should successfully process valid event")
        void shouldSuccessfullyProcessValidEvent() throws Exception {
            // Arrange
            UserEvent event = createValidPageViewEvent();
            
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{\"eventType\":\"page_view\"}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Act
            String eventId = eventCollectionService.processEvent(event);
            
            // Assert
            assertNotNull(eventId);
            assertTrue(eventId.startsWith("evt_"));
            verify(eventValidator).validateEvent(event);
            verify(kinesisClient).putRecord(any(PutRecordRequest.class));
        }
        
        @Test
        @DisplayName("Should throw exception for invalid event")
        void shouldThrowExceptionForInvalidEvent() {
            // Arrange
            UserEvent event = createValidPageViewEvent();
            doThrow(new IllegalArgumentException("Invalid event"))
                .when(eventValidator).validateEvent(event);
            
            // Act & Assert
            RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> eventCollectionService.processEvent(event)
            );
            assertTrue(exception.getMessage().contains("Event processing failed"));
        }
        
        @Test
        @DisplayName("Should continue processing even if Kinesis fails")
        void shouldContinueProcessingEvenIfKinesisFails() throws Exception {
            // Arrange
            UserEvent event = createValidPageViewEvent();
            
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{\"eventType\":\"page_view\"}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenThrow(new RuntimeException("Kinesis error"));
            
            // Act
            String eventId = eventCollectionService.processEvent(event);
            
            // Assert
            assertNotNull(eventId);
            verify(eventValidator).validateEvent(event);
        }
    }
    
    @Nested
    @DisplayName("Batch Event Processing Tests")
    class BatchEventProcessingTests {
        
        @Test
        @DisplayName("Should process batch of valid events")
        void shouldProcessBatchOfValidEvents() throws Exception {
            // Arrange
            List<UserEvent> events = Arrays.asList(
                createValidPageViewEvent(),
                createValidVideoEngagementEvent(),
                createValidFeatureInteractionEvent()
            );
            
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Act
            List<EventResponse> responses = eventCollectionService.processBatchEvents(events);
            
            // Assert
            assertEquals(3, responses.size());
            assertTrue(responses.stream().allMatch(r -> "success".equals(r.getStatus())));
            verify(eventValidator, times(3)).validateEvent(any(UserEvent.class));
        }
        
        @Test
        @DisplayName("Should handle mixed valid and invalid events in batch")
        void shouldHandleMixedValidAndInvalidEventsInBatch() throws Exception {
            // Arrange
            List<UserEvent> events = Arrays.asList(
                createValidPageViewEvent(),
                createValidVideoEngagementEvent()
            );
            
            doNothing().when(eventValidator).validateEvent(events.get(0));
            doThrow(new IllegalArgumentException("Invalid event"))
                .when(eventValidator).validateEvent(events.get(1));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Act
            List<EventResponse> responses = eventCollectionService.processBatchEvents(events);
            
            // Assert
            assertEquals(2, responses.size());
            assertEquals("success", responses.get(0).getStatus());
            assertEquals("error", responses.get(1).getStatus());
        }
    }
    
    @Nested
    @DisplayName("Event Enrichment Tests")
    class EventEnrichmentTests {
        
        @Test
        @DisplayName("Should enrich event with missing device info")
        void shouldEnrichEventWithMissingDeviceInfo() throws Exception {
            // Arrange
            UserEvent event = createValidPageViewEvent();
            event.setDeviceInfo(null);
            
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Act
            String eventId = eventCollectionService.processEvent(event);
            
            // Assert
            assertNotNull(eventId);
            // The enriched event should have device info added
            verify(eventValidator).validateEvent(argThat(e -> e.getDeviceInfo() != null));
        }
        
        @Test
        @DisplayName("Should detect struggle signals from repeated attempts")
        void shouldDetectStruggleSignalsFromRepeatedAttempts() throws Exception {
            // Arrange - First process a feature interaction
            UserEvent firstEvent = createValidFeatureInteractionEvent();
            firstEvent.getEventData().setFeature("document_upload");
            
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Process first event
            eventCollectionService.processEvent(firstEvent);
            
            // Now process second attempt at same feature
            UserEvent secondEvent = createValidFeatureInteractionEvent();
            secondEvent.getEventData().setFeature("document_upload");
            secondEvent.setTimestamp(System.currentTimeMillis() + 1000);
            
            // Act
            String eventId = eventCollectionService.processEvent(secondEvent);
            
            // Assert
            assertNotNull(eventId);
            // Should have detected struggle signal
            verify(eventValidator, times(2)).validateEvent(any(UserEvent.class));
        }
    }
    
    @Nested
    @DisplayName("User Insights Tests")
    class UserInsightsTests {
        
        @Test
        @DisplayName("Should generate user insights after processing events")
        void shouldGenerateUserInsightsAfterProcessingEvents() throws Exception {
            // Arrange
            UserEvent event = createValidPageViewEvent();
            
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Act
            eventCollectionService.processEvent(event);
            UserInsightsResponse insights = eventCollectionService.getUserInsights(event.getUserId());
            
            // Assert
            assertNotNull(insights);
            assertEquals(event.getUserId(), insights.getUserId());
            assertNotNull(insights.getBehaviorMetrics());
            assertNotNull(insights.getRiskScore());
        }
        
        @Test
        @DisplayName("Should return empty insights for unknown user")
        void shouldReturnEmptyInsightsForUnknownUser() {
            // Act
            UserInsightsResponse insights = eventCollectionService.getUserInsights("unknown_user");
            
            // Assert
            assertNotNull(insights);
            assertEquals("unknown_user", insights.getUserId());
        }
        
        @Test
        @DisplayName("Should calculate risk score based on struggle signals")
        void shouldCalculateRiskScoreBasedOnStruggleSignals() throws Exception {
            // Arrange - Create multiple struggle signals
            String userId = "test_user";
            
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Process multiple struggle signals
            for (int i = 0; i < 3; i++) {
                UserEvent struggleEvent = createValidStruggleSignalEvent();
                struggleEvent.setUserId(userId);
                struggleEvent.setTimestamp(System.currentTimeMillis() + i * 1000);
                eventCollectionService.processEvent(struggleEvent);
            }
            
            // Act
            UserInsightsResponse insights = eventCollectionService.getUserInsights(userId);
            
            // Assert
            assertNotNull(insights.getRiskScore());
            assertTrue(insights.getRiskScore() > 0);
            assertEquals("HIGH", insights.getRiskLevel());
        }
    }
    
    @Nested
    @DisplayName("Analytics Dashboard Tests")
    class AnalyticsDashboardTests {
        
        @Test
        @DisplayName("Should generate dashboard analytics")
        void shouldGenerateDashboardAnalytics() throws Exception {
            // Arrange
            doNothing().when(eventValidator).validateEvent(any(UserEvent.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
            when(kinesisClient.putRecord(any(PutRecordRequest.class)))
                .thenReturn(PutRecordResponse.builder().sequenceNumber("123").build());
            
            // Process some events
            eventCollectionService.processEvent(createValidPageViewEvent());
            eventCollectionService.processEvent(createValidVideoEngagementEvent());
            eventCollectionService.processEvent(createValidStruggleSignalEvent());
            
            // Act
            Map<String, Object> analytics = eventCollectionService.getDashboardAnalytics(24);
            
            // Assert
            assertNotNull(analytics);
            assertTrue(analytics.containsKey("totalEvents"));
            assertTrue(analytics.containsKey("activeUsers"));
            assertTrue(analytics.containsKey("struggleSignals"));
            assertTrue(analytics.containsKey("videoEngagements"));
            assertTrue(analytics.containsKey("eventTypeBreakdown"));
            assertTrue(analytics.containsKey("platformBreakdown"));
        }
    }
    
    // Helper methods
    private UserEvent createValidPageViewEvent() {
        UserEvent event = new UserEvent();
        event.setEventType("page_view");
        event.setUserId("test_user");
        event.setSessionId("test_session");
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
    
    private UserEvent createValidVideoEngagementEvent() {
        UserEvent event = createValidPageViewEvent();
        event.setEventType("video_engagement");
        
        UserEvent.EventData eventData = new UserEvent.EventData();
        eventData.setVideoId("video_123");
        eventData.setDuration(300);
        eventData.setWatchDuration(250);
        eventData.setCompletionRate(83.3);
        event.setEventData(eventData);
        
        return event;
    }
    
    private UserEvent createValidFeatureInteractionEvent() {
        UserEvent event = createValidPageViewEvent();
        event.setEventType("feature_interaction");
        
        UserEvent.EventData eventData = new UserEvent.EventData();
        eventData.setFeature("button_click");
        eventData.setAttemptCount(1);
        event.setEventData(eventData);
        
        return event;
    }
    
    private UserEvent createValidStruggleSignalEvent() {
        UserEvent event = createValidPageViewEvent();
        event.setEventType("struggle_signal");
        
        UserEvent.EventData eventData = new UserEvent.EventData();
        eventData.setFeature("form_submission");
        eventData.setAttemptCount(3);
        eventData.setErrorType("validation_error");
        event.setEventData(eventData);
        
        return event;
    }
    
    // Helper method to set private fields using reflection
    private void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("Failed to set field: " + fieldName, e);
        }
    }
}