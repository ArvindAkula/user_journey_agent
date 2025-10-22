package com.userjourney.analytics.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Environment Configuration
 * Tests environment detection and configuration loading
 */
@SpringBootTest(classes = com.userjourney.analytics.AnalyticsBackendApplication.class)
@ActiveProfiles("dev")
class EnvironmentConfigTest {

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Value("${aws.region:us-east-1}")
    private String awsRegion;

    @Value("${aws.mock.enabled:false}")
    private boolean mockEnabled;

    @Value("${aws.mock.endpoint:http://localhost:4566}")
    private String mockEndpoint;

    @Value("${firebase.emulator.enabled:false}")
    private boolean firebaseEmulatorEnabled;

    @Value("${firebase.emulator.host:localhost}")
    private String firebaseEmulatorHost;

    @Value("${firebase.emulator.port:9099}")
    private int firebaseEmulatorPort;

    @Test
    void testEnvironmentDetection() {
        assertNotNull(activeProfile, "Active profile should be set");
        assertEquals("dev", activeProfile, "Active profile should be 'dev'");
    }

    @Test
    void testAwsRegionConfiguration() {
        assertNotNull(awsRegion, "AWS region should be configured");
        assertEquals("us-east-1", awsRegion, "AWS region should be us-east-1");
    }

    @Test
    void testMockConfiguration() {
        assertTrue(mockEnabled, "Mock should be enabled in dev profile");
        assertNotNull(mockEndpoint, "Mock endpoint should be configured");
        assertEquals("http://localhost:4566", mockEndpoint, "Mock endpoint should be LocalStack");
    }

    @Test
    void testFirebaseEmulatorConfiguration() {
        assertTrue(firebaseEmulatorEnabled, "Firebase emulator should be enabled in dev profile");
        assertEquals("localhost", firebaseEmulatorHost, "Firebase emulator host should be localhost");
        assertEquals(9099, firebaseEmulatorPort, "Firebase emulator port should be 9099");
    }
}
