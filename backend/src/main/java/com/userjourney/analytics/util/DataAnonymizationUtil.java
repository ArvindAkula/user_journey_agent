package com.userjourney.analytics.util;

import com.userjourney.analytics.service.DataEncryptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;

@Component
public class DataAnonymizationUtil {

    @Autowired
    private DataEncryptionService dataEncryptionService;

    private static final SecureRandom secureRandom = new SecureRandom();
    
    // Regex patterns for PII detection
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"
    );
    
    private static final Pattern PHONE_PATTERN = Pattern.compile(
        "\\b(?:\\+?1[-.]?)?\\(?([0-9]{3})\\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\\b"
    );
    
    private static final Pattern SSN_PATTERN = Pattern.compile(
        "\\b(?!000|666|9\\d{2})\\d{3}-?(?!00)\\d{2}-?(?!0000)\\d{4}\\b"
    );

    /**
     * Anonymizes personally identifiable information in text
     */
    public String anonymizePII(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }

        String anonymized = text;
        
        // Replace emails with anonymized versions
        anonymized = EMAIL_PATTERN.matcher(anonymized).replaceAll(match -> 
            "user" + generateAnonymousId() + "@example.com"
        );
        
        // Replace phone numbers
        anonymized = PHONE_PATTERN.matcher(anonymized).replaceAll("XXX-XXX-XXXX");
        
        // Replace SSNs
        anonymized = SSN_PATTERN.matcher(anonymized).replaceAll("XXX-XX-XXXX");
        
        return anonymized;
    }

    /**
     * Creates a consistent anonymous ID for a given input
     */
    public String createAnonymousId(String input) {
        return dataEncryptionService.anonymizeData(input);
    }

    /**
     * Generates a random anonymous identifier
     */
    public String generateAnonymousId() {
        byte[] randomBytes = new byte[8];
        secureRandom.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    /**
     * Anonymizes user profile data while preserving analytical value
     */
    public UserProfileAnonymized anonymizeUserProfile(Object userProfile) {
        // This would contain logic to anonymize specific user profile fields
        // while preserving data needed for analytics
        return new UserProfileAnonymized();
    }

    /**
     * Anonymizes event data
     */
    public String anonymizeEventData(String eventData) {
        if (eventData == null) {
            return null;
        }
        
        // Remove or hash PII from event data
        String anonymized = anonymizePII(eventData);
        
        // Additional anonymization logic for specific event fields
        return anonymized;
    }

    /**
     * Checks if data contains PII
     */
    public boolean containsPII(String data) {
        if (data == null || data.isEmpty()) {
            return false;
        }
        
        return EMAIL_PATTERN.matcher(data).find() ||
               PHONE_PATTERN.matcher(data).find() ||
               SSN_PATTERN.matcher(data).find();
    }

    /**
     * Creates a differential privacy noise value
     */
    public double addDifferentialPrivacyNoise(double value, double epsilon) {
        // Laplace mechanism for differential privacy
        double scale = 1.0 / epsilon;
        double u = secureRandom.nextDouble() - 0.5;
        double noise = -scale * Math.signum(u) * Math.log(1 - 2 * Math.abs(u));
        return value + noise;
    }

    /**
     * Anonymizes IP addresses by removing the last octet
     */
    public String anonymizeIpAddress(String ipAddress) {
        if (ipAddress == null || ipAddress.isEmpty()) {
            return ipAddress;
        }
        
        // For IPv4, replace last octet with 0
        if (ipAddress.contains(".")) {
            String[] parts = ipAddress.split("\\.");
            if (parts.length == 4) {
                return parts[0] + "." + parts[1] + "." + parts[2] + ".0";
            }
        }
        
        // For IPv6, replace last 64 bits with zeros
        if (ipAddress.contains(":")) {
            String[] parts = ipAddress.split(":");
            if (parts.length >= 4) {
                StringBuilder anonymized = new StringBuilder();
                for (int i = 0; i < Math.min(4, parts.length); i++) {
                    if (i > 0) anonymized.append(":");
                    anonymized.append(parts[i]);
                }
                anonymized.append("::0");
                return anonymized.toString();
            }
        }
        
        return ipAddress;
    }

    /**
     * Anonymizes user agent strings by removing specific version information
     */
    public String anonymizeUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isEmpty()) {
            return userAgent;
        }
        
        // Remove specific version numbers while keeping general browser/OS info
        return userAgent.replaceAll("\\d+\\.\\d+\\.\\d+", "X.X.X");
    }

    /**
     * Data class for anonymized user profiles
     */
    public static class UserProfileAnonymized {
        private String anonymousId;
        private String userSegment;
        private Double engagementScore;
        private Integer sessionCount;
        // Other non-PII fields that are safe for analytics
        
        // Getters and setters
        public String getAnonymousId() { return anonymousId; }
        public void setAnonymousId(String anonymousId) { this.anonymousId = anonymousId; }
        
        public String getUserSegment() { return userSegment; }
        public void setUserSegment(String userSegment) { this.userSegment = userSegment; }
        
        public Double getEngagementScore() { return engagementScore; }
        public void setEngagementScore(Double engagementScore) { this.engagementScore = engagementScore; }
        
        public Integer getSessionCount() { return sessionCount; }
        public void setSessionCount(Integer sessionCount) { this.sessionCount = sessionCount; }
    }
}