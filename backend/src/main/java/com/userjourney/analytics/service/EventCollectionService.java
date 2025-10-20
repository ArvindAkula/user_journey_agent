package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.dto.EventResponse;
import com.userjourney.analytics.dto.UserInsightsResponse;
import com.userjourney.analytics.util.EventValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.PutRecordRequest;
import software.amazon.awssdk.services.kinesis.model.PutRecordResponse;
import software.amazon.awssdk.core.SdkBytes;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class EventCollectionService {
    
    private static final Logger logger = LoggerFactory.getLogger(EventCollectionService.class);
    
    @Autowired
    private EventValidator eventValidator;
    
    @Autowired
    private KinesisClient kinesisClient;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Autowired
    private BedrockAgentService bedrockAgentService;
    
    @Autowired
    private SageMakerPredictiveService sageMakerPredictiveService;
    
    @Autowired
    private FeatureEngineeringService featureEngineeringService;
    
    @Autowired
    private MonitoringService monitoringService;
    
    @org.springframework.beans.factory.annotation.Value("${aws.kinesis.stream-name}")
    private String kinesisStreamName;
    
    // In-memory storage for demo purposes (replace with DynamoDB in production)
    private final Map<String, List<UserEvent>> userEvents = new ConcurrentHashMap<>();
    private final Map<String, UserInsightsResponse> userInsights = new ConcurrentHashMap<>();
    
    /**
     * Process a single user event
     */
    public String processEvent(UserEvent event) {
        io.micrometer.core.instrument.Timer.Sample processingTimer = monitoringService.startDataProcessingTimer();
        
        try {
            if ("pricing_page_view".equals(event.getEventType())) {
                logger.info("🔄 [SERVICE] Processing pricing_page_view event for user: {}", event.getUserId());
            }
            
            // Validate the event
            eventValidator.validateEvent(event);
            
            // Enrich the event
            UserEvent enrichedEvent = enrichEvent(event);
            
            // Generate unique event ID
            String eventId = generateEventId(enrichedEvent);
            
            // Store event locally (for demo)
            storeEventLocally(enrichedEvent);
            
            if ("pricing_page_view".equals(event.getEventType())) {
                logger.info("🌊 [SERVICE] Sending pricing_page_view to Kinesis stream: {}", kinesisStreamName);
            }
            
            // Send to Kinesis for real-time processing
            sendToKinesis(enrichedEvent);
            
            if ("pricing_page_view".equals(event.getEventType())) {
                logger.info("✅ [SERVICE] pricing_page_view sent to Kinesis successfully");
            }
            
            // Update user insights
            updateUserInsights(enrichedEvent);
            
            // Record successful event processing
            monitoringService.incrementUserEventsProcessed(enrichedEvent.getEventType());
            monitoringService.recordDataProcessingTime(processingTimer);
            
            logger.info("Successfully processed event {} for user {}", eventId, event.getUserId());
            return eventId;
            
        } catch (Exception e) {
            // Record processing error
            monitoringService.recordDataProcessingTime(processingTimer);
            
            if ("pricing_page_view".equals(event.getEventType())) {
                logger.error("❌ [SERVICE] Failed to process pricing_page_view event: {}", e.getMessage(), e);
            }
            
            logger.error("Failed to process event for user {}: {}", event.getUserId(), e.getMessage(), e);
            throw new RuntimeException("Event processing failed", e);
        }
    }
    
    /**
     * Process multiple events in batch
     */
    public List<EventResponse> processBatchEvents(List<UserEvent> events) {
        List<EventResponse> responses = new ArrayList<>();
        
        for (UserEvent event : events) {
            try {
                String eventId = processEvent(event);
                responses.add(new EventResponse(eventId, "Event processed successfully", System.currentTimeMillis()));
            } catch (Exception e) {
                responses.add(new EventResponse(null, "Failed to process event: " + e.getMessage(), System.currentTimeMillis()));
            }
        }
        
        return responses;
    }
    
    /**
     * Enrich event with additional context and metadata
     */
    private UserEvent enrichEvent(UserEvent event) {
        UserEvent enrichedEvent = new UserEvent();
        
        // Copy original event data
        enrichedEvent.setEventType(event.getEventType());
        enrichedEvent.setUserId(event.getUserId());
        enrichedEvent.setSessionId(event.getSessionId());
        enrichedEvent.setTimestamp(event.getTimestamp() != null ? event.getTimestamp() : System.currentTimeMillis());
        
        // Enrich device info
        UserEvent.DeviceInfo deviceInfo = event.getDeviceInfo();
        if (deviceInfo == null) {
            deviceInfo = new UserEvent.DeviceInfo();
            deviceInfo.setPlatform("Web");
            deviceInfo.setAppVersion("1.0.0");
            deviceInfo.setDeviceModel("Unknown");
        }
        enrichedEvent.setDeviceInfo(deviceInfo);
        
        // Enrich user context
        UserEvent.UserContext userContext = event.getUserContext();
        if (userContext == null) {
            userContext = new UserEvent.UserContext();
            userContext.setUserSegment(determineUserSegment(event.getUserId()));
            userContext.setSessionStage(determineSessionStage(event.getSessionId()));
            userContext.setPreviousActions(getPreviousActions(event.getUserId(), 5));
        }
        enrichedEvent.setUserContext(userContext);
        
        // Enrich event data
        UserEvent.EventData eventData = event.getEventData();
        if (eventData == null) {
            eventData = new UserEvent.EventData();
        }
        
        // Add derived metrics based on event type
        if ("video_engagement".equals(event.getEventType()) && eventData.getWatchDuration() != null && eventData.getDuration() != null) {
            double completionRate = (double) eventData.getWatchDuration() / eventData.getDuration() * 100;
            eventData.setCompletionRate(completionRate);
            
            // Record high video engagement
            if (completionRate > 80.0) {
                monitoringService.incrementHighVideoEngagement(eventData.getVideoId(), completionRate);
            }
        }
        
        // Detect struggle signals
        if (isStruggleSignal(event)) {
            enrichedEvent.setEventType("struggle_signal");
            if (eventData.getAttemptCount() == null) {
                eventData.setAttemptCount(getAttemptCount(event.getUserId(), eventData.getFeature()));
            }
            
            // Record struggle signal detection
            monitoringService.incrementStruggleSignalsDetected(eventData.getFeature(), 
                eventData.getAttemptCount() != null ? eventData.getAttemptCount() : 1);
        }
        
        enrichedEvent.setEventData(eventData);
        
        return enrichedEvent;
    }
    
    /**
     * Determine user segment based on behavior history
     */
    private String determineUserSegment(String userId) {
        List<UserEvent> events = userEvents.getOrDefault(userId, new ArrayList<>());
        
        if (events.isEmpty()) {
            return "new_user";
        }
        
        long sessionCount = events.stream()
            .map(UserEvent::getSessionId)
            .distinct()
            .count();
            
        if (sessionCount == 1) {
            return "new_user";
        } else if (sessionCount <= 5) {
            return "active_user";
        } else {
            return "engaged_user";
        }
    }
    
    /**
     * Determine session stage based on session duration and events
     */
    private String determineSessionStage(String sessionId) {
        // Simple logic - in production, this would be more sophisticated
        return "exploration";
    }
    
    /**
     * Get previous actions for context
     */
    private List<String> getPreviousActions(String userId, int limit) {
        List<UserEvent> events = userEvents.getOrDefault(userId, new ArrayList<>());
        
        return events.stream()
            .sorted((e1, e2) -> Long.compare(e2.getTimestamp(), e1.getTimestamp()))
            .limit(limit)
            .map(event -> event.getEventType() + ":" + 
                (event.getEventData().getFeature() != null ? event.getEventData().getFeature() : 
                 event.getEventData().getVideoId() != null ? event.getEventData().getVideoId() : "unknown"))
            .collect(Collectors.toList());
    }
    
    /**
     * Check if event indicates a struggle signal
     */
    private boolean isStruggleSignal(UserEvent event) {
        if (!"feature_interaction".equals(event.getEventType())) {
            return false;
        }
        
        UserEvent.EventData eventData = event.getEventData();
        if (eventData == null || eventData.getFeature() == null) {
            return false;
        }
        
        // Check for repeated attempts
        int attemptCount = getAttemptCount(event.getUserId(), eventData.getFeature());
        return attemptCount >= 2;
    }
    
    /**
     * Get attempt count for a specific feature
     */
    private int getAttemptCount(String userId, String feature) {
        if (feature == null) return 1;
        
        List<UserEvent> events = userEvents.getOrDefault(userId, new ArrayList<>());
        
        // Count recent attempts (last 5 minutes)
        long fiveMinutesAgo = System.currentTimeMillis() - (5 * 60 * 1000);
        
        return (int) events.stream()
            .filter(event -> event.getTimestamp() > fiveMinutesAgo)
            .filter(event -> "feature_interaction".equals(event.getEventType()) || "struggle_signal".equals(event.getEventType()))
            .filter(event -> feature.equals(event.getEventData().getFeature()))
            .count() + 1;
    }
    
    /**
     * Generate unique event ID
     */
    private String generateEventId(UserEvent event) {
        return String.format("evt_%s_%s_%d", 
            event.getUserId().substring(0, Math.min(8, event.getUserId().length())),
            event.getEventType(),
            System.currentTimeMillis());
    }
    
    /**
     * Store event locally for demo purposes
     */
    private void storeEventLocally(UserEvent event) {
        userEvents.computeIfAbsent(event.getUserId(), k -> new ArrayList<>()).add(event);
        
        // Keep only last 1000 events per user
        List<UserEvent> events = userEvents.get(event.getUserId());
        if (events.size() > 1000) {
            events.subList(0, events.size() - 1000).clear();
        }
    }
    
    /**
     * Send event to Kinesis for real-time processing
     */
    private void sendToKinesis(UserEvent event) {
        try {
            String eventJson = objectMapper.writeValueAsString(event);
            
            logger.info("🌊 [KINESIS] Sending event to stream: {} for user: {}", kinesisStreamName, event.getUserId());
            
            PutRecordRequest request = PutRecordRequest.builder()
                .streamName(kinesisStreamName)
                .partitionKey(event.getUserId())
                .data(SdkBytes.fromUtf8String(eventJson))
                .build();
                
            PutRecordResponse response = kinesisClient.putRecord(request);
            logger.info("✅ [KINESIS] Event sent successfully. Sequence: {}, Shard: {}", 
                response.sequenceNumber(), response.shardId());
            
        } catch (Exception e) {
            logger.error("❌ [KINESIS] Failed to send event to stream {}: {}", kinesisStreamName, e.getMessage(), e);
            // Don't throw exception - continue processing even if Kinesis fails
        }
    }
    
    /**
     * Update user insights based on new event
     */
    private void updateUserInsights(UserEvent event) {
        UserInsightsResponse insights = userInsights.computeIfAbsent(
            event.getUserId(), 
            k -> new UserInsightsResponse(k)
        );
        
        // Update basic info
        insights.setUserSegment(event.getUserContext().getUserSegment());
        insights.setLastUpdated(System.currentTimeMillis());
        
        // Calculate behavior metrics
        List<UserEvent> userEventList = userEvents.getOrDefault(event.getUserId(), new ArrayList<>());
        UserInsightsResponse.BehaviorMetrics metrics = calculateBehaviorMetrics(userEventList);
        insights.setBehaviorMetrics(metrics);
        
        // Calculate risk score using both rule-based and ML approaches
        double ruleBasedRiskScore = calculateRiskScore(userEventList);
        insights.setRiskScore(ruleBasedRiskScore);
        insights.setRiskLevel(categorizeRiskLevel(ruleBasedRiskScore));
        
        // Update struggle signals
        List<UserInsightsResponse.StruggleSignal> struggles = extractStruggleSignals(userEventList);
        insights.setStruggleSignals(struggles);
        
        // Invoke ML-based exit risk prediction asynchronously
        invokeMlExitRiskPrediction(event.getUserId(), userEventList, insights);
        
        // Invoke Bedrock Agent for struggle analysis if needed
        if ("struggle_signal".equals(event.getEventType())) {
            invokeBedrockAgentForStruggle(event, insights);
        }
        
        // Generate recommendations
        List<String> recommendations = generateRecommendations(insights);
        insights.setRecommendations(recommendations);
    }
    
    /**
     * Invoke ML-based exit risk prediction asynchronously
     */
    private void invokeMlExitRiskPrediction(String userId, List<UserEvent> userEventList, UserInsightsResponse insights) {
        try {
            // Extract features for ML prediction
            com.userjourney.analytics.model.ExitRiskFeatures features = featureEngineeringService.extractExitRiskFeatures(
                userId, userEventList, null
            );
            
            // Record SageMaker invocation
            monitoringService.incrementSagemakerPredictions();
            
            // Invoke SageMaker prediction asynchronously
            sageMakerPredictiveService.predictExitRiskAsync(features)
                .thenAccept(predictionResult -> {
                    if (!predictionResult.hasError()) {
                        // Update insights with ML prediction
                        updateInsightsWithMlPrediction(insights, predictionResult);
                        
                        logger.info("ML exit risk prediction for user {}: score={}, level={}", 
                            userId, predictionResult.getRiskScore(), predictionResult.getRiskLevel());
                        
                        // Trigger interventions based on ML prediction if high risk
                        if ("HIGH".equals(predictionResult.getRiskLevel()) && predictionResult.getRiskScore() > 70) {
                            triggerHighRiskIntervention(userId, predictionResult);
                        }
                    } else {
                        logger.warn("ML prediction failed for user {}: {}", userId, predictionResult.getErrorMessage());
                        monitoringService.incrementAiServiceErrors("sagemaker", "prediction_failed");
                    }
                })
                .exceptionally(throwable -> {
                    logger.error("Async ML prediction failed for user {}: {}", userId, throwable.getMessage());
                    monitoringService.incrementAiServiceErrors("sagemaker", "async_error");
                    return null;
                });
                
        } catch (Exception e) {
            logger.error("Error invoking ML exit risk prediction for user {}: {}", userId, e.getMessage(), e);
        }
    }
    
    /**
     * Update insights with ML prediction results
     */
    private void updateInsightsWithMlPrediction(UserInsightsResponse insights, SageMakerPredictiveService.PredictionResult predictionResult) {
        try {
            // Update risk score with ML prediction (weighted average with rule-based score)
            Double currentRiskScore = insights.getRiskScore();
            double mlRiskScore = predictionResult.getRiskScore();
            
            // Combine rule-based and ML scores (70% ML, 30% rule-based)
            double combinedScore = (mlRiskScore * 0.7) + (currentRiskScore != null ? currentRiskScore * 0.3 : 0);
            insights.setRiskScore(combinedScore);
            insights.setRiskLevel(categorizeRiskLevel(combinedScore));
            
            // Add ML recommendations to existing ones
            List<String> currentRecommendations = insights.getRecommendations();
            if (currentRecommendations == null) {
                currentRecommendations = new ArrayList<>();
            }
            
            // Add ML-generated recommendations
            List<String> mlRecommendations = predictionResult.getRecommendations();
            for (String recommendation : mlRecommendations) {
                currentRecommendations.add("ML Insight: " + recommendation);
            }
            
            insights.setRecommendations(currentRecommendations);
            
        } catch (Exception e) {
            logger.error("Error updating insights with ML prediction: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Trigger high-risk intervention based on ML prediction
     */
    private void triggerHighRiskIntervention(String userId, SageMakerPredictiveService.PredictionResult predictionResult) {
        try {
            logger.warn("High exit risk detected for user {} (score: {}), triggering intervention", 
                userId, predictionResult.getRiskScore());
            
            // Create intervention event
            UserEvent interventionEvent = new UserEvent();
            interventionEvent.setEventType("intervention_triggered");
            interventionEvent.setUserId(userId);
            interventionEvent.setSessionId("system_intervention_" + System.currentTimeMillis());
            interventionEvent.setTimestamp(System.currentTimeMillis());
            
            UserEvent.EventData eventData = new UserEvent.EventData();
            eventData.setFeature("exit_risk_intervention");
            interventionEvent.setEventData(eventData);
            
            UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
            deviceInfo.setPlatform("System");
            deviceInfo.setAppVersion("1.0.0");
            deviceInfo.setDeviceModel("ML_Predictor");
            interventionEvent.setDeviceInfo(deviceInfo);
            
            UserEvent.UserContext userContext = new UserEvent.UserContext();
            userContext.setUserSegment("at_risk");
            userContext.setSessionStage("intervention");
            userContext.setPreviousActions(Arrays.asList("high_exit_risk_detected"));
            interventionEvent.setUserContext(userContext);
            
            // Send intervention event to Kinesis for processing
            sendToKinesis(interventionEvent);
            
            // Record intervention execution
            monitoringService.incrementInterventionsExecuted("exit_risk_intervention");
            
            // TODO: Integrate with notification services (SNS, SES, etc.)
            // This would trigger actual interventions like emails, push notifications, etc.
            
        } catch (Exception e) {
            logger.error("Error triggering high-risk intervention for user {}: {}", userId, e.getMessage(), e);
        }
    }
    
    /**
     * Invoke Bedrock Agent for struggle signal analysis
     */
    private void invokeBedrockAgentForStruggle(UserEvent event, UserInsightsResponse insights) {
        try {
            // Create struggle signal from event
            com.userjourney.analytics.model.StruggleSignal struggleSignal = createStruggleSignalFromEvent(event);
            
            // Create user profile from insights
            com.userjourney.analytics.model.UserProfile userProfile = createUserProfileFromInsights(event.getUserId(), insights);
            
            // Record Bedrock invocation
            monitoringService.incrementBedrockInvocations("claude-3-sonnet");
            
            // Invoke Bedrock Agent asynchronously
            BedrockAgentService.AgentResponse response;
            try {
                response = bedrockAgentService.analyzeStruggleSignal(struggleSignal, userProfile);
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                logger.error("Failed to serialize request for Bedrock Agent", e);
                throw new RuntimeException("Failed to analyze struggle signal", e);
            }
            
            if (response.isSuccess()) {
                logger.info("Bedrock Agent analysis completed for user {}: {}", event.getUserId(), response.getResponseText());
                
                // Update insights with AI recommendations
                updateInsightsWithAgentResponse(insights, response);
            } else {
                logger.warn("Bedrock Agent analysis failed for user {}: {}", event.getUserId(), response.getErrorMessage());
                monitoringService.incrementAiServiceErrors("bedrock", "analysis_failed");
            }
            
        } catch (Exception e) {
            logger.error("Error invoking Bedrock Agent for struggle analysis: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Create StruggleSignal model from UserEvent
     */
    private com.userjourney.analytics.model.StruggleSignal createStruggleSignalFromEvent(UserEvent event) {
        com.userjourney.analytics.model.StruggleSignal signal = new com.userjourney.analytics.model.StruggleSignal();
        
        signal.setUserId(event.getUserId());
        signal.setFeatureId(event.getEventData().getFeature());
        signal.setDetectedAt(java.time.Instant.ofEpochMilli(event.getTimestamp()));
        signal.setSignalType("repeated_attempts");
        
        // Determine severity based on attempt count
        Integer attemptCount = event.getEventData().getAttemptCount();
        if (attemptCount != null) {
            if (attemptCount >= 5) {
                signal.setSeverity("critical");
            } else if (attemptCount >= 3) {
                signal.setSeverity("high");
            } else if (attemptCount >= 2) {
                signal.setSeverity("medium");
            } else {
                signal.setSeverity("low");
            }
        } else {
            signal.setSeverity("low");
        }
        
        // Create context
        com.userjourney.analytics.model.StruggleSignal.Context context = new com.userjourney.analytics.model.StruggleSignal.Context();
        context.setAttemptCount(attemptCount != null ? attemptCount : 1);
        context.setTimeSpent(event.getEventData().getDuration() != null ? event.getEventData().getDuration() : 0);
        context.setUserActions(event.getUserContext().getPreviousActions());
        signal.setContext(context);
        
        signal.setInterventionTriggered(false);
        signal.setResolved(false);
        
        return signal;
    }
    
    /**
     * Create UserProfile model from insights
     */
    private com.userjourney.analytics.model.UserProfile createUserProfileFromInsights(String userId, UserInsightsResponse insights) {
        com.userjourney.analytics.model.UserProfile profile = new com.userjourney.analytics.model.UserProfile();
        
        profile.setUserId(userId);
        profile.setCreatedAt(java.time.Instant.now());
        profile.setLastActiveAt(java.time.Instant.ofEpochMilli(insights.getLastUpdated()));
        profile.setUserSegment(insights.getUserSegment());
        
        // Create preferences
        com.userjourney.analytics.model.UserProfile.Preferences preferences = new com.userjourney.analytics.model.UserProfile.Preferences();
        preferences.setContentCategories(new ArrayList<>());
        preferences.setVideoTopics(new ArrayList<>());
        preferences.setPreferredInteractionStyle("self_service");
        profile.setPreferences(preferences);
        
        // Create behavior metrics
        if (insights.getBehaviorMetrics() != null) {
            com.userjourney.analytics.model.UserProfile.BehaviorMetrics behaviorMetrics = new com.userjourney.analytics.model.UserProfile.BehaviorMetrics();
            behaviorMetrics.setTotalSessions(insights.getBehaviorMetrics().getTotalSessions() != null ? insights.getBehaviorMetrics().getTotalSessions() : 0);
            behaviorMetrics.setAvgSessionDuration(insights.getBehaviorMetrics().getAvgSessionDuration() != null ? insights.getBehaviorMetrics().getAvgSessionDuration() : 0.0);
            behaviorMetrics.setFeatureAdoptionRate(insights.getBehaviorMetrics().getFeatureAdoptionRate() != null ? insights.getBehaviorMetrics().getFeatureAdoptionRate() : 0.0);
            behaviorMetrics.setSupportInteractionCount(0);
            profile.setBehaviorMetrics(behaviorMetrics);
        }
        
        // Create risk factors
        com.userjourney.analytics.model.UserProfile.RiskFactors riskFactors = new com.userjourney.analytics.model.UserProfile.RiskFactors();
        riskFactors.setExitRiskScore(insights.getRiskScore() != null ? insights.getRiskScore() : 0.0);
        riskFactors.setLastRiskAssessment(java.time.Instant.now());
        riskFactors.setRiskContributors(new ArrayList<>());
        profile.setRiskFactors(riskFactors);
        
        profile.setInterventionHistory(new ArrayList<>());
        
        return profile;
    }
    
    /**
     * Update insights with Bedrock Agent response
     */
    private void updateInsightsWithAgentResponse(UserInsightsResponse insights, BedrockAgentService.AgentResponse response) {
        try {
            // Parse agent response and extract recommendations
            String responseText = response.getResponseText();
            
            // Add AI-generated recommendations to existing ones
            List<String> currentRecommendations = insights.getRecommendations();
            if (currentRecommendations == null) {
                currentRecommendations = new ArrayList<>();
            }
            
            // Add a marker for AI-generated recommendations
            currentRecommendations.add("AI Analysis: " + responseText.substring(0, Math.min(200, responseText.length())));
            
            insights.setRecommendations(currentRecommendations);
            
        } catch (Exception e) {
            logger.error("Error updating insights with agent response: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Calculate behavior metrics from user events
     */
    private UserInsightsResponse.BehaviorMetrics calculateBehaviorMetrics(List<UserEvent> events) {
        UserInsightsResponse.BehaviorMetrics metrics = new UserInsightsResponse.BehaviorMetrics();
        
        if (events.isEmpty()) {
            return metrics;
        }
        
        // Calculate session count
        int sessionCount = (int) events.stream()
            .map(UserEvent::getSessionId)
            .distinct()
            .count();
        metrics.setTotalSessions(sessionCount);
        
        // Calculate average session duration (simplified)
        double avgDuration = events.stream()
            .collect(Collectors.groupingBy(UserEvent::getSessionId))
            .values()
            .stream()
            .mapToLong(sessionEvents -> {
                if (sessionEvents.size() < 2) return 0;
                long start = sessionEvents.stream().mapToLong(UserEvent::getTimestamp).min().orElse(0);
                long end = sessionEvents.stream().mapToLong(UserEvent::getTimestamp).max().orElse(0);
                return end - start;
            })
            .average()
            .orElse(0.0);
        metrics.setAvgSessionDuration(avgDuration / 1000.0); // Convert to seconds
        
        // Calculate feature adoption rate
        long uniqueFeatures = events.stream()
            .filter(e -> e.getEventData().getFeature() != null)
            .map(e -> e.getEventData().getFeature())
            .distinct()
            .count();
        metrics.setFeatureAdoptionRate(uniqueFeatures > 0 ? Math.min(100.0, uniqueFeatures * 10) : 0.0);
        
        // Calculate video engagement score
        double videoScore = events.stream()
            .filter(e -> "video_engagement".equals(e.getEventType()))
            .filter(e -> e.getEventData().getCompletionRate() != null)
            .mapToDouble(e -> e.getEventData().getCompletionRate())
            .average()
            .orElse(0.0);
        metrics.setVideoEngagementScore(videoScore);
        
        // Count struggle signals
        int struggleCount = (int) events.stream()
            .filter(e -> "struggle_signal".equals(e.getEventType()))
            .count();
        metrics.setStruggleSignalCount(struggleCount);
        
        return metrics;
    }
    
    /**
     * Calculate user exit risk score
     */
    private double calculateRiskScore(List<UserEvent> events) {
        if (events.isEmpty()) return 0.0;
        
        double riskScore = 0.0;
        
        // Factor 1: Struggle signals (0-40 points)
        long struggleCount = events.stream()
            .filter(e -> "struggle_signal".equals(e.getEventType()))
            .count();
        riskScore += Math.min(40, struggleCount * 10);
        
        // Factor 2: Session frequency (0-30 points)
        long daysSinceLastEvent = (System.currentTimeMillis() - 
            events.stream().mapToLong(UserEvent::getTimestamp).max().orElse(0)) / (24 * 60 * 60 * 1000);
        if (daysSinceLastEvent > 7) riskScore += 30;
        else if (daysSinceLastEvent > 3) riskScore += 20;
        else if (daysSinceLastEvent > 1) riskScore += 10;
        
        // Factor 3: Video engagement (0-30 points - inverse)
        double avgVideoCompletion = events.stream()
            .filter(e -> "video_engagement".equals(e.getEventType()))
            .filter(e -> e.getEventData().getCompletionRate() != null)
            .mapToDouble(e -> e.getEventData().getCompletionRate())
            .average()
            .orElse(50.0);
        riskScore += Math.max(0, 30 - (avgVideoCompletion * 0.3));
        
        return Math.min(100.0, riskScore);
    }
    
    /**
     * Categorize risk level based on score
     */
    private String categorizeRiskLevel(double score) {
        if (score < 30) return "LOW";
        if (score < 60) return "MEDIUM";
        return "HIGH";
    }
    
    /**
     * Extract struggle signals from events
     */
    private List<UserInsightsResponse.StruggleSignal> extractStruggleSignals(List<UserEvent> events) {
        Map<String, UserInsightsResponse.StruggleSignal> signalMap = new HashMap<>();
        
        events.stream()
            .filter(e -> "struggle_signal".equals(e.getEventType()))
            .forEach(event -> {
                String feature = event.getEventData().getFeature();
                if (feature != null) {
                    UserInsightsResponse.StruggleSignal signal = signalMap.computeIfAbsent(
                        feature,
                        k -> new UserInsightsResponse.StruggleSignal(k, 0, "low", event.getTimestamp())
                    );
                    
                    signal.setAttemptCount(signal.getAttemptCount() + 1);
                    signal.setLastOccurrence(Math.max(signal.getLastOccurrence(), event.getTimestamp()));
                    
                    // Determine severity based on attempt count
                    if (signal.getAttemptCount() >= 5) {
                        signal.setSeverity("critical");
                    } else if (signal.getAttemptCount() >= 3) {
                        signal.setSeverity("high");
                    } else if (signal.getAttemptCount() >= 2) {
                        signal.setSeverity("medium");
                    }
                }
            });
        
        return new ArrayList<>(signalMap.values());
    }
    
    /**
     * Generate recommendations based on user insights
     */
    private List<String> generateRecommendations(UserInsightsResponse insights) {
        List<String> recommendations = new ArrayList<>();
        
        if (insights.getRiskScore() != null && insights.getRiskScore() > 60) {
            recommendations.add("High exit risk detected - consider immediate intervention");
        }
        
        if (insights.getBehaviorMetrics() != null) {
            UserInsightsResponse.BehaviorMetrics metrics = insights.getBehaviorMetrics();
            
            if (metrics.getVideoEngagementScore() != null && metrics.getVideoEngagementScore() < 30) {
                recommendations.add("Low video engagement - recommend shorter or more interactive content");
            }
            
            if (metrics.getStruggleSignalCount() != null && metrics.getStruggleSignalCount() > 3) {
                recommendations.add("Multiple struggle signals detected - provide additional support");
            }
            
            if (metrics.getFeatureAdoptionRate() != null && metrics.getFeatureAdoptionRate() < 20) {
                recommendations.add("Low feature adoption - consider guided onboarding");
            }
        }
        
        if (recommendations.isEmpty()) {
            recommendations.add("User engagement is healthy - continue current experience");
        }
        
        return recommendations;
    }
    
    /**
     * Get user insights
     */
    public UserInsightsResponse getUserInsights(String userId) {
        return userInsights.getOrDefault(userId, new UserInsightsResponse(userId));
    }
    
    /**
     * Get user event history
     */
    public List<UserEvent> getUserEventHistory(String userId, int limit, Long startTime, Long endTime) {
        List<UserEvent> events = userEvents.getOrDefault(userId, new ArrayList<>());
        
        return events.stream()
            .filter(event -> startTime == null || event.getTimestamp() >= startTime)
            .filter(event -> endTime == null || event.getTimestamp() <= endTime)
            .sorted((e1, e2) -> Long.compare(e2.getTimestamp(), e1.getTimestamp()))
            .limit(limit)
            .collect(Collectors.toList());
    }
    
    /**
     * Get user struggle signals
     */
    public List<Map<String, Object>> getUserStruggleSignals(String userId) {
        List<UserEvent> events = userEvents.getOrDefault(userId, new ArrayList<>());
        
        return events.stream()
            .filter(e -> "struggle_signal".equals(e.getEventType()))
            .map(event -> {
                Map<String, Object> signal = new HashMap<>();
                signal.put("feature", event.getEventData().getFeature());
                signal.put("timestamp", event.getTimestamp());
                signal.put("attemptCount", event.getEventData().getAttemptCount());
                signal.put("errorType", event.getEventData().getErrorType());
                return signal;
            })
            .collect(Collectors.toList());
    }
    
    /**
     * Get dashboard analytics
     */
    public Map<String, Object> getDashboardAnalytics(int hours) {
        Map<String, Object> analytics = new HashMap<>();
        
        long cutoffTime = System.currentTimeMillis() - (hours * 60 * 60 * 1000L);
        
        // Aggregate data from all users
        List<UserEvent> recentEvents = userEvents.values().stream()
            .flatMap(List::stream)
            .filter(event -> event.getTimestamp() > cutoffTime)
            .collect(Collectors.toList());
        
        analytics.put("totalEvents", recentEvents.size());
        analytics.put("activeUsers", recentEvents.stream().map(UserEvent::getUserId).distinct().count());
        analytics.put("struggleSignals", recentEvents.stream().filter(e -> "struggle_signal".equals(e.getEventType())).count());
        analytics.put("videoEngagements", recentEvents.stream().filter(e -> "video_engagement".equals(e.getEventType())).count());
        
        // Event type breakdown
        Map<String, Long> eventTypeBreakdown = recentEvents.stream()
            .collect(Collectors.groupingBy(UserEvent::getEventType, Collectors.counting()));
        analytics.put("eventTypeBreakdown", eventTypeBreakdown);
        
        // Platform breakdown
        Map<String, Long> platformBreakdown = recentEvents.stream()
            .collect(Collectors.groupingBy(e -> e.getDeviceInfo().getPlatform(), Collectors.counting()));
        analytics.put("platformBreakdown", platformBreakdown);
        
        analytics.put("timestamp", System.currentTimeMillis());
        
        return analytics;
    }
}