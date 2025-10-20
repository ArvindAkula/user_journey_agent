package com.userjourney.analytics.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.bedrock.BedrockClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;

import static org.mockito.Mockito.mock;

@Configuration
@Profile("dev")
public class LocalAwsConfig {

    @Bean
    @Primary
    public SqsClient sqsClient() {
        return mock(SqsClient.class);
    }

    @Bean
    @Primary
    public DynamoDbClient dynamoDbClient() {
        return mock(DynamoDbClient.class);
    }

    @Bean
    @Primary
    public KinesisClient kinesisClient() {
        return mock(KinesisClient.class);
    }

    @Bean
    @Primary
    public BedrockClient bedrockClient() {
        return mock(BedrockClient.class);
    }

    @Bean
    @Primary
    public BedrockRuntimeClient bedrockRuntimeClient() {
        return mock(BedrockRuntimeClient.class);
    }

    @Bean
    @Primary
    public SageMakerRuntimeClient sageMakerRuntimeClient() {
        return mock(SageMakerRuntimeClient.class);
    }
}