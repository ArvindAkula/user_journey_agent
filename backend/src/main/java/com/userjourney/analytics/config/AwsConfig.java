package com.userjourney.analytics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sqs.SqsClient;

import jakarta.annotation.PostConstruct;
import java.net.URI;

@Configuration
public class AwsConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(AwsConfig.class);
    
    @Value("${aws.region:us-east-1}")
    private String awsRegion;
    
    @Value("${aws.mock.enabled:false}")
    private boolean mockEnabled;
    
    @Value("${aws.mock.endpoint:http://localhost:4566}")
    private String mockEndpoint;
    
    @Value("${spring.profiles.active:dev}")
    private String activeProfile;
    
    @PostConstruct
    public void logEnvironmentConfiguration() {
        logger.info("=".repeat(80));
        logger.info("AWS Configuration Initialized");
        logger.info("=".repeat(80));
        logger.info("Active Profile: {}", activeProfile);
        logger.info("AWS Region: {}", awsRegion);
        logger.info("Mock Enabled: {}", mockEnabled);
        if (mockEnabled) {
            logger.info("Mock Endpoint: {}", mockEndpoint);
            logger.info("Using LocalStack for AWS services");
        } else {
            logger.info("Using actual AWS services");
        }
        logger.info("=".repeat(80));
    }
    
    @Bean
    public Region awsRegion() {
        return Region.of(awsRegion);
    }
    
    // =============================================================================
    // Development Profile Beans (LocalStack)
    // =============================================================================
    
    @Bean
    @Profile("dev")
    public KinesisClient devKinesisClient() {
        logger.info("Creating Kinesis client for development (LocalStack)");
        return KinesisClient.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("dev")
    public DynamoDbClient devDynamoDbClient() {
        logger.info("Creating DynamoDB client for development (LocalStack)");
        return DynamoDbClient.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("dev")
    public S3Client devS3Client() {
        logger.info("Creating S3 client for development (LocalStack)");
        return S3Client.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .forcePathStyle(true)  // Required for LocalStack
            .build();
    }
    
    @Bean
    @Profile("dev")
    public BedrockRuntimeClient devBedrockRuntimeClient() {
        logger.info("Creating Bedrock Runtime client for development (LocalStack)");
        return BedrockRuntimeClient.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("dev")
    public SageMakerRuntimeClient devSageMakerRuntimeClient() {
        logger.info("Creating SageMaker Runtime client for development (LocalStack)");
        return SageMakerRuntimeClient.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("dev")
    public SqsClient devSqsClient() {
        logger.info("Creating SQS client for development (LocalStack)");
        return SqsClient.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    // =============================================================================
    // Production Profile Beans (Actual AWS Services)
    // =============================================================================
    
    @Bean
    @Profile("prod")
    public KinesisClient prodKinesisClient() {
        logger.info("Creating Kinesis client for production (AWS)");
        return KinesisClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("prod")
    public DynamoDbClient prodDynamoDbClient() {
        logger.info("Creating DynamoDB client for production (AWS)");
        return DynamoDbClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("prod")
    public S3Client prodS3Client() {
        logger.info("Creating S3 client for production (AWS)");
        return S3Client.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("prod")
    public BedrockRuntimeClient prodBedrockRuntimeClient() {
        logger.info("Creating Bedrock Runtime client for production (AWS)");
        return BedrockRuntimeClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("prod")
    public SageMakerRuntimeClient prodSageMakerRuntimeClient() {
        logger.info("Creating SageMaker Runtime client for production (AWS)");
        return SageMakerRuntimeClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("prod")
    public SqsClient prodSqsClient() {
        logger.info("Creating SQS client for production (AWS)");
        return SqsClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    // =============================================================================
    // Shared Beans (Cost Explorer, Budgets - Production Only)
    // =============================================================================
    
    @Bean
    @Profile("prod")
    public software.amazon.awssdk.services.costexplorer.CostExplorerClient costExplorerClient() {
        logger.info("Creating Cost Explorer client for production (AWS)");
        return software.amazon.awssdk.services.costexplorer.CostExplorerClient.builder()
            .region(Region.US_EAST_1) // Cost Explorer is only available in us-east-1
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("prod")
    public software.amazon.awssdk.services.budgets.BudgetsClient budgetsClient() {
        logger.info("Creating Budgets client for production (AWS)");
        return software.amazon.awssdk.services.budgets.BudgetsClient.builder()
            .region(Region.US_EAST_1) // Budgets is only available in us-east-1
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("dev")
    public software.amazon.awssdk.services.cloudwatch.CloudWatchClient devCloudWatchClient() {
        logger.info("Creating CloudWatch client for development (LocalStack)");
        return software.amazon.awssdk.services.cloudwatch.CloudWatchClient.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("prod")
    public software.amazon.awssdk.services.cloudwatch.CloudWatchClient prodCloudWatchClient() {
        logger.info("Creating CloudWatch client for production (AWS)");
        return software.amazon.awssdk.services.cloudwatch.CloudWatchClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("dev")
    public software.amazon.awssdk.services.ec2.Ec2Client devEc2Client() {
        logger.info("Creating EC2 client for development (LocalStack)");
        return software.amazon.awssdk.services.ec2.Ec2Client.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("prod")
    public software.amazon.awssdk.services.ec2.Ec2Client prodEc2Client() {
        logger.info("Creating EC2 client for production (AWS)");
        return software.amazon.awssdk.services.ec2.Ec2Client.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    @Profile("dev")
    public software.amazon.awssdk.services.lambda.LambdaClient devLambdaClient() {
        logger.info("Creating Lambda client for development (LocalStack)");
        return software.amazon.awssdk.services.lambda.LambdaClient.builder()
            .region(awsRegion())
            .endpointOverride(URI.create(mockEndpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("prod")
    public software.amazon.awssdk.services.lambda.LambdaClient prodLambdaClient() {
        logger.info("Creating Lambda client for production (AWS)");
        return software.amazon.awssdk.services.lambda.LambdaClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}