package com.userjourney.analytics.dto;

import java.time.Instant;
import java.util.Map;

/**
 * BigQuery Event Result DTO
 * 
 * Represents a single event retrieved from BigQuery Firebase Analytics export
 */
public class BigQueryEventResult {
    private String eventName;
    private Instant eventTimestamp;
    private String userPseudoId;
    private String userId;
    private Map<String, Object> eventParams;
    private Map<String, Object> userProperties;
    private DeviceInfo device;
    private GeoInfo geo;

    public static class DeviceInfo {
        private String category;
        private String operatingSystem;
        private String language;

        public DeviceInfo() {}

        public DeviceInfo(String category, String operatingSystem, String language) {
            this.category = category;
            this.operatingSystem = operatingSystem;
            this.language = language;
        }

        // Getters and setters
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public String getOperatingSystem() { return operatingSystem; }
        public void setOperatingSystem(String operatingSystem) { this.operatingSystem = operatingSystem; }
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
    }

    public static class GeoInfo {
        private String country;
        private String region;
        private String city;

        public GeoInfo() {}

        public GeoInfo(String country, String region, String city) {
            this.country = country;
            this.region = region;
            this.city = city;
        }

        // Getters and setters
        public String getCountry() { return country; }
        public void setCountry(String country) { this.country = country; }
        public String getRegion() { return region; }
        public void setRegion(String region) { this.region = region; }
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
    }

    // Constructors
    public BigQueryEventResult() {}

    // Getters and setters
    public String getEventName() { return eventName; }
    public void setEventName(String eventName) { this.eventName = eventName; }

    public Instant getEventTimestamp() { return eventTimestamp; }
    public void setEventTimestamp(Instant eventTimestamp) { this.eventTimestamp = eventTimestamp; }

    public String getUserPseudoId() { return userPseudoId; }
    public void setUserPseudoId(String userPseudoId) { this.userPseudoId = userPseudoId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public Map<String, Object> getEventParams() { return eventParams; }
    public void setEventParams(Map<String, Object> eventParams) { this.eventParams = eventParams; }

    public Map<String, Object> getUserProperties() { return userProperties; }
    public void setUserProperties(Map<String, Object> userProperties) { this.userProperties = userProperties; }

    public DeviceInfo getDevice() { return device; }
    public void setDevice(DeviceInfo device) { this.device = device; }

    public GeoInfo getGeo() { return geo; }
    public void setGeo(GeoInfo geo) { this.geo = geo; }
}
