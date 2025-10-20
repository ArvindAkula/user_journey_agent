package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.Map;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class DataSeedingServiceTest {
    
    @Mock
    private DynamoDbClient dynamoDbClient;
    
    @Mock
    private ObjectMapper objectMapper;
    
    @InjectMocks
    private DataSeedingService dataSeedingService;
    
    @BeforeEach
    void setUp() {
        // Setup mock responses
        when(dynamoDbClient.putItem(any(PutItemRequest.class)))
            .thenReturn(PutItemResponse.builder().build());
        
        when(dynamoDbClient.scan(any(ScanRequest.class)))
            .thenReturn(ScanResponse.builder().items(Collections.emptyList()).build());
    }
    
    @Test
    void testSeedSampleUsers_Success() throws Exception {
        // Arrange
        int userCount = 5;
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Act & Assert - Should not throw exception
        assertDoesNotThrow(() -> dataSeedingService.seedSampleUsers(userCount));
        
        // Verify DynamoDB interactions
        verify(dynamoDbClient, atLeast(userCount)).putItem(any(PutItemRequest.class));
    }
    
    @Test
    void testSimulateUserBehavior_Success() throws Exception {
        // Arrange
        String userId = "test_user_001";
        int eventCount = 10;
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Act & Assert - Should not throw exception
        assertDoesNotThrow(() -> dataSeedingService.simulateUserBehavior(userId, eventCount));
        
        // Verify events were created
        verify(dynamoDbClient, atLeast(eventCount)).putItem(any(PutItemRequest.class));
    }
    
    @Test
    void testGenerateJourneyScenarios_Success() throws Exception {
        // Arrange
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Act & Assert - Should not throw exception
        assertDoesNotThrow(() -> dataSeedingService.generateJourneyScenarios());
        
        // Verify multiple scenarios were created
        verify(dynamoDbClient, atLeast(5)).putItem(any(PutItemRequest.class));
    }
    
    @Test
    void testResetDemoData_Success() throws Exception {
        // Arrange
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Mock scan responses for cleanup
        ScanResponse mockScanResponse = ScanResponse.builder()
            .items(Collections.singletonList(Map.of("userId", AttributeValue.builder().s("demo_user_001").build())))
            .build();
        when(dynamoDbClient.scan(any(ScanRequest.class))).thenReturn(mockScanResponse);
        
        when(dynamoDbClient.deleteItem(any(DeleteItemRequest.class)))
            .thenReturn(DeleteItemResponse.builder().build());
        
        // Act & Assert - Should not throw exception
        assertDoesNotThrow(() -> dataSeedingService.resetDemoData());
        
        // Verify cleanup and reseeding occurred
        verify(dynamoDbClient, atLeast(1)).deleteItem(any(DeleteItemRequest.class));
        verify(dynamoDbClient, atLeast(50)).putItem(any(PutItemRequest.class));
    }
    
    @Test
    void testGeneratePerformanceTestData_Success() throws Exception {
        // Arrange
        int userCount = 10;
        int eventsPerUser = 5;
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Act & Assert - Should not throw exception
        assertDoesNotThrow(() -> dataSeedingService.generatePerformanceTestData(userCount, eventsPerUser));
        
        // Verify users and events were created
        verify(dynamoDbClient, atLeast(userCount + (userCount * eventsPerUser))).putItem(any(PutItemRequest.class));
    }
    
    @Test
    void testSeedSampleUsers_DynamoDbException() throws Exception {
        // Arrange
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(dynamoDbClient.putItem(any(PutItemRequest.class)))
            .thenThrow(DynamoDbException.builder().message("DynamoDB error").build());
        
        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, 
            () -> dataSeedingService.seedSampleUsers(1));
        
        assertTrue(exception.getMessage().contains("Failed to seed sample users"));
    }
    
    @Test
    void testSimulateUserBehavior_InterruptedException() throws Exception {
        // Arrange
        String userId = "test_user";
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        // Mock Thread.sleep to throw InterruptedException
        Thread.currentThread().interrupt();
        
        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, 
            () -> dataSeedingService.simulateUserBehavior(userId, 1));
        
        assertTrue(exception.getMessage().contains("Failed to simulate user behavior"));
    }
}