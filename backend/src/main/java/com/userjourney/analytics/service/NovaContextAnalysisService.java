package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.model.NovaContextInsights;
import com.userjourney.analytics.model.PersonalizedRecommendation;
import com.userjourney.analytics.model.UserBehaviorInsights;
import com.userjourney.analytics.model.UserEvent;
import com.userjourney.analytics.model.UserProfile;
import com.userjourney.analytics.resilience.CircuitBreaker;
import com.userjourney.analytics.resilience.ErrorHandlingService;
import com.userjourney.analytics.resilience.RetryHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Service for Amazon Nova context analysis integration
 * Provides user context analysis, insight extraction, and recommendation generation
 */
@Service
public class NovaContextAnalysisService {
    
    private static final Logger logger = LoggerFactory.getLogger(NovaContextAnalysisService.class);
    private static final String SERVICE_NAME = "NovaContextAnalysis";
    
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
    
    @Value("${nova.model.id:amazon.nova-micro-v1:0}")
    private String novaModelId;
    
    @Value("${nova.max.tokens:1000}")
    private int maxTokens;
    
    @Value("${nova.temperature:0.3}")
    private double temperature;
    
    @Value("${nova.timeout.seconds:30}")
    private int timeoutSeconds;
    
    /**
     * Analyze user context from events and profile to generate insights
     */
    public CompletableFuture<NovaContextInsights> analyzeUserContext(
            List<UserEvent> recentEvents, 
            UserProfile userProfile) {
        
        return CompletableFuture.supplyAsync(() -> {
            String operationName = "analyzeUserContext";
            
            return circuitBreaker.execute(
                SERVICE_NAME + ":" + operationName,
                () -> retryHandler.executeWithRetryAndFallback(
                    operationName,
                    () -> performContextAnalysis(recentEvents, userProfile),
                    () -> {
                        NovaContextInsights fallback = createFallbackInsights(userProfile.getUserId(), 
                            "Service temporarily unavailable");
                        errorHandlingService.handleAIServiceError(SERVICE_NAME, 
                            new RuntimeException("Context analysis failed"), fallback);
                        return fallback;
                    },
                    createRetryConfig()
                ),
                () -> {
                    NovaContextInsights fallback = createFallbackInsights(userProfile.getUserId(), 
                        "Circuit breaker open");
                    errorHandlingService.handleAIServiceError(SERVICE_NAME, 
                        new RuntimeException("Circuit breaker open"), fallback);
                    return fallback;
                }
            );
        }).orTimeout(timeoutSeconds, TimeUnit.SECONDS)
          .exceptionally(throwable -> {
              logger.error("Nova context analysis timed out or failed", throwable);
              errorHandlingService.handleServiceTimeout(SERVICE_NAME, timeoutSeconds * 1000L, 
                  Map.of("userId", userProfile.getUserId(), "eventCount", recentEvents.size()));
              return createFallbackInsights(userProfile.getUserId(), throwable.getMessage());
          });
    }
    
    private NovaContextInsights performContextAnalysis(List<UserEvent> recentEvents, UserProfile userProfile) {
        try {
            String contextPrompt = buildContextAnalysisPrompt(recentEvents, userProfile);
            
            Map<String, Object> requestBody = createNovaRequest(contextPrompt);
            String jsonRequest;
            try {
                jsonRequest = objectMapper.writeValueAsString(requestBody);
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                logger.error("Failed to serialize Nova request", e);
                throw new RuntimeException("Failed to serialize Nova request", e);
            }
            
            InvokeModelRequest request = InvokeModelRequest.builder()
                    .modelId(novaModelId)
                    .body(SdkBytes.fromUtf8String(jsonRequest))
                    .build();
            
            InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);
            String responseBody = response.body().asUtf8String();
            
            return processNovaResponse(responseBody, userProfile.getUserId());
            
        } catch (Exception e) {
            errorHandlingService.handleError(SERVICE_NAME, "analyzeUserContext", e, 
                Map.of("userId", userProfile.getUserId(), "eventCount", recentEvents.size()));
            throw e;
        }
    }
    
    /**
     * Generate personalized recommendations based on user behavior
     */
    public CompletableFuture<List<PersonalizedRecommendation>> generateRecommendations(
            UserProfile userProfile, 
            String recommendationType) {
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                String recommendationPrompt = buildRecommendationPrompt(userProfile, recommendationType);
                
                Map<String, Object> requestBody = createNovaRequest(recommendationPrompt);
                String jsonRequest;
                try {
                    jsonRequest = objectMapper.writeValueAsString(requestBody);
                } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                    logger.error("Failed to serialize Nova request", e);
                    throw new RuntimeException("Failed to serialize Nova request", e);
                }
                
                InvokeModelRequest request = InvokeModelRequest.builder()
                        .modelId(novaModelId)
                        .body(SdkBytes.fromUtf8String(jsonRequest))
                        .build();
                
                InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);
                String responseBody = response.body().asUtf8String();
                
                return extractRecommendations(responseBody, recommendationType);
                
            } catch (Exception e) {
                logger.error("Error generating recommendations with Nova", e);
                return createFallbackRecommendations(recommendationType);
            }
        }).orTimeout(timeoutSeconds, TimeUnit.SECONDS)
          .exceptionally(throwable -> {
              logger.error("Nova recommendation generation timed out or failed", throwable);
              return createFallbackRecommendations(recommendationType);
          });
    }
    
    /**
     * Extract insights from user interaction patterns
     */
    public CompletableFuture<UserBehaviorInsights> extractBehaviorInsights(
            List<UserEvent> userEvents, 
            UserProfile userProfile) {
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                String behaviorPrompt = buildBehaviorAnalysisPrompt(userEvents, userProfile);
                
                Map<String, Object> requestBody = createNovaRequest(behaviorPrompt);
                String jsonRequest;
                try {
                    jsonRequest = objectMapper.writeValueAsString(requestBody);
                } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                    logger.error("Failed to serialize Nova request", e);
                    throw new RuntimeException("Failed to serialize Nova request", e);
                }
                
                InvokeModelRequest request = InvokeModelRequest.builder()
                        .modelId(novaModelId)
                        .body(SdkBytes.fromUtf8String(jsonRequest))
                        .build();
                
                InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);
                String responseBody = response.body().asUtf8String();
                
                return processBehaviorInsights(responseBody, userProfile.getUserId());
                
            } catch (Exception e) {
                logger.error("Error extracting behavior insights with Nova", e);
                return createFallbackBehaviorInsights(userProfile.getUserId(), e.getMessage());
            }
        }).orTimeout(timeoutSeconds, TimeUnit.SECONDS)
          .exceptionally(throwable -> {
              logger.error("Nova behavior analysis timed out or failed", throwable);
              return createFallbackBehaviorInsights(userProfile.getUserId(), throwable.getMessage());
          });
    }
    
    /**
     * Build context analysis prompt from user events and profile
     */
    private String buildContextAnalysisPrompt(List<UserEvent> recentEvents, UserProfile userProfile) {
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("Analyze the following user behavior data and provide comprehensive insights:\n\n");
        
        // User Profile Context
        prompt.append("User Profile:\n");
        prompt.append("- User ID: ").append(userProfile.getUserId()).append("\n");
        prompt.append("- Segment: ").append(userProfile.getUserSegment()).append("\n");
        prompt.append("- Total Sessions: ").append(userProfile.getBehaviorMetrics().getTotalSessions()).append("\n");
        prompt.append("- Average Session Duration: ").append(userProfile.getBehaviorMetrics().getAvgSessionDuration()).append(" minutes\n");
        prompt.append("- Feature Adoption Rate: ").append(userProfile.getBehaviorMetrics().getFeatureAdoptionRate()).append("\n");
        prompt.append("- Exit Risk Score: ").append(userProfile.getRiskFactors().getExitRiskScore()).append("\n");
        prompt.append("- Preferred Interaction Style: ").append(userProfile.getPreferences().getPreferredInteractionStyle()).append("\n\n");
        
        // Recent Events Context
        prompt.append("Recent User Events (last ").append(recentEvents.size()).append(" events):\n");
        for (int i = 0; i < Math.min(recentEvents.size(), 10); i++) {
            UserEvent event = recentEvents.get(i);
            prompt.append("- ").append(event.getEventType())
                  .append(" on ").append(event.getEventData().getFeature())
                  .append(" at ").append(Instant.ofEpochMilli(event.getTimestamp()))
                  .append("\n");
        }
        
        prompt.append("\nPlease provide:\n");
        prompt.append("1. User intent analysis - What is the user trying to accomplish?\n");
        prompt.append("2. Engagement level assessment - How engaged is the user?\n");
        prompt.append("3. Risk factors for drop-off - What might cause the user to leave?\n");
        prompt.append("4. Personalization opportunities - How can we customize the experience?\n");
        prompt.append("5. Next best actions - What should the user do next?\n");
        prompt.append("6. Intervention recommendations - What help does the user need?\n");
        
        return prompt.toString();
    }
    
    /**
     * Build recommendation prompt for specific recommendation type
     */
    private String buildRecommendationPrompt(UserProfile userProfile, String recommendationType) {
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("Generate personalized ").append(recommendationType).append(" recommendations for the following user:\n\n");
        
        prompt.append("User Profile:\n");
        prompt.append("- User ID: ").append(userProfile.getUserId()).append("\n");
        prompt.append("- Segment: ").append(userProfile.getUserSegment()).append("\n");
        prompt.append("- Content Preferences: ").append(userProfile.getPreferences().getContentCategories()).append("\n");
        prompt.append("- Video Topics: ").append(userProfile.getPreferences().getVideoTopics()).append("\n");
        prompt.append("- Interaction Style: ").append(userProfile.getPreferences().getPreferredInteractionStyle()).append("\n");
        prompt.append("- Feature Adoption Rate: ").append(userProfile.getBehaviorMetrics().getFeatureAdoptionRate()).append("\n");
        
        switch (recommendationType.toLowerCase()) {
            case "content":
                prompt.append("\nProvide 5 specific content recommendations with:\n");
                prompt.append("- Content title and type\n");
                prompt.append("- Relevance score (1-100)\n");
                prompt.append("- Reasoning for recommendation\n");
                break;
            case "feature":
                prompt.append("\nProvide 3 feature recommendations with:\n");
                prompt.append("- Feature name and description\n");
                prompt.append("- Priority level (high/medium/low)\n");
                prompt.append("- Expected benefit to user\n");
                break;
            case "intervention":
                prompt.append("\nProvide intervention recommendations with:\n");
                prompt.append("- Intervention type and timing\n");
                prompt.append("- Success probability\n");
                prompt.append("- Implementation approach\n");
                break;
        }
        
        return prompt.toString();
    }
    
    /**
     * Build behavior analysis prompt
     */
    private String buildBehaviorAnalysisPrompt(List<UserEvent> userEvents, UserProfile userProfile) {
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("Analyze the following user behavior patterns and extract insights:\n\n");
        
        // Event pattern analysis
        Map<String, Integer> eventCounts = new HashMap<>();
        Map<String, Integer> featureCounts = new HashMap<>();
        
        for (UserEvent event : userEvents) {
            eventCounts.merge(event.getEventType(), 1, Integer::sum);
            if (event.getEventData().getFeature() != null) {
                featureCounts.merge(event.getEventData().getFeature(), 1, Integer::sum);
            }
        }
        
        prompt.append("Event Type Distribution:\n");
        eventCounts.forEach((type, count) -> 
            prompt.append("- ").append(type).append(": ").append(count).append(" events\n"));
        
        prompt.append("\nFeature Usage Distribution:\n");
        featureCounts.forEach((feature, count) -> 
            prompt.append("- ").append(feature).append(": ").append(count).append(" interactions\n"));
        
        prompt.append("\nUser Profile Context:\n");
        prompt.append("- Current Segment: ").append(userProfile.getUserSegment()).append("\n");
        prompt.append("- Risk Score: ").append(userProfile.getRiskFactors().getExitRiskScore()).append("\n");
        
        prompt.append("\nPlease analyze and provide:\n");
        prompt.append("1. Behavior patterns and trends\n");
        prompt.append("2. User engagement indicators\n");
        prompt.append("3. Potential friction points\n");
        prompt.append("4. Success indicators\n");
        prompt.append("5. Recommended optimizations\n");
        
        return prompt.toString();
    }
    
    /**
     * Create Nova request body
     */
    private Map<String, Object> createNovaRequest(String prompt) {
        Map<String, Object> request = new HashMap<>();
        request.put("inputText", prompt);
        
        Map<String, Object> config = new HashMap<>();
        config.put("maxTokenCount", maxTokens);
        config.put("temperature", temperature);
        config.put("topP", 0.9);
        
        request.put("textGenerationConfig", config);
        
        return request;
    }
    
    /**
     * Process Nova response and extract insights
     */
    private NovaContextInsights processNovaResponse(String responseBody, String userId) {
        try {
            JsonNode responseJson = objectMapper.readTree(responseBody);
            String outputText = responseJson.path("outputText").asText();
            
            return NovaContextInsights.builder()
                    .userId(userId)
                    .analysisText(outputText)
                    .userIntent(extractSection(outputText, "User intent analysis"))
                    .engagementLevel(extractSection(outputText, "Engagement level assessment"))
                    .riskFactors(extractListSection(outputText, "Risk factors for drop-off"))
                    .personalizationOpportunities(extractListSection(outputText, "Personalization opportunities"))
                    .nextBestActions(extractListSection(outputText, "Next best actions"))
                    .interventionRecommendations(extractListSection(outputText, "Intervention recommendations"))
                    .confidence(calculateConfidence(outputText))
                    .timestamp(LocalDateTime.now())
                    .success(true)
                    .build();
                    
        } catch (Exception e) {
            logger.error("Error processing Nova response", e);
            return createFallbackInsights(userId, e.getMessage());
        }
    }
    
    /**
     * Extract recommendations from Nova response
     */
    private List<PersonalizedRecommendation> extractRecommendations(String responseBody, String type) {
        try {
            JsonNode responseJson = objectMapper.readTree(responseBody);
            String outputText = responseJson.path("outputText").asText();
            
            List<PersonalizedRecommendation> recommendations = new ArrayList<>();
            
            // Parse recommendations based on type
            String[] lines = outputText.split("\n");
            for (String line : lines) {
                if (line.trim().startsWith("-") || line.trim().matches("\\d+\\..*")) {
                    PersonalizedRecommendation rec = parseRecommendationLine(line, type);
                    if (rec != null) {
                        recommendations.add(rec);
                    }
                }
            }
            
            return recommendations;
            
        } catch (Exception e) {
            logger.error("Error extracting recommendations from Nova response", e);
            return createFallbackRecommendations(type);
        }
    }
    
    /**
     * Process behavior insights from Nova response
     */
    private UserBehaviorInsights processBehaviorInsights(String responseBody, String userId) {
        try {
            JsonNode responseJson = objectMapper.readTree(responseBody);
            String outputText = responseJson.path("outputText").asText();
            
            return UserBehaviorInsights.builder()
                    .userId(userId)
                    .behaviorPatterns(extractListSection(outputText, "Behavior patterns and trends"))
                    .engagementIndicators(extractListSection(outputText, "User engagement indicators"))
                    .frictionPoints(extractListSection(outputText, "Potential friction points"))
                    .successIndicators(extractListSection(outputText, "Success indicators"))
                    .optimizationRecommendations(extractListSection(outputText, "Recommended optimizations"))
                    .analysisText(outputText)
                    .confidence(calculateConfidence(outputText))
                    .timestamp(LocalDateTime.now())
                    .success(true)
                    .build();
                    
        } catch (Exception e) {
            logger.error("Error processing behavior insights", e);
            return createFallbackBehaviorInsights(userId, e.getMessage());
        }
    }
    
    // Helper methods for text extraction
    private String extractSection(String text, String sectionName) {
        String[] lines = text.split("\n");
        boolean inSection = false;
        StringBuilder section = new StringBuilder();
        
        for (String line : lines) {
            if (line.toLowerCase().contains(sectionName.toLowerCase())) {
                inSection = true;
                continue;
            }
            if (inSection) {
                if (line.trim().isEmpty() || line.matches("\\d+\\..*")) {
                    break;
                }
                section.append(line.trim()).append(" ");
            }
        }
        
        return section.toString().trim();
    }
    
    private List<String> extractListSection(String text, String sectionName) {
        List<String> items = new ArrayList<>();
        String[] lines = text.split("\n");
        boolean inSection = false;
        
        for (String line : lines) {
            if (line.toLowerCase().contains(sectionName.toLowerCase())) {
                inSection = true;
                continue;
            }
            if (inSection) {
                if (line.trim().startsWith("-") || line.trim().matches("\\d+\\..*")) {
                    items.add(line.trim().replaceFirst("^[-\\d\\.\\s]+", ""));
                } else if (line.trim().isEmpty() || line.matches("\\d+\\..*")) {
                    break;
                }
            }
        }
        
        return items;
    }
    
    private PersonalizedRecommendation parseRecommendationLine(String line, String type) {
        String cleanLine = line.trim().replaceFirst("^[-\\d\\.\\s]+", "");
        
        return PersonalizedRecommendation.builder()
                .type(type)
                .title(cleanLine.length() > 50 ? cleanLine.substring(0, 50) + "..." : cleanLine)
                .description(cleanLine)
                .relevanceScore(85) // Default score, could be extracted from text
                .priority("medium")
                .timestamp(LocalDateTime.now())
                .build();
    }
    
    private double calculateConfidence(String text) {
        // Simple confidence calculation based on text length and structure
        int wordCount = text.split("\\s+").length;
        boolean hasStructure = text.contains("1.") || text.contains("-");
        
        double confidence = Math.min(0.9, 0.5 + (wordCount / 1000.0));
        if (hasStructure) confidence += 0.1;
        
        return Math.max(0.1, confidence);
    }
    
    // Fallback methods for service unavailability
    private NovaContextInsights createFallbackInsights(String userId, String errorMessage) {
        return NovaContextInsights.builder()
                .userId(userId)
                .analysisText("Nova service unavailable. Using fallback analysis.")
                .userIntent("Unable to determine user intent - service unavailable")
                .engagementLevel("Medium engagement assumed")
                .riskFactors(Arrays.asList("Service unavailability", "Limited analysis capability"))
                .personalizationOpportunities(Arrays.asList("Enable Nova service for better insights"))
                .nextBestActions(Arrays.asList("Continue with current flow", "Monitor user behavior"))
                .interventionRecommendations(Arrays.asList("Provide standard support options"))
                .confidence(0.3)
                .timestamp(LocalDateTime.now())
                .success(false)
                .errorMessage(errorMessage)
                .build();
    }
    
    private List<PersonalizedRecommendation> createFallbackRecommendations(String type) {
        List<PersonalizedRecommendation> fallbacks = new ArrayList<>();
        
        switch (type.toLowerCase()) {
            case "content":
                fallbacks.add(PersonalizedRecommendation.builder()
                        .type("content")
                        .title("Getting Started Guide")
                        .description("Basic introduction to platform features")
                        .relevanceScore(70)
                        .priority("high")
                        .timestamp(LocalDateTime.now())
                        .build());
                break;
            case "feature":
                fallbacks.add(PersonalizedRecommendation.builder()
                        .type("feature")
                        .title("Profile Completion")
                        .description("Complete your user profile for better experience")
                        .relevanceScore(75)
                        .priority("medium")
                        .timestamp(LocalDateTime.now())
                        .build());
                break;
            default:
                fallbacks.add(PersonalizedRecommendation.builder()
                        .type(type)
                        .title("Standard Recommendation")
                        .description("Continue exploring available features")
                        .relevanceScore(60)
                        .priority("low")
                        .timestamp(LocalDateTime.now())
                        .build());
        }
        
        return fallbacks;
    }
    
    private UserBehaviorInsights createFallbackBehaviorInsights(String userId, String errorMessage) {
        return UserBehaviorInsights.builder()
                .userId(userId)
                .behaviorPatterns(Arrays.asList("Standard user behavior patterns"))
                .engagementIndicators(Arrays.asList("Active session participation"))
                .frictionPoints(Arrays.asList("Service unavailability"))
                .successIndicators(Arrays.asList("Continued platform usage"))
                .optimizationRecommendations(Arrays.asList("Enable Nova service for detailed analysis"))
                .analysisText("Fallback analysis due to Nova service unavailability")
                .confidence(0.3)
                .timestamp(LocalDateTime.now())
                .success(false)
                .errorMessage(errorMessage)
                .build();
    }
    
    /**
     * Create retry configuration for Nova operations
     */
    private RetryHandler.RetryConfig createRetryConfig() {
        return RetryHandler.RetryConfig.builder()
            .maxAttempts(3)
            .initialDelay(Duration.ofMillis(1000))
            .backoffMultiplier(2.0)
            .maxDelay(Duration.ofSeconds(15))
            .jitterFactor(0.2)
            .retryIf(this::isRetryableException)
            .build();
    }
    
    /**
     * Determine if exception is retryable for Nova service
     */
    private boolean isRetryableException(Exception e) {
        String message = e.getMessage();
        if (message != null) {
            String lowerMessage = message.toLowerCase();
            return lowerMessage.contains("throttl") ||
                   lowerMessage.contains("rate limit") ||
                   lowerMessage.contains("timeout") ||
                   lowerMessage.contains("temporarily unavailable") ||
                   lowerMessage.contains("service unavailable") ||
                   lowerMessage.contains("connection") ||
                   lowerMessage.contains("network");
        }
        return false;
    }
}