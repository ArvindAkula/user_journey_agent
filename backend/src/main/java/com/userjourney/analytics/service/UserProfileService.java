package com.userjourney.analytics.service;

import com.userjourney.analytics.model.UserProfile;
import com.userjourney.analytics.dto.UserProfileRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserProfileService {
    
    private static final Logger logger = LoggerFactory.getLogger(UserProfileService.class);
    
    // In-memory storage for demo purposes - in production, this would use DynamoDB
    private final Map<String, UserProfile> profileStorage = new HashMap<>();
    
    // Avatar storage directory
    private final String avatarDirectory = "uploads/avatars/";
    
    // Allowed avatar file types
    private static final Set<String> ALLOWED_AVATAR_TYPES = Set.of(
        "image/jpeg", "image/jpg", "image/png", "image/gif"
    );
    
    // Maximum avatar file size: 2MB
    private static final long MAX_AVATAR_SIZE = 2 * 1024 * 1024;
    
    public UserProfileService() {
        // Create avatar directory if it doesn't exist
        try {
            Path avatarPath = Paths.get(avatarDirectory);
            if (!Files.exists(avatarPath)) {
                Files.createDirectories(avatarPath);
                logger.info("Created avatar directory: {}", avatarDirectory);
            }
        } catch (IOException e) {
            logger.error("Failed to create avatar directory: {}", e.getMessage(), e);
        }
        
        // Initialize demo profiles
        initializeDemoProfiles();
    }
    
    /**
     * Get user profile by ID
     */
    public UserProfile getUserProfile(String userId) {
        logger.info("Fetching profile for user: {}", userId);
        
        UserProfile profile = profileStorage.get(userId);
        if (profile == null) {
            // Create a new profile if it doesn't exist
            profile = createDefaultProfile(userId);
            profileStorage.put(userId, profile);
            logger.info("Created new profile for user: {}", userId);
        }
        
        return profile;
    }
    
    /**
     * Update user profile
     */
    public UserProfile updateUserProfile(String userId, UserProfileRequest request) {
        logger.info("Updating profile for user: {}", userId);
        
        UserProfile profile = getUserProfile(userId);
        
        // Update basic information
        if (request.getFirstName() != null) {
            profile.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            profile.setLastName(request.getLastName());
        }
        if (request.getEmail() != null) {
            profile.setEmail(request.getEmail());
        }
        if (request.getPhoneNumber() != null) {
            profile.setPhoneNumber(request.getPhoneNumber());
        }
        
        // Update date of birth
        if (request.getDateOfBirth() != null) {
            try {
                LocalDate birthDate = LocalDate.parse(request.getDateOfBirth(), DateTimeFormatter.ISO_LOCAL_DATE);
                profile.setDateOfBirth(birthDate.atStartOfDay(ZoneId.systemDefault()).toInstant());
            } catch (Exception e) {
                logger.error("Invalid date format for date of birth: {}", request.getDateOfBirth());
                throw new IllegalArgumentException("Invalid date format. Use YYYY-MM-DD format.");
            }
        }
        
        // Update address
        if (request.getAddress() != null) {
            UserProfile.Address address = new UserProfile.Address();
            address.setStreet(request.getAddress().getStreet());
            address.setCity(request.getAddress().getCity());
            address.setState(request.getAddress().getState());
            address.setZipCode(request.getAddress().getZipCode());
            address.setCountry(request.getAddress().getCountry());
            profile.setAddress(address);
        }
        
        // Update preferences
        if (request.getPreferences() != null) {
            UserProfile.Preferences preferences = profile.getPreferences();
            if (preferences == null) {
                preferences = new UserProfile.Preferences();
                profile.setPreferences(preferences);
            }
            
            if (request.getPreferences().getTheme() != null) {
                preferences.setTheme(request.getPreferences().getTheme());
            }
            if (request.getPreferences().getLanguage() != null) {
                preferences.setLanguage(request.getPreferences().getLanguage());
            }
            if (request.getPreferences().getEmailNotifications() != null) {
                preferences.setEmailNotifications(request.getPreferences().getEmailNotifications());
            }
            if (request.getPreferences().getSmsNotifications() != null) {
                preferences.setSmsNotifications(request.getPreferences().getSmsNotifications());
            }
            if (request.getPreferences().getMarketingEmails() != null) {
                preferences.setMarketingEmails(request.getPreferences().getMarketingEmails());
            }
            if (request.getPreferences().getCurrency() != null) {
                preferences.setCurrency(request.getPreferences().getCurrency());
            }
            if (request.getPreferences().getTimezone() != null) {
                preferences.setTimezone(request.getPreferences().getTimezone());
            }
            if (request.getPreferences().getInterestedTopics() != null) {
                preferences.setInterestedTopics(request.getPreferences().getInterestedTopics());
            }
        }
        
        // Update emergency contact
        if (request.getEmergencyContact() != null) {
            UserProfile.EmergencyContact emergencyContact = new UserProfile.EmergencyContact();
            emergencyContact.setName(request.getEmergencyContact().getName());
            emergencyContact.setRelationship(request.getEmergencyContact().getRelationship());
            emergencyContact.setPhoneNumber(request.getEmergencyContact().getPhoneNumber());
            emergencyContact.setEmail(request.getEmergencyContact().getEmail());
            profile.setEmergencyContact(emergencyContact);
        }
        
        // Update financial information
        if (request.getFinancialGoals() != null) {
            profile.setFinancialGoals(request.getFinancialGoals());
        }
        if (request.getRiskTolerance() != null) {
            profile.setRiskTolerance(request.getRiskTolerance());
        }
        if (request.getAnnualIncome() != null) {
            profile.setAnnualIncome(request.getAnnualIncome());
        }
        if (request.getEmploymentStatus() != null) {
            profile.setEmploymentStatus(request.getEmploymentStatus());
        }
        if (request.getMaritalStatus() != null) {
            profile.setMaritalStatus(request.getMaritalStatus());
        }
        if (request.getDependents() != null) {
            profile.setDependents(request.getDependents());
        }
        
        // Update last active time
        profile.setLastActiveAt(Instant.now());
        
        // Calculate and update profile completeness
        profile.setProfileCompleteness(calculateProfileCompleteness(profile));
        
        logger.info("Successfully updated profile for user: {}", userId);
        return profile;
    }
    
    /**
     * Upload user avatar
     */
    public String uploadAvatar(String userId, MultipartFile file) throws IOException {
        logger.info("Uploading avatar for user: {}, fileName: {}", userId, file.getOriginalFilename());
        
        // Validate avatar file
        validateAvatarFile(file);
        
        UserProfile profile = getUserProfile(userId);
        
        // Generate unique file name
        String fileExtension = getFileExtension(file.getOriginalFilename());
        String avatarFileName = userId + "_" + System.currentTimeMillis() + fileExtension;
        
        try {
            // Save file to local storage (in production, this would be S3)
            Path filePath = Paths.get(avatarDirectory, avatarFileName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            
            // Delete old avatar if exists
            if (profile.getAvatarUrl() != null) {
                deleteOldAvatar(profile.getAvatarUrl());
            }
            
            // Update profile with new avatar URL
            String avatarUrl = "/api/users/avatar/" + avatarFileName;
            profile.setAvatarUrl(avatarUrl);
            profile.setLastActiveAt(Instant.now());
            
            logger.info("Successfully uploaded avatar for user: {}", userId);
            return avatarUrl;
            
        } catch (Exception e) {
            logger.error("Failed to upload avatar for user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Failed to upload avatar: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get avatar file
     */
    public byte[] getAvatarFile(String fileName) throws IOException {
        logger.info("Retrieving avatar file: {}", fileName);
        
        Path filePath = Paths.get(avatarDirectory, fileName);
        if (!Files.exists(filePath)) {
            throw new RuntimeException("Avatar file not found: " + fileName);
        }
        
        return Files.readAllBytes(filePath);
    }
    
    /**
     * Delete user profile
     */
    public void deleteUserProfile(String userId) {
        logger.info("Deleting profile for user: {}", userId);
        
        UserProfile profile = profileStorage.get(userId);
        if (profile != null) {
            // Delete avatar file if exists
            if (profile.getAvatarUrl() != null) {
                deleteOldAvatar(profile.getAvatarUrl());
            }
            
            // Remove profile from storage
            profileStorage.remove(userId);
            
            logger.info("Successfully deleted profile for user: {}", userId);
        }
    }
    
    /**
     * Get user preferences
     */
    public UserProfile.Preferences getUserPreferences(String userId) {
        logger.info("Fetching preferences for user: {}", userId);
        
        UserProfile profile = getUserProfile(userId);
        UserProfile.Preferences preferences = profile.getPreferences();
        
        if (preferences == null) {
            preferences = createDefaultPreferences();
            profile.setPreferences(preferences);
        }
        
        return preferences;
    }
    
    /**
     * Update user preferences
     */
    public UserProfile.Preferences updateUserPreferences(String userId, UserProfileRequest.PreferencesRequest request) {
        logger.info("Updating preferences for user: {}", userId);
        
        UserProfile profile = getUserProfile(userId);
        UserProfile.Preferences preferences = profile.getPreferences();
        
        if (preferences == null) {
            preferences = new UserProfile.Preferences();
            profile.setPreferences(preferences);
        }
        
        // Update preferences
        if (request.getTheme() != null) {
            preferences.setTheme(request.getTheme());
        }
        if (request.getLanguage() != null) {
            preferences.setLanguage(request.getLanguage());
        }
        if (request.getEmailNotifications() != null) {
            preferences.setEmailNotifications(request.getEmailNotifications());
        }
        if (request.getSmsNotifications() != null) {
            preferences.setSmsNotifications(request.getSmsNotifications());
        }
        if (request.getMarketingEmails() != null) {
            preferences.setMarketingEmails(request.getMarketingEmails());
        }
        if (request.getCurrency() != null) {
            preferences.setCurrency(request.getCurrency());
        }
        if (request.getTimezone() != null) {
            preferences.setTimezone(request.getTimezone());
        }
        if (request.getInterestedTopics() != null) {
            preferences.setInterestedTopics(request.getInterestedTopics());
        }
        
        profile.setLastActiveAt(Instant.now());
        
        logger.info("Successfully updated preferences for user: {}", userId);
        return preferences;
    }
    
    /**
     * Get profile statistics
     */
    public Map<String, Object> getProfileStatistics() {
        logger.info("Fetching profile statistics");
        
        List<UserProfile> allProfiles = new ArrayList<>(profileStorage.values());
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProfiles", allProfiles.size());
        
        if (!allProfiles.isEmpty()) {
            // Average profile completeness
            double avgCompleteness = allProfiles.stream()
                .filter(p -> p.getProfileCompleteness() != null)
                .mapToDouble(UserProfile::getProfileCompleteness)
                .average().orElse(0.0);
            stats.put("averageCompleteness", avgCompleteness);
            
            // Employment status distribution
            Map<String, Long> employmentDistribution = allProfiles.stream()
                .collect(Collectors.groupingBy(
                    p -> p.getEmploymentStatus() != null ? p.getEmploymentStatus() : "unknown",
                    Collectors.counting()
                ));
            stats.put("employmentDistribution", employmentDistribution);
            
            // Risk tolerance distribution
            Map<String, Long> riskDistribution = allProfiles.stream()
                .collect(Collectors.groupingBy(
                    p -> p.getRiskTolerance() != null ? p.getRiskTolerance() : "unknown",
                    Collectors.counting()
                ));
            stats.put("riskToleranceDistribution", riskDistribution);
            
            // Profiles with avatars
            long profilesWithAvatars = allProfiles.stream()
                .filter(p -> p.getAvatarUrl() != null)
                .count();
            stats.put("profilesWithAvatars", profilesWithAvatars);
        }
        
        return stats;
    }
    
    /**
     * Create default profile for new user
     */
    private UserProfile createDefaultProfile(String userId) {
        UserProfile profile = new UserProfile(userId, Instant.now());
        profile.setUserSegment("new_user");
        profile.setPreferences(createDefaultPreferences());
        profile.setProfileCompleteness(0.1); // Basic profile created
        return profile;
    }
    
    /**
     * Create default preferences
     */
    private UserProfile.Preferences createDefaultPreferences() {
        UserProfile.Preferences preferences = new UserProfile.Preferences();
        preferences.setTheme("light");
        preferences.setLanguage("en");
        preferences.setEmailNotifications(true);
        preferences.setSmsNotifications(false);
        preferences.setMarketingEmails(false);
        preferences.setCurrency("USD");
        preferences.setTimezone("America/New_York");
        preferences.setInterestedTopics(Arrays.asList("financial-planning", "investment"));
        return preferences;
    }
    
    /**
     * Calculate profile completeness percentage
     */
    private double calculateProfileCompleteness(UserProfile profile) {
        int totalFields = 15; // Total number of important fields
        int completedFields = 0;
        
        if (profile.getFirstName() != null && !profile.getFirstName().isEmpty()) completedFields++;
        if (profile.getLastName() != null && !profile.getLastName().isEmpty()) completedFields++;
        if (profile.getEmail() != null && !profile.getEmail().isEmpty()) completedFields++;
        if (profile.getPhoneNumber() != null && !profile.getPhoneNumber().isEmpty()) completedFields++;
        if (profile.getDateOfBirth() != null) completedFields++;
        if (profile.getAddress() != null) completedFields++;
        if (profile.getEmergencyContact() != null) completedFields++;
        if (profile.getFinancialGoals() != null && !profile.getFinancialGoals().isEmpty()) completedFields++;
        if (profile.getRiskTolerance() != null) completedFields++;
        if (profile.getAnnualIncome() != null) completedFields++;
        if (profile.getEmploymentStatus() != null) completedFields++;
        if (profile.getMaritalStatus() != null) completedFields++;
        if (profile.getDependents() != null) completedFields++;
        if (profile.getAvatarUrl() != null) completedFields++;
        if (profile.getPreferences() != null) completedFields++;
        
        return (double) completedFields / totalFields;
    }
    
    /**
     * Validate avatar file
     */
    private void validateAvatarFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Avatar file is empty");
        }
        
        if (file.getSize() > MAX_AVATAR_SIZE) {
            throw new IllegalArgumentException("Avatar file size exceeds maximum limit of 2MB");
        }
        
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_AVATAR_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Avatar file type not allowed. Use JPEG, PNG, or GIF.");
        }
    }
    
    /**
     * Get file extension from filename
     */
    private String getFileExtension(String fileName) {
        if (fileName != null && fileName.contains(".")) {
            return fileName.substring(fileName.lastIndexOf("."));
        }
        return ".jpg"; // Default extension
    }
    
    /**
     * Delete old avatar file
     */
    private void deleteOldAvatar(String avatarUrl) {
        try {
            if (avatarUrl != null && avatarUrl.contains("/")) {
                String fileName = avatarUrl.substring(avatarUrl.lastIndexOf("/") + 1);
                Path filePath = Paths.get(avatarDirectory, fileName);
                if (Files.exists(filePath)) {
                    Files.delete(filePath);
                    logger.info("Deleted old avatar file: {}", fileName);
                }
            }
        } catch (IOException e) {
            logger.error("Failed to delete old avatar file: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Initialize demo profiles for testing
     */
    private void initializeDemoProfiles() {
        logger.info("Initializing demo profiles");
        
        // Create demo profiles for different user personas
        createDemoProfile("user-sarah", "Sarah", "Johnson", "sarah.johnson@email.com", "employed", "medium");
        createDemoProfile("user-mike", "Mike", "Chen", "mike.chen@email.com", "self-employed", "high");
        createDemoProfile("user-jenny", "Jenny", "Williams", "jenny.williams@email.com", "employed", "low");
        createDemoProfile("user-alex", "Alex", "Rodriguez", "alex.rodriguez@email.com", "student", "medium");
        
        logger.info("Initialized {} demo profiles", profileStorage.size());
    }
    
    /**
     * Helper method to create demo profiles
     */
    private void createDemoProfile(String userId, String firstName, String lastName, String email, 
                                 String employmentStatus, String riskTolerance) {
        UserProfile profile = new UserProfile(userId, Instant.now().minusSeconds(86400 * 30)); // 30 days ago
        profile.setFirstName(firstName);
        profile.setLastName(lastName);
        profile.setEmail(email);
        profile.setEmploymentStatus(employmentStatus);
        profile.setRiskTolerance(riskTolerance);
        profile.setUserSegment("active_user");
        profile.setPreferences(createDefaultPreferences());
        profile.setFinancialGoals(Arrays.asList("retirement", "emergency-fund", "investment"));
        profile.setProfileCompleteness(0.8);
        profile.setLastActiveAt(Instant.now().minusSeconds(3600)); // 1 hour ago
        
        profileStorage.put(userId, profile);
    }
}