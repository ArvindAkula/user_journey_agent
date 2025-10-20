package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.model.StruggleSignal;
import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.model.UserProfile;
import com.userjourney.analytics.model.UserProfile.BehaviorMetrics;
import com.userjourney.analytics.resilience.CircuitBreaker;
import com.userjourney.analytics.resilience.ErrorHandlingService;
import com.userjourney.analytics.resilience.RetryHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.*;
import software.amazon.awssdk.core.SdkBytes;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class BedrockAgentService {
    
    private static final Logger logger = LoggerFactory.getLogger(BedrockAgentService.class);
    private static final String SERVICE_NAME = "BedrockAgent";
    
    @Autowired
    private BedrockRuntimeClient bedrockRuntimeClient;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Autowired
    private CircuitBreaker circuitBreaker;
    
    @Autowired
    private RetryHandler retryHandler;
    
    @Autowired
    private ErrorHandlingService errorHandlingService;
    
    @Value("${bedrock.agent.id:user-journey-orchestrator}")
    private String agentId;
    
    @Value("${bedrock.agent.alias.id:TSTALIASID}")
    private String agentAliasId;
    
    /**
     * Invoke Bedrock for struggle signal analysis and intervention
     */
    public AgentResponse analyzeStruggleSignal(StruggleSignal struggleSignal, UserProfile userProfile) throws com.fasterxml.jackson.core.JsonProcessingException {
        String operationName = "analyzeStruggleSignal";
        
        // Use circuit breaker and retry logic
        return circuitBreaker.execute(
            SERVICE_NAME + ":" + operationName,
            () -> retryHandler.executeWithRetry(
                operationName,
                () -> performStruggleAnalysis(struggleSignal, userProfile),
                createRetryConfig()
            ),
            () -> {
                // Fallback when circuit is open
                AgentResponse fallback = createFallbackResponse("circuit_breaker_open", 
                    "Bedrock service temporarily unavailable");
                errorHandlingService.handleAIServiceError(SERVICE_NAME, 
                    new RuntimeException("Circuit breaker open"), fallback);
                return fallback;
            }
        );
    }
    
    private AgentResponse performStruggleAnalysis(StruggleSignal struggleSignal, UserProfile userProfile) {
        try {
            String inputText = createStruggleAnalysisPrompt(struggleSignal, userProfile);
            
            // Amazon Nova uses Converse API format
            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", java.util.List.of(Map.of("text", inputText)));
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("messages", java.util.List.of(message));
            requestBody.put("inferenceConfig", Map.of(
                "maxTokens", 1000,
                "temperature", 0.3
            ));
            
            String jsonRequest;
            try {
                jsonRequest = objectMapper.writeValueAsString(requestBody);
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                logger.error("Failed to serialize request body", e);
                throw new RuntimeException("Failed to serialize request", e);
            }
            
            InvokeModelRequest request = InvokeModelRequest.builder()
                    .modelId("amazon.nova-micro-v1:0")
                    .body(SdkBytes.fromUtf8String(jsonRequest))
                    .build();
            
            InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);
            String responseBody = response.body().asUtf8String();
            
            return processModelResponse(responseBody);
            
        } catch (Exception e) {
            errorHandlingService.handleError(SERVICE_NAME, "analyzeStruggleSignal", e, 
                Map.of("userId", struggleSignal.getUserId(), "featureId", struggleSignal.getFeatureId()));
            throw e;
        }
    }
    
    /**
     * Invoke Bedrock for user journey orchestration
     */
    public AgentResponse orchestrateUserJourney(UserEvent userEvent, UserProfile userProfile) throws com.fasterxml.jackson.core.JsonProcessingException {
        String operationName = "orchestrateUserJourney";
        
        return circuitBreaker.execute(
            SERVICE_NAME + ":" + operationName,
            () -> retryHandler.executeWithRetry(
                operationName,
                () -> performJourneyOrchestration(userEvent, userProfile),
                createRetryConfig()
            ),
            () -> {
                AgentResponse fallback = createFallbackResponse("circuit_breaker_open", 
                    "Bedrock service temporarily unavailable");
                errorHandlingService.handleAIServiceError(SERVICE_NAME, 
                    new RuntimeException("Circuit breaker open"), fallback);
                return fallback;
            }
        );
    }
    
    private AgentResponse performJourneyOrchestration(UserEvent userEvent, UserProfile userProfile) {
        try {
            String inputText = createJourneyOrchestrationPrompt(userEvent, userProfile);
            
            // Amazon Nova uses Converse API format
            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", java.util.List.of(Map.of("text", inputText)));
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("messages", java.util.List.of(message));
            requestBody.put("inferenceConfig", Map.of(
                "maxTokens", 1000,
                "temperature", 0.3
            ));
            
            String jsonRequest;
            try {
                jsonRequest = objectMapper.writeValueAsString(requestBody);
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                logger.error("Failed to serialize request body", e);
                throw new RuntimeException("Failed to serialize request", e);
            }
            
            InvokeModelRequest request = InvokeModelRequest.builder()
                    .modelId("amazon.nova-micro-v1:0")
                    .body(SdkBytes.fromUtf8String(jsonRequest))
                    .build();
            
            InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);
            String responseBody = response.body().asUtf8String();
            
            return processModelResponse(responseBody);
            
        } catch (Exception e) {
            errorHandlingService.handleError(SERVICE_NAME, "orchestrateUserJourney", e, 
                Map.of("userId", userEvent.getUserId(), "eventType", userEvent.getEventType()));
            throw e;
        }
    }
    
    /**
     * Invoke Bedrock for predictive analysis
     */
    public AgentResponse predictUserBehavior(UserProfile userProfile, String predictionType) throws com.fasterxml.jackson.core.JsonProcessingException {
        String operationName = "predictUserBehavior";
        
        return circuitBreaker.execute(
            SERVICE_NAME + ":" + operationName,
            () -> retryHandler.executeWithRetry(
                operationName,
                () -> performPredictiveAnalysis(userProfile, predictionType),
                createRetryConfig()
            ),
            () -> {
                AgentResponse fallback = createFallbackResponse("circuit_breaker_open", 
                    "Bedrock service temporarily unavailable");
                errorHandlingService.handleAIServiceError(SERVICE_NAME, 
                    new RuntimeException("Circuit breaker open"), fallback);
                return fallback;
            }
        );
    }
    
    private AgentResponse performPredictiveAnalysis(UserProfile userProfile, String predictionType) {
        try {
            String inputText = createPredictionPrompt(userProfile, predictionType);
            
            // Amazon Nova uses Converse API format
            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", java.util.List.of(Map.of("text", inputText)));
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("messages", java.util.List.of(message));
            requestBody.put("inferenceConfig", Map.of(
                "maxTokens", 1000,
                "temperature", 0.3
            ));
            
            String jsonRequest;
            try {
                jsonRequest = objectMapper.writeValueAsString(requestBody);
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                logger.error("Failed to serialize request body", e);
                throw new RuntimeException("Failed to serialize request", e);
            }
            
            InvokeModelRequest request = InvokeModelRequest.builder()
                    .modelId("amazon.nova-micro-v1:0")
                    .body(SdkBytes.fromUtf8String(jsonRequest))
                    .build();
            
            InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);
            String responseBody = response.body().asUtf8String();
            
            return processModelResponse(responseBody);
            
        } catch (Exception e) {
            errorHandlingService.handleError(SERVICE_NAME, "predictUserBehavior", e, 
                Map.of("userId", userProfile.getUserId(), "predictionType", predictionType));
            throw e;
        }
    }
    
    /**
     * Create retry configuration for Bedrock operations
     */
    private RetryHandler.RetryConfig createRetryConfig() {
        return RetryHandler.RetryConfig.builder()
            .maxAttempts(3)
            .initialDelay(Duration.ofMillis(500))
            .backoffMultiplier(2.0)
            .maxDelay(Duration.ofSeconds(10))
            .jitterFactor(0.1)
            .retryIf(this::isRetryableException)
            .build();
    }
    
    /**
     * Determine if exception is retryable
     */
    private boolean isRetryableException(Exception e) {
        String message = e.getMessage();
        if (message != null) {
            String lowerMessage = message.toLowerCase();
            return lowerMessage.contains("throttl") ||
                   lowerMessage.contains("rate limit") ||
                   lowerMessage.contains("timeout") ||
                   lowerMessage.contains("temporarily unavailable") ||
                   lowerMessage.contains("service unavailable");
        }
        return false;
    }
    
    private String createStruggleAnalysisPrompt(StruggleSignal struggleSignal, UserProfile userProfile) {
        BehaviorMetrics metrics = userProfile.getBehaviorMetrics();
        
        return String.format("""
            Analyze the following user struggle signal and provide intervention recommendations:
            
            User ID: %s
            Feature: %s
            Struggle Type: %s
            Severity: %s
            Attempt Count: %d
            Time Spent: %d seconds
            
            User Profile:
            - Segment: %s
            - Total Sessions: %d
            - Average Session Duration: %.2f minutes
            - Feature Adoption Rate: %.2f
            
            Please provide:
            1. Analysis of the struggle pattern
            2. Recommended intervention type
            3. Urgency level (low/medium/high/critical)
            4. Specific actions to take
            5. Success probability estimate
            """,
            struggleSignal.getUserId(),
            struggleSignal.getFeatureId(),
            struggleSignal.getSignalType(),
            struggleSignal.getSeverity(),
            struggleSignal.getContext().getAttemptCount(),
            struggleSignal.getContext().getTimeSpent(),
            userProfile.getUserSegment(),
            metrics.getTotalSessions() != null ? metrics.getTotalSessions() : 0,
            metrics.getAvgSessionDuration() != null ? metrics.getAvgSessionDuration() : 0.0,
            metrics.getFeatureAdoptionRate() != null ? metrics.getFeatureAdoptionRate() : 0.0
        );
    }
    
    private String createJourneyOrchestrationPrompt(UserEvent userEvent, UserProfile userProfile) {
        return String.format("""
            Orchestrate the user journey based on the following event and user profile:
            
            Event Type: %s
            User ID: %s
            Feature: %s
            Session Stage: %s
            
            User Profile:
            - Segment: %s
            - Risk Score: %d
            - Preferred Interaction Style: %s
            
            Please provide:
            1. Next best action recommendations
            2. Personalization suggestions
            3. Content recommendations
            4. Engagement optimization strategies
            """,
            userEvent.getEventType(),
            userEvent.getUserId(),
            userEvent.getEventData().getFeature(),
            userEvent.getUserContext().getSessionStage(),
            userProfile.getUserSegment(),
            userProfile.getRiskFactors().getExitRiskScore(),
            userProfile.getPreferences().getPreferredInteractionStyle()
        );
    }
    
    private String createPredictionPrompt(UserProfile userProfile, String predictionType) {
        return String.format("""
            Generate %s prediction for the following user:
            
            User ID: %s
            Segment: %s
            Exit Risk Score: %d
            Total Sessions: %d
            Feature Adoption Rate: %.2f
            Support Interactions: %d
            
            Please provide:
            1. Prediction confidence level
            2. Key risk factors
            3. Recommended preventive actions
            4. Timeline for intervention
            """,
            predictionType,
            userProfile.getUserId(),
            userProfile.getUserSegment(),
            userProfile.getRiskFactors().getExitRiskScore(),
            userProfile.getBehaviorMetrics().getTotalSessions(),
            userProfile.getBehaviorMetrics().getFeatureAdoptionRate(),
            userProfile.getBehaviorMetrics().getSupportInteractionCount()
        );
    }
    
    private AgentResponse processModelResponse(String responseBody) {
        try {
            // Parse the Bedrock model response (Nova Converse API format)
            Map<String, Object> responseMap = objectMapper.readValue(responseBody, Map.class);
            
            // Nova response format: { "output": { "message": { "content": [{ "text": "..." }] } } }
            String outputText = null;
            if (responseMap.containsKey("output")) {
                Map<String, Object> output = (Map<String, Object>) responseMap.get("output");
                if (output.containsKey("message")) {
                    Map<String, Object> message = (Map<String, Object>) output.get("message");
                    if (message.containsKey("content")) {
                        java.util.List<Map<String, Object>> content = (java.util.List<Map<String, Object>>) message.get("content");
                        if (!content.isEmpty() && content.get(0).containsKey("text")) {
                            outputText = (String) content.get(0).get("text");
                        }
                    }
                }
            }
            
            return AgentResponse.builder()
                    .success(true)
                    .responseText(outputText != null ? outputText : responseBody)
                    .timestamp(System.currentTimeMillis())
                    .build();
                    
        } catch (Exception e) {
            logger.error("Error processing Bedrock model response", e);
            return AgentResponse.builder()
                    .success(true)
                    .responseText(responseBody)
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
    }
    
    private AgentResponse createFallbackResponse(String errorType, String errorMessage) {
        return AgentResponse.builder()
                .success(false)
                .errorType(errorType)
                .errorMessage(errorMessage)
                .timestamp(System.currentTimeMillis())
                .build();
    }
    
    private String generateSessionId(String userId) {
        return userId + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
    
    /**
     * Response object for Bedrock Agent interactions
     */
    public static class AgentResponse {
        private boolean success;
        private String responseText;
        private String errorType;
        private String errorMessage;
        private long timestamp;
        private Map<String, Object> metadata;
        
        public static Builder builder() {
            return new Builder();
        }
        
        public static class Builder {
            private AgentResponse response = new AgentResponse();
            
            public Builder success(boolean success) {
                response.success = success;
                return this;
            }
            
            public Builder responseText(String responseText) {
                response.responseText = responseText;
                return this;
            }
            
            public Builder errorType(String errorType) {
                response.errorType = errorType;
                return this;
            }
            
            public Builder errorMessage(String errorMessage) {
                response.errorMessage = errorMessage;
                return this;
            }
            
            public Builder timestamp(long timestamp) {
                response.timestamp = timestamp;
                return this;
            }
            
            public Builder metadata(Map<String, Object> metadata) {
                response.metadata = metadata;
                return this;
            }
            
            public AgentResponse build() {
                return response;
            }
        }
        
        // Getters
        public boolean isSuccess() { return success; }
        public String getResponseText() { return responseText; }
        public String getErrorType() { return errorType; }
        public String getErrorMessage() { return errorMessage; }
        public long getTimestamp() { return timestamp; }
        public Map<String, Object> getMetadata() { return metadata; }
    }
}