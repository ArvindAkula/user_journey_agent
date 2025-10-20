package com.userjourney.analytics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sqs.SqsClient;

@Configuration
public class AwsConfig {
    
    @Value("${aws.region:us-east-1}")
    private String awsRegion;
    
    @Bean
    public Region awsRegion() {
        return Region.of(awsRegion);
    }
    
    @Bean
    public KinesisClient kinesisClient() {
        return KinesisClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public DynamoDbClient dynamoDbClient() {
        return DynamoDbClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public BedrockRuntimeClient bedrockRuntimeClient() {
        return BedrockRuntimeClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    

    
    @Bean
    public SageMakerRuntimeClient sageMakerRuntimeClient() {
        return SageMakerRuntimeClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public SqsClient sqsClient() {
        return SqsClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public software.amazon.awssdk.services.costexplorer.CostExplorerClient costExplorerClient() {
        return software.amazon.awssdk.services.costexplorer.CostExplorerClient.builder()
            .region(Region.US_EAST_1) // Cost Explorer is only available in us-east-1
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public software.amazon.awssdk.services.budgets.BudgetsClient budgetsClient() {
        return software.amazon.awssdk.services.budgets.BudgetsClient.builder()
            .region(Region.US_EAST_1) // Budgets is only available in us-east-1
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public software.amazon.awssdk.services.cloudwatch.CloudWatchClient cloudWatchClient() {
        return software.amazon.awssdk.services.cloudwatch.CloudWatchClient.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public software.amazon.awssdk.services.ec2.Ec2Client ec2Client() {
        return software.amazon.awssdk.services.ec2.Ec2Client.builder()
            .region(awsRegion())
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
    
    @Bean
    public software.amazon.awssdk.services.lambda.LambdaClient lambdaClient() {
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