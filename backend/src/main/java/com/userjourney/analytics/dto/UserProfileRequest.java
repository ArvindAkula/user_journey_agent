package com.userjourney.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public class UserProfileRequest {
    
    @NotBlank(message = "First name is required")
    @Size(max = 50, message = "First name cannot exceed 50 characters")
    @JsonProperty("firstName")
    private String firstName;
    
    @NotBlank(message = "Last name is required")
    @Size(max = 50, message = "Last name cannot exceed 50 characters")
    @JsonProperty("lastName")
    private String lastName;
    
    @Email(message = "Invalid email format")
    @JsonProperty("email")
    private String email;
    
    @JsonProperty("phoneNumber")
    @Size(max = 20, message = "Phone number cannot exceed 20 characters")
    private String phoneNumber;
    
    @JsonProperty("dateOfBirth")
    private String dateOfBirth; // ISO date string
    
    @JsonProperty("address")
    private AddressRequest address;
    
    @JsonProperty("preferences")
    private PreferencesRequest preferences;
    
    @JsonProperty("emergencyContact")
    private EmergencyContactRequest emergencyContact;
    
    @JsonProperty("financialGoals")
    private List<String> financialGoals;
    
    @JsonProperty("riskTolerance")
    private String riskTolerance; // "low", "medium", "high"
    
    @JsonProperty("annualIncome")
    private Double annualIncome;
    
    @JsonProperty("employmentStatus")
    private String employmentStatus; // "employed", "self-employed", "unemployed", "retired", "student"
    
    @JsonProperty("maritalStatus")
    private String maritalStatus; // "single", "married", "divorced", "widowed"
    
    @JsonProperty("dependents")
    private Integer dependents;
    
    // Constructors
    public UserProfileRequest() {}
    
    // Getters and Setters
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    
    public String getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(String dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    
    public AddressRequest getAddress() { return address; }
    public void setAddress(AddressRequest address) { this.address = address; }
    
    public PreferencesRequest getPreferences() { return preferences; }
    public void setPreferences(PreferencesRequest preferences) { this.preferences = preferences; }
    
    public EmergencyContactRequest getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(EmergencyContactRequest emergencyContact) { this.emergencyContact = emergencyContact; }
    
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
    
    // Inner classes
    public static class AddressRequest {
        private String street;
        private String city;
        private String state;
        private String zipCode;
        private String country;
        
        public AddressRequest() {}
        
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
    
    public static class PreferencesRequest {
        private String theme; // "light", "dark", "auto"
        private String language; // "en", "es", "fr", etc.
        private Boolean emailNotifications;
        private Boolean smsNotifications;
        private Boolean marketingEmails;
        private String currency; // "USD", "EUR", "GBP", etc.
        private String timezone;
        private List<String> interestedTopics;
        
        public PreferencesRequest() {}
        
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
    
    public static class EmergencyContactRequest {
        private String name;
        private String relationship;
        private String phoneNumber;
        private String email;
        
        public EmergencyContactRequest() {}
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getRelationship() { return relationship; }
        public void setRelationship(String relationship) { this.relationship = relationship; }
        
        public String getPhoneNumber() { return phoneNumber; }
        public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
        
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
    }
}