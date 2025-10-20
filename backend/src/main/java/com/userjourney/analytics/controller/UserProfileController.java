package com.userjourney.analytics.controller;

import com.userjourney.analytics.model.UserProfile;
import com.userjourney.analytics.dto.UserProfileRequest;
import com.userjourney.analytics.service.UserProfileService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*", maxAge = 3600)
public class UserProfileController {
    
    private static final Logger logger = LoggerFactory.getLogger(UserProfileController.class);
    
    @Autowired
    private UserProfileService userProfileService;
    
    /**
     * Get user profile
     * GET /api/users/profile/{userId}
     */
    @GetMapping("/profile/{userId}")
    public ResponseEntity<UserProfile> getUserProfile(@PathVariable String userId) {
        try {
            logger.info("Fetching profile for user: {}", userId);
            
            UserProfile profile = userProfileService.getUserProfile(userId);
            
            return ResponseEntity.ok(profile);
            
        } catch (Exception e) {
            logger.error("Error fetching profile for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Update user profile
     * PUT /api/users/profile/{userId}
     */
    @PutMapping("/profile/{userId}")
    public ResponseEntity<UserProfile> updateUserProfile(
            @PathVariable String userId,
            @Valid @RequestBody UserProfileRequest request) {
        
        try {
            logger.info("Updating profile for user: {}", userId);
            
            UserProfile updatedProfile = userProfileService.updateUserProfile(userId, request);
            
            return ResponseEntity.ok(updatedProfile);
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid profile update request for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().build();
            
        } catch (Exception e) {
            logger.error("Error updating profile for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Upload user avatar
     * POST /api/users/avatar/{userId}
     */
    @PostMapping("/avatar/{userId}")
    public ResponseEntity<Map<String, Object>> uploadAvatar(
            @PathVariable String userId,
            @RequestParam("file") MultipartFile file) {
        
        try {
            logger.info("Uploading avatar for user: {}", userId);
            
            String avatarUrl = userProfileService.uploadAvatar(userId, file);
            
            Map<String, Object> response = Map.of(
                "avatarUrl", avatarUrl,
                "message", "Avatar uploaded successfully",
                "timestamp", System.currentTimeMillis()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid avatar upload for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage()));
                
        } catch (IOException e) {
            logger.error("Error uploading avatar for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to upload avatar: " + e.getMessage()));
                
        } catch (Exception e) {
            logger.error("Unexpected error uploading avatar for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Avatar upload failed: " + e.getMessage()));
        }
    }
    
    /**
     * Get avatar file
     * GET /api/users/avatar/{fileName}
     */
    @GetMapping("/avatar/{fileName}")
    public ResponseEntity<byte[]> getAvatar(@PathVariable String fileName) {
        try {
            logger.info("Retrieving avatar file: {}", fileName);
            
            byte[] avatarContent = userProfileService.getAvatarFile(fileName);
            
            HttpHeaders headers = new HttpHeaders();
            
            // Determine content type based on file extension
            String contentType = "image/jpeg"; // Default
            if (fileName.toLowerCase().endsWith(".png")) {
                contentType = "image/png";
            } else if (fileName.toLowerCase().endsWith(".gif")) {
                contentType = "image/gif";
            }
            
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentLength(avatarContent.length);
            headers.setCacheControl("max-age=3600"); // Cache for 1 hour
            
            return ResponseEntity.ok()
                .headers(headers)
                .body(avatarContent);
                
        } catch (RuntimeException e) {
            logger.error("Avatar file not found: {}", fileName);
            return ResponseEntity.notFound().build();
            
        } catch (IOException e) {
            logger.error("Error reading avatar file {}: {}", fileName, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            
        } catch (Exception e) {
            logger.error("Error retrieving avatar {}: {}", fileName, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Delete user profile
     * DELETE /api/users/profile/{userId}
     */
    @DeleteMapping("/profile/{userId}")
    public ResponseEntity<Map<String, String>> deleteUserProfile(@PathVariable String userId) {
        try {
            logger.info("Deleting profile for user: {}", userId);
            
            userProfileService.deleteUserProfile(userId);
            
            return ResponseEntity.ok(Map.of(
                "message", "Profile deleted successfully",
                "userId", userId
            ));
            
        } catch (Exception e) {
            logger.error("Error deleting profile for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to delete profile"));
        }
    }
    
    /**
     * Get user preferences
     * GET /api/users/preferences/{userId}
     */
    @GetMapping("/preferences/{userId}")
    public ResponseEntity<UserProfile.Preferences> getUserPreferences(@PathVariable String userId) {
        try {
            logger.info("Fetching preferences for user: {}", userId);
            
            UserProfile.Preferences preferences = userProfileService.getUserPreferences(userId);
            
            return ResponseEntity.ok(preferences);
            
        } catch (Exception e) {
            logger.error("Error fetching preferences for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Update user preferences
     * PUT /api/users/preferences/{userId}
     */
    @PutMapping("/preferences/{userId}")
    public ResponseEntity<UserProfile.Preferences> updateUserPreferences(
            @PathVariable String userId,
            @Valid @RequestBody UserProfileRequest.PreferencesRequest request) {
        
        try {
            logger.info("Updating preferences for user: {}", userId);
            
            UserProfile.Preferences updatedPreferences = userProfileService.updateUserPreferences(userId, request);
            
            return ResponseEntity.ok(updatedPreferences);
            
        } catch (Exception e) {
            logger.error("Error updating preferences for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get profile statistics
     * GET /api/users/statistics
     */
    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getProfileStatistics() {
        try {
            logger.info("Fetching profile statistics");
            
            Map<String, Object> statistics = userProfileService.getProfileStatistics();
            
            return ResponseEntity.ok(statistics);
            
        } catch (Exception e) {
            logger.error("Error fetching profile statistics: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Validate profile data
     * POST /api/users/profile/validate
     */
    @PostMapping("/profile/validate")
    public ResponseEntity<Map<String, Object>> validateProfileData(
            @Valid @RequestBody UserProfileRequest request) {
        
        try {
            logger.info("Validating profile data");
            
            // Basic validation is handled by @Valid annotation
            // Additional custom validation can be added here
            
            return ResponseEntity.ok(Map.of(
                "valid", true,
                "message", "Profile data is valid"
            ));
            
        } catch (Exception e) {
            logger.error("Profile validation failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "valid", false,
                "error", e.getMessage()
            ));
        }
    }
    
    /**
     * Get profile completeness
     * GET /api/users/profile/{userId}/completeness
     */
    @GetMapping("/profile/{userId}/completeness")
    public ResponseEntity<Map<String, Object>> getProfileCompleteness(@PathVariable String userId) {
        try {
            logger.info("Fetching profile completeness for user: {}", userId);
            
            UserProfile profile = userProfileService.getUserProfile(userId);
            
            Map<String, Object> response = Map.of(
                "userId", userId,
                "completeness", profile.getProfileCompleteness() != null ? profile.getProfileCompleteness() : 0.0,
                "completenessPercentage", Math.round((profile.getProfileCompleteness() != null ? profile.getProfileCompleteness() : 0.0) * 100),
                "hasAvatar", profile.getAvatarUrl() != null,
                "lastUpdated", profile.getLastActiveAt() != null ? profile.getLastActiveAt().toString() : null
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error fetching profile completeness for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "timestamp", String.valueOf(System.currentTimeMillis()),
            "service", "user-profile"
        ));
    }
}