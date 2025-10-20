package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class DemoManagementService {

    private static final Logger logger = LoggerFactory.getLogger(DemoManagementService.class);
    
    @Autowired
    private DynamoDbClient dynamoDbClient;
    
    @Autowired
    private DataSeedingService dataSeedingService;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    private static final String COST_TRACKING_FILE = "logs/demo-costs.json";
    private static final String HEALTH_CHECK_FILE = "logs/health-check.json";
    private static final String BACKUP_DIR = "backups/demo-data";
    
    // Cost estimates per hour (in USD)
    private static final Map<String, Double> SERVICE_COSTS = Map.of(
        "lambda", 2.00,
        "dynamodb", 1.50,
        "kinesis", 3.00,
        "bedrock", 4.00,
        "sagemaker", 2.00
    );
    
    private static final double TOTAL_HOURLY_COST = SERVICE_COSTS.values().stream()
        .mapToDouble(Double::doubleValue)
        .sum();

    public Map<String, Object> getHealthStatus() {
        Map<String, Object> healthStatus = new HashMap<>();
        List<String> issues = new ArrayList<>();
        
        try {
            // Check DynamoDB tables
            boolean dynamoHealthy = checkDynamoDbHealth();
            
            // Check backend health (always healthy if this method is called)
            boolean backendHealthy = true;
            
            // Check frontend health (assume healthy for demo)
            boolean frontendHealthy = true;
            
            Map<String, String> services = new HashMap<>();
            services.put("frontend", frontendHealthy ? "healthy" : "unhealthy");
            services.put("backend", backendHealthy ? "healthy" : "unhealthy");
            services.put("dynamodb", dynamoHealthy ? "healthy" : "unhealthy");
            
            if (!dynamoHealthy) {
                issues.add("DynamoDB tables not accessible");
            }
            
            String overallStatus = issues.isEmpty() ? "healthy" : "unhealthy";
            
            healthStatus.put("timestamp", Instant.now().toString());
            healthStatus.put("status", overallStatus);
            healthStatus.put("issues", issues);
            healthStatus.put("services", services);
            
            // Save health check to file
            saveHealthCheckToFile(healthStatus);
            
        } catch (Exception e) {
            logger.error("Error checking health status", e);
            healthStatus.put("status", "unhealthy");
            healthStatus.put("issues", List.of("Health check failed: " + e.getMessage()));
        }
        
        return healthStatus;
    }

    public Map<String, Object> getCostTracking() {
        try {
            Path costFile = Paths.get(COST_TRACKING_FILE);
            if (Files.exists(costFile)) {
                String content = Files.readString(costFile);
                Map<String, Object> costData = objectMapper.readValue(content, Map.class);
                
                // Calculate current cost if session is active
                if (costData.containsKey("startTime") && !costData.containsKey("stopTime")) {
                    Instant startTime = Instant.parse((String) costData.get("startTime"));
                    Instant now = Instant.now();
                    double hoursElapsed = ChronoUnit.SECONDS.between(startTime, now) / 3600.0;
                    double currentCost = hoursElapsed * TOTAL_HOURLY_COST;
                    
                    costData.put("currentCost", Math.round(currentCost * 100.0) / 100.0);
                    costData.put("hoursElapsed", Math.round(hoursElapsed * 100.0) / 100.0);
                }
                
                return costData;
            } else {
                return createDefaultCostTracking();
            }
        } catch (Exception e) {
            logger.error("Error getting cost tracking", e);
            return createDefaultCostTracking();
        }
    }

    public Map<String, Object> resetDemoData() {
        try {
            logger.info("Resetting demo data...");
            
            // Clear DynamoDB tables
            clearDynamoDbTables();
            
            // Reseed with fresh data
            dataSeedingService.seedSampleUsers(10);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Demo data reset successfully");
            result.put("timestamp", Instant.now().toString());
            
            logger.info("Demo data reset completed");
            return result;
            
        } catch (Exception e) {
            logger.error("Error resetting demo data", e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> backupDemoData() {
        try {
            logger.info("Backing up demo data...");
            
            String backupId = UUID.randomUUID().toString();
            String timestamp = Instant.now().toString().replace(":", "-");
            String backupFileName = String.format("demo_backup_%s_%s.json", timestamp, backupId);
            
            // Create backup directory if it doesn't exist
            Path backupDir = Paths.get(BACKUP_DIR);
            Files.createDirectories(backupDir);
            
            Map<String, Object> backupData = new HashMap<>();
            backupData.put("backupId", backupId);
            backupData.put("timestamp", Instant.now().toString());
            backupData.put("environment", "demo");
            
            // Export DynamoDB data
            Map<String, Object> tableData = new HashMap<>();
            try {
                tableData.put("userProfiles", exportDynamoDbTable("UserProfiles-demo"));
                tableData.put("userEvents", exportDynamoDbTable("UserEvents-demo"));
                tableData.put("struggleSignals", exportDynamoDbTable("StruggleSignals-demo"));
            } catch (Exception e) {
                logger.warn("Some tables may not exist yet: " + e.getMessage());
            }
            
            backupData.put("tables", tableData);
            
            // Save backup file
            Path backupFile = backupDir.resolve(backupFileName);
            objectMapper.writeValue(backupFile.toFile(), backupData);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("backupId", backupId);
            result.put("backupFile", backupFile.toString());
            result.put("timestamp", Instant.now().toString());
            
            logger.info("Demo data backed up successfully: {}", backupFile);
            return result;
            
        } catch (Exception e) {
            logger.error("Error backing up demo data", e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> restoreDemoData(String backupId) {
        try {
            logger.info("Restoring demo data from backup: {}", backupId);
            
            // Find backup file
            Path backupDir = Paths.get(BACKUP_DIR);
            Optional<Path> backupFile = Files.list(backupDir)
                .filter(path -> path.getFileName().toString().contains(backupId))
                .findFirst();
            
            if (backupFile.isEmpty()) {
                throw new RuntimeException("Backup file not found for ID: " + backupId);
            }
            
            // Load backup data
            Map<String, Object> backupData = objectMapper.readValue(backupFile.get().toFile(), Map.class);
            Map<String, Object> tableData = (Map<String, Object>) backupData.get("tables");
            
            // Clear existing data
            clearDynamoDbTables();
            
            // Restore data to tables
            if (tableData != null) {
                restoreDynamoDbTable("UserProfiles-demo", (List<Map<String, Object>>) tableData.get("userProfiles"));
                restoreDynamoDbTable("UserEvents-demo", (List<Map<String, Object>>) tableData.get("userEvents"));
                restoreDynamoDbTable("StruggleSignals-demo", (List<Map<String, Object>>) tableData.get("struggleSignals"));
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Demo data restored successfully");
            result.put("backupId", backupId);
            result.put("timestamp", Instant.now().toString());
            
            logger.info("Demo data restored successfully from backup: {}", backupId);
            return result;
            
        } catch (Exception e) {
            logger.error("Error restoring demo data", e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> getDemoStatus() {
        Map<String, Object> status = new HashMap<>();
        
        try {
            // Get health status
            Map<String, Object> health = getHealthStatus();
            status.put("health", health);
            
            // Get cost tracking
            Map<String, Object> costs = getCostTracking();
            status.put("costs", costs);
            
            // Get session info
            status.put("sessionActive", costs.containsKey("startTime") && !costs.containsKey("stopTime"));
            status.put("timestamp", Instant.now().toString());
            
        } catch (Exception e) {
            logger.error("Error getting demo status", e);
            status.put("error", e.getMessage());
        }
        
        return status;
    }

    public Map<String, Object> startDemoSession(Map<String, Object> sessionConfig) {
        try {
            logger.info("Starting demo session with config: {}", sessionConfig);
            
            String sessionId = UUID.randomUUID().toString();
            Instant startTime = Instant.now();
            
            Map<String, Object> costTracking = new HashMap<>();
            costTracking.put("sessionId", sessionId);
            costTracking.put("startTime", startTime.toString());
            costTracking.put("environment", "demo");
            costTracking.put("estimatedHourlyCost", TOTAL_HOURLY_COST);
            
            Map<String, Object> services = new HashMap<>();
            SERVICE_COSTS.forEach((service, cost) -> {
                Map<String, Object> serviceInfo = new HashMap<>();
                serviceInfo.put("estimatedCost", cost);
                serviceInfo.put("unit", "hour");
                services.put(service, serviceInfo);
            });
            costTracking.put("services", services);
            costTracking.put("actualCosts", new ArrayList<>());
            
            // Save cost tracking
            saveCostTrackingToFile(costTracking);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("sessionId", sessionId);
            result.put("startTime", startTime.toString());
            result.put("message", "Demo session started successfully");
            
            return result;
            
        } catch (Exception e) {
            logger.error("Error starting demo session", e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> stopDemoSession() {
        try {
            logger.info("Stopping demo session...");
            
            Map<String, Object> costTracking = getCostTracking();
            Instant stopTime = Instant.now();
            
            if (costTracking.containsKey("startTime")) {
                Instant startTime = Instant.parse((String) costTracking.get("startTime"));
                double durationHours = ChronoUnit.SECONDS.between(startTime, stopTime) / 3600.0;
                double totalCost = durationHours * TOTAL_HOURLY_COST;
                
                costTracking.put("stopTime", stopTime.toString());
                costTracking.put("durationHours", Math.round(durationHours * 100.0) / 100.0);
                costTracking.put("estimatedTotalCost", Math.round(totalCost * 100.0) / 100.0);
                
                saveCostTrackingToFile(costTracking);
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("stopTime", stopTime.toString());
            result.put("message", "Demo session stopped successfully");
            
            return result;
            
        } catch (Exception e) {
            logger.error("Error stopping demo session", e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> getCostEstimate(int durationHours) {
        Map<String, Object> estimate = new HashMap<>();
        
        double totalCost = durationHours * TOTAL_HOURLY_COST;
        
        estimate.put("durationHours", durationHours);
        estimate.put("baseHourlyRate", TOTAL_HOURLY_COST);
        estimate.put("totalEstimatedCost", Math.round(totalCost * 100.0) / 100.0);
        
        Map<String, Object> serviceBreakdown = new HashMap<>();
        SERVICE_COSTS.forEach((service, cost) -> {
            serviceBreakdown.put(service, cost * durationHours);
        });
        estimate.put("serviceBreakdown", serviceBreakdown);
        
        estimate.put("note", "Actual costs may vary based on usage patterns");
        
        return estimate;
    }

    private boolean checkDynamoDbHealth() {
        try {
            // Try to describe a table to check DynamoDB connectivity
            dynamoDbClient.describeTable(DescribeTableRequest.builder()
                .tableName("UserProfiles-demo")
                .build());
            return true;
        } catch (Exception e) {
            logger.warn("DynamoDB health check failed: {}", e.getMessage());
            return false;
        }
    }

    private void clearDynamoDbTables() {
        String[] tableNames = {"UserProfiles-demo", "UserEvents-demo", "StruggleSignals-demo"};
        
        for (String tableName : tableNames) {
            try {
                // Scan and delete all items
                ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(tableName)
                    .build();
                
                ScanResponse scanResponse = dynamoDbClient.scan(scanRequest);
                
                for (Map<String, AttributeValue> item : scanResponse.items()) {
                    // Extract key attributes for deletion
                    Map<String, AttributeValue> key = new HashMap<>();
                    
                    if (tableName.equals("UserProfiles-demo")) {
                        key.put("userId", item.get("userId"));
                    } else if (tableName.equals("UserEvents-demo")) {
                        key.put("userId", item.get("userId"));
                        key.put("timestamp", item.get("timestamp"));
                    } else if (tableName.equals("StruggleSignals-demo")) {
                        key.put("userId", item.get("userId"));
                        key.put("featureId", item.get("featureId"));
                    }
                    
                    dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                        .tableName(tableName)
                        .key(key)
                        .build());
                }
                
                logger.info("Cleared table: {}", tableName);
                
            } catch (Exception e) {
                logger.warn("Failed to clear table {}: {}", tableName, e.getMessage());
            }
        }
    }

    private List<Map<String, Object>> exportDynamoDbTable(String tableName) {
        try {
            ScanRequest scanRequest = ScanRequest.builder()
                .tableName(tableName)
                .build();
            
            ScanResponse scanResponse = dynamoDbClient.scan(scanRequest);
            
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, AttributeValue> item : scanResponse.items()) {
                Map<String, Object> convertedItem = convertAttributeValueMap(item);
                items.add(convertedItem);
            }
            
            return items;
            
        } catch (Exception e) {
            logger.warn("Failed to export table {}: {}", tableName, e.getMessage());
            return new ArrayList<>();
        }
    }

    private void restoreDynamoDbTable(String tableName, List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        
        try {
            for (Map<String, Object> item : items) {
                Map<String, AttributeValue> dynamoItem = convertToAttributeValueMap(item);
                
                dynamoDbClient.putItem(PutItemRequest.builder()
                    .tableName(tableName)
                    .item(dynamoItem)
                    .build());
            }
            
            logger.info("Restored {} items to table: {}", items.size(), tableName);
            
        } catch (Exception e) {
            logger.error("Failed to restore table {}: {}", tableName, e.getMessage());
        }
    }

    private Map<String, Object> convertAttributeValueMap(Map<String, AttributeValue> attributeMap) {
        Map<String, Object> result = new HashMap<>();
        
        for (Map.Entry<String, AttributeValue> entry : attributeMap.entrySet()) {
            AttributeValue value = entry.getValue();
            Object convertedValue = null;
            
            if (value.s() != null) {
                convertedValue = value.s();
            } else if (value.n() != null) {
                convertedValue = Double.parseDouble(value.n());
            } else if (value.bool() != null) {
                convertedValue = value.bool();
            } else if (value.l() != null) {
                convertedValue = value.l().stream()
                    .map(this::convertAttributeValue)
                    .toList();
            } else if (value.m() != null) {
                convertedValue = convertAttributeValueMap(value.m());
            }
            
            result.put(entry.getKey(), convertedValue);
        }
        
        return result;
    }

    private Object convertAttributeValue(AttributeValue value) {
        if (value.s() != null) {
            return value.s();
        } else if (value.n() != null) {
            return Double.parseDouble(value.n());
        } else if (value.bool() != null) {
            return value.bool();
        }
        return null;
    }

    private Map<String, AttributeValue> convertToAttributeValueMap(Map<String, Object> objectMap) {
        Map<String, AttributeValue> result = new HashMap<>();
        
        for (Map.Entry<String, Object> entry : objectMap.entrySet()) {
            Object value = entry.getValue();
            AttributeValue attributeValue = null;
            
            if (value instanceof String) {
                attributeValue = AttributeValue.builder().s((String) value).build();
            } else if (value instanceof Number) {
                attributeValue = AttributeValue.builder().n(value.toString()).build();
            } else if (value instanceof Boolean) {
                attributeValue = AttributeValue.builder().bool((Boolean) value).build();
            }
            
            if (attributeValue != null) {
                result.put(entry.getKey(), attributeValue);
            }
        }
        
        return result;
    }

    private Map<String, Object> createDefaultCostTracking() {
        Map<String, Object> costTracking = new HashMap<>();
        costTracking.put("sessionId", "no-active-session");
        costTracking.put("estimatedHourlyCost", TOTAL_HOURLY_COST);
        
        Map<String, Object> services = new HashMap<>();
        SERVICE_COSTS.forEach((service, cost) -> {
            Map<String, Object> serviceInfo = new HashMap<>();
            serviceInfo.put("estimatedCost", cost);
            serviceInfo.put("unit", "hour");
            services.put(service, serviceInfo);
        });
        costTracking.put("services", services);
        
        return costTracking;
    }

    private void saveCostTrackingToFile(Map<String, Object> costTracking) {
        try {
            Path costFile = Paths.get(COST_TRACKING_FILE);
            Files.createDirectories(costFile.getParent());
            objectMapper.writeValue(costFile.toFile(), costTracking);
        } catch (IOException e) {
            logger.error("Failed to save cost tracking to file", e);
        }
    }

    private void saveHealthCheckToFile(Map<String, Object> healthStatus) {
        try {
            Path healthFile = Paths.get(HEALTH_CHECK_FILE);
            Files.createDirectories(healthFile.getParent());
            objectMapper.writeValue(healthFile.toFile(), healthStatus);
        } catch (IOException e) {
            logger.error("Failed to save health check to file", e);
        }
    }
}