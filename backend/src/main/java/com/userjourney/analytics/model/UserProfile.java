package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;

public class UserProfile {
    
    @NotBlank(message = "User ID is required")
    @JsonProperty("userId")
    private String userId;
    
    @NotNull(message = "Created date is required")
    @JsonProperty("createdAt")
    private Instant createdAt;
    
    @JsonProperty("lastActiveAt")
    private Instant lastActiveAt;
    
    @JsonProperty("userSegment")
    private String userSegment;
    
    @JsonProperty("preferences")
    private Preferences preferences;
    
    @JsonProperty("behaviorMetrics")
    private BehaviorMetrics behaviorMetrics;
    
    @JsonProperty("riskFactors")
    private RiskFactors riskFactors;
    
    @JsonProperty("interventionHistory")
    private List<InterventionRecord> interventionHistory;
    
    // Additional profile fields
    @JsonProperty("firstName")
    private String firstName;
    
    @JsonProperty("lastName")
    private String lastName;
    
    @JsonProperty("email")
    private String email;
    
    @JsonProperty("phoneNumber")
    private String phoneNumber;
    
    @JsonProperty("dateOfBirth")
    private Instant dateOfBirth;
    
    @JsonProperty("avatarUrl")
    private String avatarUrl;
    
    @JsonProperty("address")
    private Address address;
    
    @JsonProperty("emergencyContact")
    private EmergencyContact emergencyContact;
    
    @JsonProperty("financialGoals")
    private List<String> financialGoals;
    
    @JsonProperty("riskTolerance")
    private String riskTolerance;
    
    @JsonProperty("annualIncome")
    private Double annualIncome;
    
    @JsonProperty("employmentStatus")
    private String employmentStatus;
    
    @JsonProperty("maritalStatus")
    private String maritalStatus;
    
    @JsonProperty("dependents")
    private Integer dependents;
    
    @JsonProperty("profileCompleteness")
    private Double profileCompleteness;
    
    // Constructors
    public UserProfile() {}
    
    public UserProfile(String userId, Instant createdAt) {
        this.userId = userId;
        this.createdAt = createdAt;
        this.userSegment = "new_user";
    }
    
    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    
    public Instant getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(Instant lastActiveAt) { this.lastActiveAt = lastActiveAt; }
    
    public String getUserSegment() { return userSegment; }
    public void setUserSegment(String userSegment) { this.userSegment = userSegment; }
    
    public Preferences getPreferences() { return preferences; }
    public void setPreferences(Preferences preferences) { this.preferences = preferences; }
    
    public BehaviorMetrics getBehaviorMetrics() { return behaviorMetrics; }
    public void setBehaviorMetrics(BehaviorMetrics behaviorMetrics) { this.behaviorMetrics = behaviorMetrics; }
    
    public RiskFactors getRiskFactors() { return riskFactors; }
    public void setRiskFactors(RiskFactors riskFactors) { this.riskFactors = riskFactors; }
    
    public List<InterventionRecord> getInterventionHistory() { return interventionHistory; }
    public void setInterventionHistory(List<InterventionRecord> interventionHistory) { this.interventionHistory = interventionHistory; }
    
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    
    public Instant getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(Instant dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    
    public Address getAddress() { return address; }
    public void setAddress(Address address) { this.address = address; }
    
    public EmergencyContact getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(EmergencyContact emergencyContact) { this.emergencyContact = emergencyContact; }
    
    public List<String> getFinancialGoals() { return financialGoals; }
    public void setFinancialGoals(List<String> financialGoals) { this.financialGoals = financialGoals; }
    
    public String getRiskTolerance() { return riskTolerance; }
    public void setRiskTolerance(String riskTolerance) { this.riskTolerance = riskTolerance; }
    
    public Double getAnnualIncome() { return annualIncome; }
    public void setAnnualIncome(Double annualIncome) { this.annualIncome = annualIncome; }
    
    public String getEmploymentStatus() { return employmentStatus; }
    public void setEmploymentStatus(String employmentStatus) { this.employmentStatus = employmentStatus; }
    
    public String getMaritalStatus() { return maritalStatus; }
    public void setMaritalStatus(String maritalStatus) { this.maritalStatus = maritalStatus; }
    
    public Integer getDependents() { return dependents; }
    public void setDependents(Integer dependents) { this.dependents = dependents; }
    
    public Double getProfileCompleteness() { return profileCompleteness; }
    public void setProfileCompleteness(Double profileCompleteness) { this.profileCompleteness = profileCompleteness; }
    
    // Inner classes
    public static class Address {
        private String street;
        private String city;
        private String state;
        private String zipCode;
        private String country;
        
        public Address() {}
        
        public String getStreet() { return street; }
        public void setStreet(String street) { this.street = street; }
        
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
        
        public String getState() { return state; }
        public void setState(String state) { this.state = state; }
        
        public String getZipCode() { return zipCode; }
        public void setZipCode(String zipCode) { this.zipCode = zipCode; }
        
        public String getCountry() { return country; }
        public void setCountry(String country) { this.country = country; }
    }
    
    public static class EmergencyContact {
        private String name;
        private String relationship;
        private String phoneNumber;
        private String email;
        
        public EmergencyContact() {}
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getRelationship() { return relationship; }
        public void setRelationship(String relationship) { this.relationship = relationship; }
        
        public String getPhoneNumber() { return phoneNumber; }
        public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
        
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
    }
    
    public static class Preferences {
        private List<String> contentCategories;
        private List<String> videoTopics;
        private String preferredInteractionStyle;
        
        // Getters and Setters
        public List<String> getContentCategories() { return contentCategories; }
        public void setContentCategories(List<String> contentCategories) { this.contentCategories = contentCategories; }
        
        public List<String> getVideoTopics() { return videoTopics; }
        public void setVideoTopics(List<String> videoTopics) { this.videoTopics = videoTopics; }
        
        public String getPreferredInteractionStyle() { return preferredInteractionStyle; }
        public void setPreferredInteractionStyle(String preferredInteractionStyle) { this.preferredInteractionStyle = preferredInteractionStyle; }
        
        // Additional preference fields
        private String theme;
        private String language;
        private Boolean emailNotifications;
        private Boolean smsNotifications;
        private Boolean marketingEmails;
        private String currency;
        private String timezone;
        private List<String> interestedTopics;
        
        public String getTheme() { return theme; }
        public void setTheme(String theme) { this.theme = theme; }
        
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
        
        public Boolean getEmailNotifications() { return emailNotifications; }
        public void setEmailNotifications(Boolean emailNotifications) { this.emailNotifications = emailNotifications; }
        
        public Boolean getSmsNotifications() { return smsNotifications; }
        public void setSmsNotifications(Boolean smsNotifications) { this.smsNotifications = smsNotifications; }
        
        public Boolean getMarketingEmails() { return marketingEmails; }
        public void setMarketingEmails(Boolean marketingEmails) { this.marketingEmails = marketingEmails; }
        
        public String getCurrency() { return currency; }
        public void setCurrency(String currency) { this.currency = currency; }
        
        public String getTimezone() { return timezone; }
        public void setTimezone(String timezone) { this.timezone = timezone; }
        
        public List<String> getInterestedTopics() { return interestedTopics; }
        public void setInterestedTopics(List<String> interestedTopics) { this.interestedTopics = interestedTopics; }
    }
    
    public static class BehaviorMetrics {
        private Integer totalSessions;
        private Double avgSessionDuration;
        private Double featureAdoptionRate;
        private Integer supportInteractionCount;
        
        // Getters and Setters
        public Integer getTotalSessions() { return totalSessions; }
        public void setTotalSessions(Integer totalSessions) { this.totalSessions = totalSessions; }
        
        public Double getAvgSessionDuration() { return avgSessionDuration; }
        public void setAvgSessionDuration(Double avgSessionDuration) { this.avgSessionDuration = avgSessionDuration; }
        
        public Double getFeatureAdoptionRate() { return featureAdoptionRate; }
        public void setFeatureAdoptionRate(Double featureAdoptionRate) { this.featureAdoptionRate = featureAdoptionRate; }
        
        public Integer getSupportInteractionCount() { return supportInteractionCount; }
        public void setSupportInteractionCount(Integer supportInteractionCount) { this.supportInteractionCount = supportInteractionCount; }
    }
    
    public static class RiskFactors {
        private Double exitRiskScore;
        private Instant lastRiskAssessment;
        private List<String> riskContributors;
        
        // Getters and Setters
        public Double getExitRiskScore() { return exitRiskScore; }
        public void setExitRiskScore(Double exitRiskScore) { this.exitRiskScore = exitRiskScore; }
        
        public Instant getLastRiskAssessment() { return lastRiskAssessment; }
        public void setLastRiskAssessment(Instant lastRiskAssessment) { this.lastRiskAssessment = lastRiskAssessment; }
        
        public List<String> getRiskContributors() { return riskContributors; }
        public void setRiskContributors(List<String> riskContributors) { this.riskContributors = riskContributors; }
    }
    
    public static class InterventionRecord {
        private String interventionId;
        private Instant triggeredAt;
        private String interventionType;
        private String context;
        private String effectiveness;
        private String userResponse;
        
        // Getters and Setters
        public String getInterventionId() { return interventionId; }
        public void setInterventionId(String interventionId) { this.interventionId = interventionId; }
        
        public Instant getTriggeredAt() { return triggeredAt; }
        public void setTriggeredAt(Instant triggeredAt) { this.triggeredAt = triggeredAt; }
        
        public String getInterventionType() { return interventionType; }
        public void setInterventionType(String interventionType) { this.interventionType = interventionType; }
        
        public String getContext() { return context; }
        public void setContext(String context) { this.context = context; }
        
        public String getEffectiveness() { return effectiveness; }
        public void setEffectiveness(String effectiveness) { this.effectiveness = effectiveness; }
        
        public String getUserResponse() { return userResponse; }
        public void setUserResponse(String userResponse) { this.userResponse = userResponse; }
    }
}