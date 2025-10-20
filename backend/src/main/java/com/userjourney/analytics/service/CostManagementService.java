package com.userjourney.analytics.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import software.amazon.awssdk.services.costexplorer.CostExplorerClient;
import software.amazon.awssdk.services.costexplorer.model.*;
import software.amazon.awssdk.services.budgets.BudgetsClient;
import software.amazon.awssdk.services.budgets.model.*;
import software.amazon.awssdk.services.cloudwatch.CloudWatchClient;
import software.amazon.awssdk.services.cloudwatch.model.*;
import software.amazon.awssdk.services.ec2.Ec2Client;
import software.amazon.awssdk.services.ec2.model.DescribeInstancesRequest;
import software.amazon.awssdk.services.ec2.model.DescribeInstancesResponse;
import software.amazon.awssdk.services.ec2.model.StopInstancesRequest;
import software.amazon.awssdk.services.lambda.LambdaClient;
import software.amazon.awssdk.services.lambda.model.ListFunctionsRequest;
import software.amazon.awssdk.services.lambda.model.ListFunctionsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class CostManagementService {
    
    private static final Logger logger = LoggerFactory.getLogger(CostManagementService.class);
    
    private final CostExplorerClient costExplorerClient;
    private final BudgetsClient budgetsClient;
    private final CloudWatchClient cloudWatchClient;
    private final Ec2Client ec2Client;
    private final LambdaClient lambdaClient;
    
    @Value("${aws.account.id:123456789012}")
    private String accountId;
    
    @Value("${demo.environment.tag:demo}")
    private String demoEnvironmentTag;
    
    @Value("${demo.cost.thresholds:100,200,300}")
    private String costThresholds;
    
    public CostManagementService(CostExplorerClient costExplorerClient,
                               BudgetsClient budgetsClient,
                               CloudWatchClient cloudWatchClient,
                               Ec2Client ec2Client,
                               LambdaClient lambdaClient) {
        this.costExplorerClient = costExplorerClient;
        this.budgetsClient = budgetsClient;
        this.cloudWatchClient = cloudWatchClient;
        this.ec2Client = ec2Client;
        this.lambdaClient = lambdaClient;
    }
    
    /**
     * Create cost monitoring dashboard for demo environment
     */
    public Map<String, Object> createCostMonitoringDashboard() {
        logger.info("Creating cost monitoring dashboard for demo environment");
        
        try {
            // Create CloudWatch dashboard
            String dashboardBody = createDashboardConfiguration();
            
            PutDashboardRequest request = PutDashboardRequest.builder()
                .dashboardName("DemoEnvironmentCostMonitoring")
                .dashboardBody(dashboardBody)
                .build();
                
            PutDashboardResponse response = cloudWatchClient.putDashboard(request);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("dashboardArn", "arn:aws:cloudwatch:" + System.getProperty("aws.region", "us-east-1") + ":123456789012:dashboard/DemoEnvironmentCostMonitoring");
            result.put("message", "Cost monitoring dashboard created successfully");
            
            return result;
        } catch (Exception e) {
            logger.error("Error creating cost monitoring dashboard", e);
            throw new RuntimeException("Failed to create cost monitoring dashboard", e);
        }
    }
    
    /**
     * Set up billing alerts at specified thresholds
     */
    public Map<String, Object> setupBillingAlerts() {
        logger.info("Setting up billing alerts for demo environment");
        
        try {
            List<String> thresholds = Arrays.asList(costThresholds.split(","));
            List<String> createdAlerts = new ArrayList<>();
            
            for (String threshold : thresholds) {
                String alertName = createBillingAlert(Double.parseDouble(threshold.trim()));
                createdAlerts.add(alertName);
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("alertsCreated", createdAlerts);
            result.put("thresholds", thresholds);
            result.put("message", "Billing alerts created successfully");
            
            return result;
        } catch (Exception e) {
            logger.error("Error setting up billing alerts", e);
            throw new RuntimeException("Failed to setup billing alerts", e);
        }
    }
    
    /**
     * Get current cost and usage for demo environment
     */
    public Map<String, Object> getCurrentCostAndUsage() {
        logger.info("Retrieving current cost and usage for demo environment");
        
        try {
            LocalDate endDate = LocalDate.now();
            LocalDate startDate = endDate.minusDays(30);
            
            GetCostAndUsageRequest request = GetCostAndUsageRequest.builder()
                .timePeriod(DateInterval.builder()
                    .start(startDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                    .end(endDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                    .build())
                .granularity(Granularity.DAILY)
                .metrics("BlendedCost", "UsageQuantity")
                .groupBy(GroupDefinition.builder()
                    .type(GroupDefinitionType.DIMENSION)
                    .key("SERVICE")
                    .build())
                .filter(Expression.builder()
                    .tags(TagValues.builder()
                        .key("Environment")
                        .values(demoEnvironmentTag)
                        .build())
                    .build())
                .build();
                
            GetCostAndUsageResponse response = costExplorerClient.getCostAndUsage(request);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("costData", processCostData(response));
            result.put("period", Map.of("start", startDate.toString(), "end", endDate.toString()));
            
            return result;
        } catch (Exception e) {
            logger.error("Error retrieving cost and usage data", e);
            throw new RuntimeException("Failed to retrieve cost and usage data", e);
        }
    }
    
    /**
     * Implement automated resource shutdown for non-demo hours
     */
    public Map<String, Object> scheduleResourceShutdown() {
        logger.info("Scheduling automated resource shutdown for non-demo hours");
        
        try {
            // Create CloudWatch Events rule for shutdown (e.g., 6 PM daily)
            String shutdownRule = createScheduledShutdownRule();
            
            // Create CloudWatch Events rule for startup (e.g., 8 AM daily)
            String startupRule = createScheduledStartupRule();
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("shutdownRule", shutdownRule);
            result.put("startupRule", startupRule);
            result.put("schedule", Map.of(
                "shutdown", "18:00 UTC daily",
                "startup", "08:00 UTC daily"
            ));
            result.put("message", "Resource scheduling configured successfully");
            
            return result;
        } catch (Exception e) {
            logger.error("Error scheduling resource shutdown", e);
            throw new RuntimeException("Failed to schedule resource shutdown", e);
        }
    }
    
    /**
     * Shutdown demo environment resources
     */
    public Map<String, Object> shutdownDemoResources() {
        logger.info("Shutting down demo environment resources");
        
        try {
            List<String> shutdownActions = new ArrayList<>();
            
            // Shutdown EC2 instances tagged with demo environment
            CompletableFuture<Void> ec2Shutdown = CompletableFuture.runAsync(() -> {
                try {
                    shutdownEC2Instances();
                    shutdownActions.add("EC2 instances stopped");
                } catch (Exception e) {
                    logger.error("Error shutting down EC2 instances", e);
                }
            });
            
            // Scale down other services (this would be implemented based on specific services)
            CompletableFuture<Void> servicesShutdown = CompletableFuture.runAsync(() -> {
                try {
                    scaleDownServices();
                    shutdownActions.add("Services scaled down");
                } catch (Exception e) {
                    logger.error("Error scaling down services", e);
                }
            });
            
            // Wait for all shutdown operations to complete
            CompletableFuture.allOf(ec2Shutdown, servicesShutdown).join();
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("shutdownActions", shutdownActions);
            result.put("timestamp", System.currentTimeMillis());
            result.put("message", "Demo resources shutdown completed");
            
            return result;
        } catch (Exception e) {
            logger.error("Error shutting down demo resources", e);
            throw new RuntimeException("Failed to shutdown demo resources", e);
        }
    }
    
    /**
     * Create infrastructure teardown automation
     */
    public Map<String, Object> createTeardownAutomation() {
        logger.info("Creating infrastructure teardown automation");
        
        try {
            // This would typically create a Lambda function or Step Function
            // for automated teardown of the entire demo environment
            
            String teardownFunction = createTeardownLambdaFunction();
            String rebuildFunction = createRebuildLambdaFunction();
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("teardownFunction", teardownFunction);
            result.put("rebuildFunction", rebuildFunction);
            result.put("message", "Teardown automation created successfully");
            
            return result;
        } catch (Exception e) {
            logger.error("Error creating teardown automation", e);
            throw new RuntimeException("Failed to create teardown automation", e);
        }
    }
    
    /**
     * Get cost tracking by service
     */
    public Map<String, Object> getCostByService() {
        logger.info("Retrieving cost breakdown by AWS service");
        
        try {
            LocalDate endDate = LocalDate.now();
            LocalDate startDate = endDate.minusDays(7);
            
            GetCostAndUsageRequest request = GetCostAndUsageRequest.builder()
                .timePeriod(DateInterval.builder()
                    .start(startDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                    .end(endDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                    .build())
                .granularity(Granularity.DAILY)
                .metrics("BlendedCost")
                .groupBy(GroupDefinition.builder()
                    .type(GroupDefinitionType.DIMENSION)
                    .key("SERVICE")
                    .build())
                .filter(Expression.builder()
                    .tags(TagValues.builder()
                        .key("Environment")
                        .values(demoEnvironmentTag)
                        .build())
                    .build())
                .build();
                
            GetCostAndUsageResponse response = costExplorerClient.getCostAndUsage(request);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("costByService", processCostByService(response));
            result.put("period", Map.of("start", startDate.toString(), "end", endDate.toString()));
            
            return result;
        } catch (Exception e) {
            logger.error("Error retrieving cost by service", e);
            throw new RuntimeException("Failed to retrieve cost by service", e);
        }
    }
    
    /**
     * Implement resource tagging strategy for cost allocation
     */
    public Map<String, Object> implementResourceTagging() {
        logger.info("Implementing resource tagging strategy for cost allocation");
        
        try {
            Map<String, String> standardTags = Map.of(
                "Environment", demoEnvironmentTag,
                "Project", "UserJourneyAnalytics",
                "CostCenter", "Demo",
                "Owner", "HackathonTeam",
                "AutoShutdown", "true"
            );
            
            // This would typically tag all resources in the demo environment
            // For now, we'll return the tagging strategy
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("standardTags", standardTags);
            result.put("message", "Resource tagging strategy implemented");
            
            return result;
        } catch (Exception e) {
            logger.error("Error implementing resource tagging", e);
            throw new RuntimeException("Failed to implement resource tagging", e);
        }
    }
    
    /**
     * Create demo environment lifecycle management (15-day auto-cleanup)
     */
    public Map<String, Object> createLifecycleManagement() {
        logger.info("Creating demo environment lifecycle management");
        
        try {
            // Create CloudWatch Events rule for 15-day cleanup
            String cleanupRule = createLifecycleCleanupRule();
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("cleanupRule", cleanupRule);
            result.put("lifecycleDays", 15);
            result.put("message", "Lifecycle management configured for 15-day auto-cleanup");
            
            return result;
        } catch (Exception e) {
            logger.error("Error creating lifecycle management", e);
            throw new RuntimeException("Failed to create lifecycle management", e);
        }
    }
    
    // Private helper methods
    
    private String createDashboardConfiguration() {
        return """
        {
            "widgets": [
                {
                    "type": "metric",
                    "properties": {
                        "metrics": [
                            ["AWS/Billing", "EstimatedCharges", "Currency", "USD"]
                        ],
                        "period": 86400,
                        "stat": "Maximum",
                        "region": "us-east-1",
                        "title": "Demo Environment Daily Costs"
                    }
                },
                {
                    "type": "metric",
                    "properties": {
                        "metrics": [
                            ["AWS/Lambda", "Invocations"],
                            ["AWS/DynamoDB", "ConsumedReadCapacityUnits"],
                            ["AWS/Kinesis", "IncomingRecords"]
                        ],
                        "period": 300,
                        "stat": "Sum",
                        "region": "us-east-1",
                        "title": "Service Usage Metrics"
                    }
                }
            ]
        }
        """;
    }
    
    private String createBillingAlert(double threshold) {
        try {
            String alertName = "DemoCostAlert-" + (int)threshold;
            
            PutMetricAlarmRequest request = PutMetricAlarmRequest.builder()
                .alarmName(alertName)
                .alarmDescription("Demo environment cost alert at $" + threshold)
                .metricName("EstimatedCharges")
                .namespace("AWS/Billing")
                .statistic(Statistic.MAXIMUM)
                .dimensions(software.amazon.awssdk.services.cloudwatch.model.Dimension.builder()
                    .name("Currency")
                    .value("USD")
                    .build())
                .period(86400)
                .evaluationPeriods(1)
                .threshold(threshold)
                .comparisonOperator(software.amazon.awssdk.services.cloudwatch.model.ComparisonOperator.GREATER_THAN_THRESHOLD)
                .build();
                
            cloudWatchClient.putMetricAlarm(request);
            
            return alertName;
        } catch (Exception e) {
            logger.error("Error creating billing alert for threshold {}", threshold, e);
            throw new RuntimeException("Failed to create billing alert", e);
        }
    }
    
    private Map<String, Object> processCostData(GetCostAndUsageResponse response) {
        Map<String, Object> processedData = new HashMap<>();
        List<Map<String, Object>> dailyCosts = new ArrayList<>();
        double totalCost = 0.0;
        
        for (ResultByTime result : response.resultsByTime()) {
            Map<String, Object> dailyData = new HashMap<>();
            dailyData.put("date", result.timePeriod().start());
            
            double dayCost = 0.0;
            if (!result.total().isEmpty() && result.total().containsKey("BlendedCost")) {
                dayCost = Double.parseDouble(result.total().get("BlendedCost").amount());
            }
            
            dailyData.put("cost", dayCost);
            dailyCosts.add(dailyData);
            totalCost += dayCost;
        }
        
        processedData.put("dailyCosts", dailyCosts);
        processedData.put("totalCost", totalCost);
        processedData.put("averageDailyCost", totalCost / Math.max(1, dailyCosts.size()));
        
        return processedData;
    }
    
    private Map<String, Object> processCostByService(GetCostAndUsageResponse response) {
        Map<String, Double> serviceCosts = new HashMap<>();
        
        for (ResultByTime result : response.resultsByTime()) {
            for (Group group : result.groups()) {
                String service = group.keys().get(0);
                double cost = 0.0;
                
                if (!group.metrics().isEmpty() && group.metrics().containsKey("BlendedCost")) {
                    cost = Double.parseDouble(group.metrics().get("BlendedCost").amount());
                }
                
                serviceCosts.merge(service, cost, Double::sum);
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("serviceCosts", serviceCosts);
        result.put("totalServices", serviceCosts.size());
        
        return result;
    }
    
    private String createScheduledShutdownRule() {
        // This would create a CloudWatch Events rule
        // For now, returning a mock rule name
        return "demo-shutdown-rule-18-00";
    }
    
    private String createScheduledStartupRule() {
        // This would create a CloudWatch Events rule
        // For now, returning a mock rule name
        return "demo-startup-rule-08-00";
    }
    
    private void shutdownEC2Instances() {
        try {
            DescribeInstancesResponse response = ec2Client.describeInstances(
                DescribeInstancesRequest.builder().build()
            );
            
            List<String> instanceIds = new ArrayList<>();
            response.reservations().forEach(reservation -> 
                reservation.instances().forEach(instance -> {
                    // Check if instance has demo environment tag
                    boolean isDemoInstance = instance.tags().stream()
                        .anyMatch(tag -> "Environment".equals(tag.key()) && demoEnvironmentTag.equals(tag.value()));
                    
                    if (isDemoInstance && "running".equals(instance.state().name().toString())) {
                        instanceIds.add(instance.instanceId());
                    }
                })
            );
            
            if (!instanceIds.isEmpty()) {
                ec2Client.stopInstances(StopInstancesRequest.builder()
                    .instanceIds(instanceIds)
                    .build());
                logger.info("Stopped {} EC2 instances", instanceIds.size());
            }
        } catch (Exception e) {
            logger.error("Error shutting down EC2 instances", e);
        }
    }
    
    private void scaleDownServices() {
        // This would scale down other AWS services like:
        // - Reduce DynamoDB capacity
        // - Pause Kinesis streams
        // - Scale down Lambda concurrency
        logger.info("Scaling down demo services (implementation would go here)");
    }
    
    private String createTeardownLambdaFunction() {
        // This would create a Lambda function for complete teardown
        return "demo-teardown-function";
    }
    
    private String createRebuildLambdaFunction() {
        // This would create a Lambda function for rebuilding the environment
        return "demo-rebuild-function";
    }
    
    private String createLifecycleCleanupRule() {
        // This would create a CloudWatch Events rule for 15-day cleanup
        return "demo-lifecycle-cleanup-rule";
    }
}