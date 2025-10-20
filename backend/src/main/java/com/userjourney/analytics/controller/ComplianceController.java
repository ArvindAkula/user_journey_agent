package com.userjourney.analytics.controller;

import com.userjourney.analytics.service.AuditLogService;
import com.userjourney.analytics.service.ComplianceService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/compliance")
public class ComplianceController {

    @Autowired
    private ComplianceService complianceService;

    @Autowired
    private AuditLogService auditLogService;

    /**
     * GDPR Article 15 - Right of Access
     * Export all user data
     */
    @PostMapping("/gdpr/export/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> exportUserData(
            @PathVariable String userId,
            HttpServletRequest request) {
        
        String requestId = UUID.randomUUID().toString();
        String ipAddress = getClientIpAddress(request);
        
        return complianceService.exportUserData(userId, requestId, ipAddress)
            .thenApply(data -> ResponseEntity.ok(Map.of(
                "requestId", requestId,
                "status", "completed",
                "data", data
            )))
            .exceptionally(ex -> ResponseEntity.internalServerError()
                .body(Map.of(
                    "requestId", requestId,
                    "status", "failed",
                    "error", ex.getMessage()
                )));
    }

    /**
     * GDPR Article 17 - Right to Erasure (Right to be Forgotten)
     */
    @DeleteMapping("/gdpr/delete/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> deleteUserData(
            @PathVariable String userId,
            @RequestParam(required = false, defaultValue = "User request") String reason,
            HttpServletRequest request) {
        
        String requestId = UUID.randomUUID().toString();
        String ipAddress = getClientIpAddress(request);
        
        return complianceService.deleteUserData(userId, requestId, ipAddress, reason)
            .thenApply(success -> {
                if (success) {
                    return ResponseEntity.ok(Map.of(
                        "requestId", requestId,
                        "status", "completed",
                        "message", "User data has been successfully deleted"
                    ));
                } else {
                    return ResponseEntity.internalServerError()
                        .body(Map.of(
                            "requestId", requestId,
                            "status", "failed",
                            "error", "Failed to delete user data"
                        ));
                }
            });
    }

    /**
     * CCPA - Right to Delete Personal Information
     */
    @DeleteMapping("/ccpa/delete/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> deleteCCPAUserData(
            @PathVariable String userId,
            HttpServletRequest request) {
        
        String requestId = UUID.randomUUID().toString();
        String ipAddress = getClientIpAddress(request);
        
        return complianceService.deleteCCPAUserData(userId, requestId, ipAddress)
            .thenApply(success -> {
                if (success) {
                    return ResponseEntity.ok(Map.of(
                        "requestId", requestId,
                        "status", "completed",
                        "message", "User data has been processed according to CCPA requirements"
                    ));
                } else {
                    return ResponseEntity.internalServerError()
                        .body(Map.of(
                            "requestId", requestId,
                            "status", "failed",
                            "error", "Failed to process CCPA deletion request"
                        ));
                }
            });
    }

    /**
     * Update user consent preferences
     */
    @PostMapping("/consent/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
    public ResponseEntity<Map<String, Object>> updateConsent(
            @PathVariable String userId,
            @RequestBody Map<String, Boolean> consentPreferences,
            HttpServletRequest request) {
        
        try {
            String ipAddress = getClientIpAddress(request);
            String userAgent = request.getHeader("User-Agent");
            
            complianceService.updateUserConsent(userId, consentPreferences, ipAddress, userAgent);
            
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Consent preferences updated successfully"
            ));
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of(
                    "status", "error",
                    "message", "Failed to update consent preferences"
                ));
        }
    }

    /**
     * Get user consent preferences
     */
    @GetMapping("/consent/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
    public ResponseEntity<Map<String, Object>> getConsent(@PathVariable String userId) {
        try {
            Map<String, Boolean> consent = complianceService.getUserConsent(userId);
            
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "consent", consent
            ));
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of(
                    "status", "error",
                    "message", "Failed to retrieve consent preferences"
                ));
        }
    }

    /**
     * Anonymize user data (CCPA compliance)
     */
    @PostMapping("/anonymize/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> anonymizeUserData(
            @PathVariable String userId,
            HttpServletRequest request) {
        
        try {
            String ipAddress = getClientIpAddress(request);
            auditLogService.logComplianceEvent(userId, "DATA_ANONYMIZATION", "CCPA", 
                UUID.randomUUID().toString(), ipAddress);
            
            complianceService.anonymizeUserData(userId);
            
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "User data has been anonymized successfully"
            ));
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of(
                    "status", "error",
                    "message", "Failed to anonymize user data"
                ));
        }
    }

    /**
     * Get privacy policy
     */
    @GetMapping("/privacy-policy")
    public ResponseEntity<Map<String, Object>> getPrivacyPolicy() {
        return ResponseEntity.ok(Map.of(
            "title", "Privacy Policy",
            "lastUpdated", "2024-01-01",
            "content", "This application collects and processes user data in accordance with GDPR and CCPA regulations...",
            "dataTypes", Map.of(
                "personal", "Name, email, user preferences",
                "behavioral", "App usage patterns, video engagement metrics",
                "technical", "IP address, device information, session data"
            ),
            "rights", Map.of(
                "access", "You have the right to access your personal data",
                "rectification", "You have the right to correct inaccurate data",
                "erasure", "You have the right to request deletion of your data",
                "portability", "You have the right to export your data"
            )
        ));
    }

    /**
     * Get terms of service
     */
    @GetMapping("/terms-of-service")
    public ResponseEntity<Map<String, Object>> getTermsOfService() {
        return ResponseEntity.ok(Map.of(
            "title", "Terms of Service",
            "lastUpdated", "2024-01-01",
            "content", "By using this service, you agree to the following terms and conditions...",
            "dataRetention", "User data is retained for analytical purposes in accordance with applicable laws",
            "userRights", "Users have the right to access, modify, and delete their personal information"
        ));
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}