package com.userjourney.analytics.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.kinesis.KinesisClient;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for Environment Switching
 * Tests that the application correctly switches between dev and prod configurations
 */
@SpringBootTest(classes = com.userjourney.analytics.AnalyticsBackendApplication.class)
@ActiveProfiles("dev")
class EnvironmentSwitchingIntegrationTest {

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Value("${aws.mock.enabled:false}")
    private boolean mockEnabled;

    @Value("${aws.mock.endpoint:http://localhost:4566}")
    private String mockEndpoint;

    @Value("${firebase.emulator.enabled:false}")
    private boolean firebaseEmulatorEnabled;

    @Autowired
    private DynamoDbClient dynamoDbClient;

    @Autowired
    private KinesisClient kinesisClient;

    @Autowired
    private Region awsRegion;

    @Test
    void testActiveProfileIsSet() {
        assertNotNull(activeProfile, "Active profile should be set");
        assertEquals("dev", activeProfile, "Active profile should be 'dev'");
    }

    @Test
    void testMockServicesEnabledInDevMode() {
        assertTrue(mockEnabled, "Mock services should be enabled in dev mode");
        assertEquals("http://localhost:4566", mockEndpoint, "Mock endpoint should be LocalStack");
    }

    @Test
    void testFirebaseEmulatorEnabledInDevMode() {
        assertTrue(firebaseEmulatorEnabled, "Firebase emulator should be enabled in dev mode");
    }

    @Test
    void testAwsClientsInitialized() {
        assertNotNull(dynamoDbClient, "DynamoDB client should be initialized");
        assertNotNull(kinesisClient, "Kinesis client should be initialized");
    }

    @Test
    void testAwsRegionConfiguration() {
        assertNotNull(awsRegion, "AWS region should be configured");
        assertEquals(Region.US_EAST_1, awsRegion, "AWS region should be us-east-1");
    }

    @Test
    void testDynamoDbClientConfiguration() {
        assertNotNull(dynamoDbClient, "DynamoDB client should be configured");
        // In dev mode, client should be configured to use LocalStack
        // We can't easily test the endpoint override, but we can verify the client exists
    }

    @Test
    void testKinesisClientConfiguration() {
        assertNotNull(kinesisClient, "Kinesis client should be configured");
        // In dev mode, client should be configured to use LocalStack
    }
}
