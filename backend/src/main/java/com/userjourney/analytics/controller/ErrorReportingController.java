package com.userjourney.analytics.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("")
@CrossOrigin(origins = "http://localhost:3000")
public class ErrorReportingController {

    private static final Logger logger = LoggerFactory.getLogger(ErrorReportingController.class);

    /**
     * Handle error reports from frontend
     */
    @PostMapping("/errors")
    public ResponseEntity<Map<String, Object>> reportError(@RequestBody Map<String, Object> errorData) {
        String correlationId = MDC.get("correlationId");
        
        logger.info("[DEBUG] Received error report - correlationId: {}", correlationId);
        logger.info("[DEBUG] Error data: {}", errorData);
        
        try {
            // Log the error details
            logger.error("Frontend Error Report: {}", errorData);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Error report received successfully");
            response.put("timestamp", LocalDateTime.now());
            response.put("correlationId", correlationId);
            
            logger.info("[DEBUG] Sending success response: {}", response);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("[DEBUG] Exception while processing error report: ", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to process error report: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            response.put("correlationId", correlationId);
            
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Handle performance reports from frontend
     */
    @PostMapping("/performance")
    public ResponseEntity<Map<String, Object>> reportPerformance(@RequestBody Map<String, Object> performanceData) {
        String correlationId = MDC.get("correlationId");
        
        logger.info("[DEBUG] Received performance report - correlationId: {}", correlationId);
        logger.info("[DEBUG] Performance data: {}", performanceData);
        
        try {
            // Log the performance data
            logger.info("Frontend Performance Report: {}", performanceData);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Performance report received successfully");
            response.put("timestamp", LocalDateTime.now());
            response.put("correlationId", correlationId);
            
            logger.info("[DEBUG] Sending success response: {}", response);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("[DEBUG] Exception while processing performance report: ", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to process performance report: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            response.put("correlationId", correlationId);
            
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Handle error feedback from frontend
     */
    @PostMapping("/errors/feedback")
    public ResponseEntity<Map<String, Object>> reportErrorFeedback(@RequestBody Map<String, Object> feedbackData) {
        String correlationId = MDC.get("correlationId");
        
        logger.info("[DEBUG] Received error feedback - correlationId: {}", correlationId);
        logger.info("[DEBUG] Feedback data: {}", feedbackData);
        
        try {
            // Log the feedback
            logger.info("Frontend Error Feedback: {}", feedbackData);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Error feedback received successfully");
            response.put("timestamp", LocalDateTime.now());
            response.put("correlationId", correlationId);
            
            logger.info("[DEBUG] Sending success response: {}", response);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("[DEBUG] Exception while processing error feedback: ", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to process error feedback: " + e.getMessage());
            response.put("timestamp", LocalDateTime.now());
            response.put("correlationId", correlationId);
            
            return ResponseEntity.status(500).body(response);
        }
    }
}