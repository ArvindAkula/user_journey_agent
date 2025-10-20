package com.userjourney.analytics.controller;

import com.userjourney.analytics.service.DemoManagementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/demo")
@CrossOrigin(origins = "*")
public class DemoManagementController {

    @Autowired
    private DemoManagementService demoManagementService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealthStatus() {
        try {
            Map<String, Object> healthStatus = demoManagementService.getHealthStatus();
            return ResponseEntity.ok(healthStatus);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get health status: " + e.getMessage()));
        }
    }

    @GetMapping("/cost-tracking")
    public ResponseEntity<Map<String, Object>> getCostTracking() {
        try {
            Map<String, Object> costTracking = demoManagementService.getCostTracking();
            return ResponseEntity.ok(costTracking);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get cost tracking: " + e.getMessage()));
        }
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetDemoData() {
        try {
            Map<String, Object> result = demoManagementService.resetDemoData();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to reset demo data: " + e.getMessage()));
        }
    }

    @PostMapping("/backup")
    public ResponseEntity<Map<String, Object>> backupDemoData() {
        try {
            Map<String, Object> result = demoManagementService.backupDemoData();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to backup demo data: " + e.getMessage()));
        }
    }

    @PostMapping("/restore")
    public ResponseEntity<Map<String, Object>> restoreDemoData(@RequestParam String backupId) {
        try {
            Map<String, Object> result = demoManagementService.restoreDemoData(backupId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to restore demo data: " + e.getMessage()));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getDemoStatus() {
        try {
            Map<String, Object> status = demoManagementService.getDemoStatus();
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get demo status: " + e.getMessage()));
        }
    }

    @PostMapping("/start-session")
    public ResponseEntity<Map<String, Object>> startDemoSession(@RequestBody Map<String, Object> sessionConfig) {
        try {
            Map<String, Object> result = demoManagementService.startDemoSession(sessionConfig);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to start demo session: " + e.getMessage()));
        }
    }

    @PostMapping("/stop-session")
    public ResponseEntity<Map<String, Object>> stopDemoSession() {
        try {
            Map<String, Object> result = demoManagementService.stopDemoSession();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to stop demo session: " + e.getMessage()));
        }
    }

    @GetMapping("/cost-estimate")
    public ResponseEntity<Map<String, Object>> getCostEstimate(@RequestParam(defaultValue = "4") int durationHours) {
        try {
            Map<String, Object> estimate = demoManagementService.getCostEstimate(durationHours);
            return ResponseEntity.ok(estimate);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get cost estimate: " + e.getMessage()));
        }
    }
}