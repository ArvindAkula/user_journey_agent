package com.userjourney.analytics.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.costexplorer.CostExplorerClient;
import software.amazon.awssdk.services.costexplorer.model.*;
import software.amazon.awssdk.services.budgets.BudgetsClient;
import software.amazon.awssdk.services.cloudwatch.CloudWatchClient;
import software.amazon.awssdk.services.cloudwatch.model.*;
import software.amazon.awssdk.services.ec2.Ec2Client;
import software.amazon.awssdk.services.ec2.model.*;
import software.amazon.awssdk.services.lambda.LambdaClient;

import java.util.Map;
import java.util.Arrays;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class CostManagementServiceTest {
    
    @Mock
    private CostExplorerClient costExplorerClient;
    
    @Mock
    private BudgetsClient budgetsClient;
    
    @Mock
    private CloudWatchClient cloudWatchClient;
    
    @Mock
    private Ec2Client ec2Client;
    
    @Mock
    private LambdaClient lambdaClient;
    
    @InjectMocks
    private CostManagementService costManagementService;
    
    @BeforeEach
    void setUp() {
        // Setup mock responses
        when(cloudWatchClient.putDashboard(any(PutDashboardRequest.class)))
            .thenReturn(PutDashboardResponse.builder()
                .build());
        
        when(cloudWatchClient.putMetricAlarm(any(PutMetricAlarmRequest.class)))
            .thenReturn(PutMetricAlarmResponse.builder().build());
    }
    
    @Test
    void testCreateCostMonitoringDashboard_Success() {
        // Act
        Map<String, Object> result = costManagementService.createCostMonitoringDashboard();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("dashboardArn"));
        assertEquals("Cost monitoring dashboard created successfully", result.get("message"));
        
        // Verify CloudWatch interaction
        verify(cloudWatchClient, times(1)).putDashboard(any(PutDashboardRequest.class));
    }
    
    @Test
    void testSetupBillingAlerts_Success() {
        // Act
        Map<String, Object> result = costManagementService.setupBillingAlerts();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("alertsCreated"));
        assertEquals("Billing alerts created successfully", result.get("message"));
        
        // Verify multiple alerts were created (default thresholds: 100,200,300)
        verify(cloudWatchClient, times(3)).putMetricAlarm(any(PutMetricAlarmRequest.class));
    }
    
    @Test
    void testGetCurrentCostAndUsage_Success() {
        // Arrange
        MetricValue metricValue = MetricValue.builder()
            .amount("25.50")
            .unit("USD")
            .build();
        
        ResultByTime resultByTime = ResultByTime.builder()
            .timePeriod(DateInterval.builder()
                .start("2024-01-01")
                .end("2024-01-02")
                .build())
            .total(Map.of("BlendedCost", metricValue))
            .build();
        
        GetCostAndUsageResponse mockResponse = GetCostAndUsageResponse.builder()
            .resultsByTime(Arrays.asList(resultByTime))
            .build();
        
        when(costExplorerClient.getCostAndUsage(any(GetCostAndUsageRequest.class)))
            .thenReturn(mockResponse);
        
        // Act
        Map<String, Object> result = costManagementService.getCurrentCostAndUsage();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("costData"));
        assertNotNull(result.get("period"));
        
        // Verify Cost Explorer interaction
        verify(costExplorerClient, times(1)).getCostAndUsage(any(GetCostAndUsageRequest.class));
    }
    
    @Test
    void testScheduleResourceShutdown_Success() {
        // Act
        Map<String, Object> result = costManagementService.scheduleResourceShutdown();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("shutdownRule"));
        assertNotNull(result.get("startupRule"));
        assertNotNull(result.get("schedule"));
        assertEquals("Resource scheduling configured successfully", result.get("message"));
    }
    
    @Test
    void testShutdownDemoResources_Success() {
        // Arrange
        Instance mockInstance = Instance.builder()
            .instanceId("i-1234567890abcdef0")
            .state(InstanceState.builder().name(InstanceStateName.RUNNING).build())
            .tags(software.amazon.awssdk.services.ec2.model.Tag.builder().key("Environment").value("demo").build())
            .build();
        
        Reservation mockReservation = Reservation.builder()
            .instances(Arrays.asList(mockInstance))
            .build();
        
        DescribeInstancesResponse mockDescribeResponse = DescribeInstancesResponse.builder()
            .reservations(Arrays.asList(mockReservation))
            .build();
        
        when(ec2Client.describeInstances(any(DescribeInstancesRequest.class)))
            .thenReturn(mockDescribeResponse);
        
        when(ec2Client.stopInstances(any(StopInstancesRequest.class)))
            .thenReturn(StopInstancesResponse.builder().build());
        
        // Act
        Map<String, Object> result = costManagementService.shutdownDemoResources();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("shutdownActions"));
        assertEquals("Demo resources shutdown completed", result.get("message"));
        
        // Verify EC2 interactions
        verify(ec2Client, times(1)).describeInstances(any(DescribeInstancesRequest.class));
        verify(ec2Client, times(1)).stopInstances(any(StopInstancesRequest.class));
    }
    
    @Test
    void testCreateTeardownAutomation_Success() {
        // Act
        Map<String, Object> result = costManagementService.createTeardownAutomation();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("teardownFunction"));
        assertNotNull(result.get("rebuildFunction"));
        assertEquals("Teardown automation created successfully", result.get("message"));
    }
    
    @Test
    void testGetCostByService_Success() {
        // Arrange
        MetricValue metricValue = MetricValue.builder()
            .amount("15.75")
            .unit("USD")
            .build();
        
        Group group = Group.builder()
            .keys(Arrays.asList("Amazon DynamoDB"))
            .metrics(Map.of("BlendedCost", metricValue))
            .build();
        
        ResultByTime resultByTime = ResultByTime.builder()
            .timePeriod(DateInterval.builder()
                .start("2024-01-01")
                .end("2024-01-02")
                .build())
            .groups(Arrays.asList(group))
            .build();
        
        GetCostAndUsageResponse mockResponse = GetCostAndUsageResponse.builder()
            .resultsByTime(Arrays.asList(resultByTime))
            .build();
        
        when(costExplorerClient.getCostAndUsage(any(GetCostAndUsageRequest.class)))
            .thenReturn(mockResponse);
        
        // Act
        Map<String, Object> result = costManagementService.getCostByService();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("costByService"));
        assertNotNull(result.get("period"));
        
        // Verify Cost Explorer interaction
        verify(costExplorerClient, times(1)).getCostAndUsage(any(GetCostAndUsageRequest.class));
    }
    
    @Test
    void testImplementResourceTagging_Success() {
        // Act
        Map<String, Object> result = costManagementService.implementResourceTagging();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("standardTags"));
        assertEquals("Resource tagging strategy implemented", result.get("message"));
        
        // Verify standard tags are present
        @SuppressWarnings("unchecked")
        Map<String, String> tags = (Map<String, String>) result.get("standardTags");
        assertTrue(tags.containsKey("Environment"));
        assertTrue(tags.containsKey("Project"));
        assertTrue(tags.containsKey("CostCenter"));
    }
    
    @Test
    void testCreateLifecycleManagement_Success() {
        // Act
        Map<String, Object> result = costManagementService.createLifecycleManagement();
        
        // Assert
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("cleanupRule"));
        assertEquals(15, result.get("lifecycleDays"));
        assertEquals("Lifecycle management configured for 15-day auto-cleanup", result.get("message"));
    }
    
    @Test
    void testCreateCostMonitoringDashboard_CloudWatchException() {
        // Arrange
        when(cloudWatchClient.putDashboard(any(PutDashboardRequest.class)))
            .thenThrow(CloudWatchException.builder().message("CloudWatch error").build());
        
        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, 
            () -> costManagementService.createCostMonitoringDashboard());
        
        assertTrue(exception.getMessage().contains("Failed to create cost monitoring dashboard"));
    }
    
    @Test
    void testGetCurrentCostAndUsage_CostExplorerException() {
        // Arrange
        when(costExplorerClient.getCostAndUsage(any(GetCostAndUsageRequest.class)))
            .thenThrow(CostExplorerException.builder().message("Cost Explorer error").build());
        
        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, 
            () -> costManagementService.getCurrentCostAndUsage());
        
        assertTrue(exception.getMessage().contains("Failed to retrieve cost and usage data"));
    }
}