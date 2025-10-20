package com.userjourney.analytics.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@RestController
@RequestMapping("/api/interventions")
@CrossOrigin(origins = "*")
public class InterventionController {

    private static final Logger logger = LoggerFactory.getLogger(InterventionController.class);

    @Autowired
    private DynamoDbClient dynamoDbClient;

    private static final String STRUGGLE_SIGNALS_TABLE = "user-journey-analytics-struggle-signals";

    @GetMapping("/{userId}/pending")
    public Map<String, Object> getPendingInterventions(@PathVariable String userId) {
        logger.info("Checking for pending interventions for user: {}", userId);

        try {
            // Query DynamoDB for recent high-risk signals for this user
            QueryRequest queryRequest = QueryRequest.builder()
                    .tableName(STRUGGLE_SIGNALS_TABLE)
                    .keyConditionExpression("userId = :userId")
                    .expressionAttributeValues(Map.of(
                            ":userId", AttributeValue.builder().s(userId).build()))
                    .scanIndexForward(false) // Most recent first
                    .limit(5)
                    .build();

            QueryResponse response = dynamoDbClient.query(queryRequest);

            // Track records with score >= 70
            int highRiskCount = 0;
            double highestRisk = 0;
            Map<String, AttributeValue> highestRiskItem = null;

            // Check if any recent signal has high exit risk (>= 75) OR if 4+ records have
            // >= 70
            for (Map<String, AttributeValue> item : response.items()) {
                AttributeValue exitRiskAttr = item.get("exitRiskScore");
                if (exitRiskAttr != null && exitRiskAttr.n() != null) {
                    double exitRisk = Double.parseDouble(exitRiskAttr.n());

                    // Track highest risk
                    if (exitRisk > highestRisk) {
                        highestRisk = exitRisk;
                        highestRiskItem = item;
                    }

                    // Count records with score >= 70
                    if (exitRisk >= 70) {
                        highRiskCount++;
                    }

                    // Immediate trigger for score >= 75
                    if (exitRisk >= 75) {
                        logger.info("Found high-risk signal for user {}: exitRisk={}", userId, exitRisk);

                        // Return intervention event
                        Map<String, Object> intervention = new HashMap<>();
                        intervention.put("type", "critical_intervention");
                        intervention.put("action", "show_live_chat_popup");
                        intervention.put("userId", userId);

                        Map<String, Object> payload = new HashMap<>();
                        payload.put("interventionType", "live_chat_offer");
                        payload.put("riskLevel", exitRisk >= 85 ? "critical" : "high");
                        payload.put("riskScore", exitRisk);

                        AttributeValue descAttr = item.get("description");
                        if (descAttr != null && descAttr.s() != null) {
                            payload.put("context", descAttr.s());
                        }

                        intervention.put("payload", payload);

                        Map<String, Object> result = new HashMap<>();
                        result.put("hasPendingIntervention", true);
                        result.put("intervention", intervention);

                        return result;
                    }
                }
            }

            // Check if 4+ records have score >= 70
            if (highRiskCount >= 4 && highestRiskItem != null) {
                logger.info("Found {} records with exitRisk >= 70 for user {}, highest: {}",
                        highRiskCount, userId, highestRisk);

                // Return intervention event
                Map<String, Object> intervention = new HashMap<>();
                intervention.put("type", "critical_intervention");
                intervention.put("action", "show_live_chat_popup");
                intervention.put("userId", userId);

                Map<String, Object> payload = new HashMap<>();
                payload.put("interventionType", "live_chat_offer");
                payload.put("riskLevel", "high");
                payload.put("riskScore", highestRisk);
                payload.put("triggerReason", "persistent_risk");
                payload.put("highRiskCount", highRiskCount);

                AttributeValue descAttr = highestRiskItem.get("description");
                if (descAttr != null && descAttr.s() != null) {
                    payload.put("context", descAttr.s());
                }

                intervention.put("payload", payload);

                Map<String, Object> result = new HashMap<>();
                result.put("hasPendingIntervention", true);
                result.put("intervention", intervention);

                return result;
            }

            // No high-risk signals found
            Map<String, Object> result = new HashMap<>();
            result.put("hasPendingIntervention", false);
            result.put("intervention", null);

            return result;

        } catch (Exception e) {
            logger.error("Error checking for interventions: {}", e.getMessage(), e);

            Map<String, Object> result = new HashMap<>();
            result.put("hasPendingIntervention", false);
            result.put("intervention", null);
            result.put("error", e.getMessage());

            return result;
        }
    }
}
