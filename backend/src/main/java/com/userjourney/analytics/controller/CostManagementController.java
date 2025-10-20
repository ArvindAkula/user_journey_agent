package com.userjourney.analytics.controller;

import com.userjourney.analytics.service.CostManagementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/cost-management")
@CrossOrigin(origins = "*")
public class CostManagementController {
    
    private static final Logger logger = LoggerFactory.getLogger(CostManagementController.class);
    
    @Autowired
    private CostManagementService costManagementService;
    
    /**
     * Create cost monitoring dashboard
     */
    @PostMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> createCostDashboard() {
        logger.info("Creating cost monitoring dashboard");
        
        try {
            Map<String, Object> result = costManagementService.createCostMonitoringDashboard();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error creating cost dashboard", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to create cost dashboard: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Setup billing alerts
     */
    @PostMapping("/alerts")
    public ResponseEntity<Map<String, Object>> setupBillingAlerts() {
        logger.info("Setting up billing alerts");
        
        try {
            Map<String, Object> result = costManagementService.setupBillingAlerts();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error setting up billing alerts", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to setup billing alerts: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Get current cost and usage
     */
    @GetMapping("/current-costs")
    public ResponseEntity<Map<String, Object>> getCurrentCosts() {
        logger.info("Retrieving current costs");
        
        try {
            Map<String, Object> result = costManagementService.getCurrentCostAndUsage();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error retrieving current costs", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to retrieve current costs: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Get cost breakdown by service
     */
    @GetMapping("/costs-by-service")
    public ResponseEntity<Map<String, Object>> getCostsByService() {
        logger.info("Retrieving costs by service");
        
        try {
            Map<String, Object> result = costManagementService.getCostByService();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error retrieving costs by service", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to retrieve costs by service: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Schedule resource shutdown
     */
    @PostMapping("/schedule-shutdown")
    public ResponseEntity<Map<String, Object>> scheduleResourceShutdown() {
        logger.info("Scheduling resource shutdown");
        
        try {
            Map<String, Object> result = costManagementService.scheduleResourceShutdown();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error scheduling resource shutdown", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to schedule resource shutdown: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Shutdown demo resources immediately
     */
    @PostMapping("/shutdown-now")
    public ResponseEntity<Map<String, Object>> shutdownResourcesNow() {
        logger.info("Shutting down demo resources immediately");
        
        try {
            Map<String, Object> result = costManagementService.shutdownDemoResources();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error shutting down resources", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to shutdown resources: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Create teardown automation
     */
    @PostMapping("/teardown-automation")
    public ResponseEntity<Map<String, Object>> createTeardownAutomation() {
        logger.info("Creating teardown automation");
        
        try {
            Map<String, Object> result = costManagementService.createTeardownAutomation();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error creating teardown automation", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to create teardown automation: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Implement resource tagging
     */
    @PostMapping("/resource-tagging")
    public ResponseEntity<Map<String, Object>> implementResourceTagging() {
        logger.info("Implementing resource tagging strategy");
        
        try {
            Map<String, Object> result = costManagementService.implementResourceTagging();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error implementing resource tagging", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to implement resource tagging: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Create lifecycle management
     */
    @PostMapping("/lifecycle-management")
    public ResponseEntity<Map<String, Object>> createLifecycleManagement() {
        logger.info("Creating lifecycle management");
        
        try {
            Map<String, Object> result = costManagementService.createLifecycleManagement();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error creating lifecycle management", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to create lifecycle management: " + e.getMessage());
            
            return ResponseEntity.internalServerError().body(response);
        }
    }
}