package com.userjourney.analytics.controller;

import com.userjourney.analytics.service.DataSeedingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/demo")
@CrossOrigin(origins = "*")
public class DataSeedingController {
    
    private static final Logger logger = LoggerFactory.getLogger(DataSeedingController.class);
    
    @Autowired
    private DataSeedingService dataSeedingService;
    
    /**
     * Seed sample users for demo
     */
    @PostMapping("/seed-users")
    public ResponseEntity<Map<String, Object>> seedUsers(
            @RequestParam(defaultValue = "50") int userCount) {
        
        logger.info("Received request to seed {} users", userCount);
        
        try {
            long startTime = System.currentTimeMillis();
            dataSeedingService.seedSampleUsers(userCount);
            long duration = System.currentTimeMillis() - startTime;
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Successfully seeded " + userCount + " users");
            response.put("userCount", userCount);
            response.put("durationMs", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error seeding users", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to seed users: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Simulate user behavior for a specific user
     */
    @PostMapping("/simulate-behavior")
    public ResponseEntity<Map<String, Object>> simulateUserBehavior(
            @RequestParam String userId,
            @RequestParam(defaultValue = "20") int eventCount) {
        
        logger.info("Simulating behavior for user {} with {} events", userId, eventCount);
        
        try {
            long startTime = System.currentTimeMillis();
            dataSeedingService.simulateUserBehavior(userId, eventCount);
            long duration = System.currentTimeMillis() - startTime;
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Successfully simulated behavior for user " + userId);
            response.put("userId", userId);
            response.put("eventCount", eventCount);
            response.put("durationMs", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error simulating user behavior", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to simulate user behavior: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Generate predefined journey scenarios
     */
    @PostMapping("/generate-scenarios")
    public ResponseEntity<Map<String, Object>> generateJourneyScenarios() {
        
        logger.info("Generating predefined journey scenarios");
        
        try {
            long startTime = System.currentTimeMillis();
            dataSeedingService.generateJourneyScenarios();
            long duration = System.currentTimeMillis() - startTime;
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Successfully generated journey scenarios");
            response.put("scenarios", new String[]{
                "struggling_new_user", "engaged_video_watcher", "churn_risk_user", 
                "power_user", "mobile_first_user"
            });
            response.put("durationMs", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error generating journey scenarios", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to generate journey scenarios: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Reset demo data to clean state
     */
    @PostMapping("/reset-data")
    public ResponseEntity<Map<String, Object>> resetDemoData() {
        
        logger.info("Resetting demo data to clean state");
        
        try {
            long startTime = System.currentTimeMillis();
            dataSeedingService.resetDemoData();
            long duration = System.currentTimeMillis() - startTime;
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Demo data reset completed successfully");
            response.put("durationMs", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error resetting demo data", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to reset demo data: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Generate performance testing data
     */
    @PostMapping("/generate-performance-data")
    public ResponseEntity<Map<String, Object>> generatePerformanceTestData(
            @RequestParam(defaultValue = "1000") int userCount,
            @RequestParam(defaultValue = "50") int eventsPerUser) {
        
        logger.info("Generating performance test data: {} users, {} events each", userCount, eventsPerUser);
        
        try {
            long startTime = System.currentTimeMillis();
            dataSeedingService.generatePerformanceTestData(userCount, eventsPerUser);
            long duration = System.currentTimeMillis() - startTime;
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Performance test data generated successfully");
            response.put("userCount", userCount);
            response.put("eventsPerUser", eventsPerUser);
            response.put("totalEvents", userCount * eventsPerUser);
            response.put("durationMs", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error generating performance test data", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to generate performance test data: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Get demo data statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDemoStats() {
        
        logger.info("Retrieving demo data statistics");
        
        try {
            // This would typically query the database for actual counts
            // For now, returning mock statistics
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalUsers", 50);
            stats.put("totalEvents", 2500);
            stats.put("activeScenarios", 5);
            stats.put("lastResetTime", System.currentTimeMillis());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("stats", stats);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error retrieving demo stats", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to retrieve demo stats: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
}