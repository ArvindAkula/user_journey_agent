package com.userjourney.analytics.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sqs.SqsClient;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for AWS Configuration
 * Tests environment detection, configuration loading, and AWS client initialization
 */
@SpringBootTest(classes = com.userjourney.analytics.AnalyticsBackendApplication.class)
@ActiveProfiles("dev")
class AwsConfigTest {

    @Autowired
    private DynamoDbClient dynamoDbClient;

    @Autowired
    private KinesisClient kinesisClient;

    @Autowired
    private S3Client s3Client;

    @Autowired
    private BedrockRuntimeClient bedrockRuntimeClient;

    @Autowired
    private SageMakerRuntimeClient sageMakerRuntimeClient;

    @Autowired
    private SqsClient sqsClient;

    @Autowired
    private Region awsRegion;

    @Test
    void testAwsRegionConfiguration() {
        assertNotNull(awsRegion, "AWS Region should be configured");
        assertEquals(Region.US_EAST_1, awsRegion, "AWS Region should be us-east-1");
    }

    @Test
    void testDynamoDbClientInitialization() {
        assertNotNull(dynamoDbClient, "DynamoDB client should be initialized");
    }

    @Test
    void testKinesisClientInitialization() {
        assertNotNull(kinesisClient, "Kinesis client should be initialized");
    }

    @Test
    void testS3ClientInitialization() {
        assertNotNull(s3Client, "S3 client should be initialized");
    }

    @Test
    void testBedrockRuntimeClientInitialization() {
        assertNotNull(bedrockRuntimeClient, "Bedrock Runtime client should be initialized");
    }

    @Test
    void testSageMakerRuntimeClientInitialization() {
        assertNotNull(sageMakerRuntimeClient, "SageMaker Runtime client should be initialized");
    }

    @Test
    void testSqsClientInitialization() {
        assertNotNull(sqsClient, "SQS client should be initialized");
    }
}
