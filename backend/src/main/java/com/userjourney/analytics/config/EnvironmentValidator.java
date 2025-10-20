package com.userjourney.analytics.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates required environment variables on application startup.
 * Implements fail-fast behavior to prevent application from starting with missing configuration.
 */
@Component
public class EnvironmentValidator implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger logger = LoggerFactory.getLogger(EnvironmentValidator.class);

    private final Environment environment;

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    public EnvironmentValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        logger.info("Starting environment variable validation for profile: {}", activeProfile);
        
        List<String> missingVariables = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // Common required variables for all profiles
        validateCommonVariables(missingVariables, warnings);

        // Profile-specific validation
        if ("prod".equals(activeProfile) || "production".equals(activeProfile)) {
            validateProductionVariables(missingVariables, warnings);
        } else if ("dev".equals(activeProfile) || "development".equals(activeProfile)) {
            validateDevelopmentVariables(missingVariables, warnings);
        }

        // Log warnings
        if (!warnings.isEmpty()) {
            logger.warn("Environment configuration warnings:");
            warnings.forEach(warning -> logger.warn("  - {}", warning));
        }

        // Fail fast if required variables are missing
        if (!missingVariables.isEmpty()) {
            logger.error("=".repeat(80));
            logger.error("CRITICAL: Missing required environment variables!");
            logger.error("=".repeat(80));
            logger.error("The following required environment variables are not set:");
            missingVariables.forEach(var -> logger.error("  - {}", var));
            logger.error("");
            logger.error("Please set these variables before starting the application.");
            logger.error("See .env.template files for examples and documentation.");
            logger.error("=".repeat(80));
            
            throw new IllegalStateException(
                "Application startup failed: Missing required environment variables. " +
                "Missing: " + String.join(", ", missingVariables)
            );
        }

        logger.info("Environment variable validation completed successfully");
    }

    private void validateCommonVariables(List<String> missingVariables, List<String> warnings) {
        // JWT Configuration
        String jwtSecret = environment.getProperty("app.jwt.secret");
        if (isDefaultOrMissing(jwtSecret, "ZGVmYXVsdFNlY3JldEtleVRoYXRTaG91bGRCZUNoYW5nZWRJblByb2R1Y3Rpb24=")) {
            if ("prod".equals(activeProfile) || "production".equals(activeProfile)) {
                missingVariables.add("JWT_SECRET (app.jwt.secret) - Using default value is not allowed in production");
            } else {
                warnings.add("JWT_SECRET (app.jwt.secret) - Using default value (acceptable in dev mode)");
            }
        }

        // Encryption Key
        String encryptionKey = environment.getProperty("app.encryption.key");
        if (isDefaultOrMissing(encryptionKey, "ZGVmYXVsdEVuY3J5cHRpb25LZXlUaGF0U2hvdWxkQmVDaGFuZ2VkSW5Qcm9kdWN0aW9u")) {
            if ("prod".equals(activeProfile) || "production".equals(activeProfile)) {
                missingVariables.add("ENCRYPTION_KEY (app.encryption.key) - Using default value is not allowed in production");
            } else {
                warnings.add("ENCRYPTION_KEY (app.encryption.key) - Using default value (acceptable in dev mode)");
            }
        }

        // Firebase Configuration
        String firebaseProjectId = environment.getProperty("firebase.project-id");
        if (isNullOrEmpty(firebaseProjectId)) {
            missingVariables.add("FIREBASE_PROJECT_ID (firebase.project-id)");
        }

        // AWS Region
        String awsRegion = environment.getProperty("aws.region");
        if (isNullOrEmpty(awsRegion)) {
            warnings.add("AWS_REGION (aws.region) - Using default value");
        }
    }

    private void validateProductionVariables(List<String> missingVariables, List<String> warnings) {
        logger.info("Validating production-specific environment variables...");

        // Firebase Production Configuration
        String firebaseCredentialsPath = environment.getProperty("firebase.credentials-path");
        if (isNullOrEmpty(firebaseCredentialsPath)) {
            missingVariables.add("FIREBASE_CREDENTIALS_PATH (firebase.credentials-path)");
        }

        // AWS Services Configuration
        String kinesisStreamName = environment.getProperty("aws.kinesis.stream-name");
        if (isNullOrEmpty(kinesisStreamName)) {
            missingVariables.add("KINESIS_STREAM_NAME (aws.kinesis.stream-name)");
        }

        String s3BucketName = environment.getProperty("aws.s3.bucket-name");
        if (isNullOrEmpty(s3BucketName)) {
            missingVariables.add("S3_BUCKET_NAME (aws.s3.bucket-name)");
        }

        String sqsDlqUrl = environment.getProperty("aws.sqs.dlq.url");
        if (isNullOrEmpty(sqsDlqUrl)) {
            missingVariables.add("AWS_SQS_DLQ_URL (aws.sqs.dlq.url)");
        }

        String sqsRetryQueueUrl = environment.getProperty("aws.sqs.retry-queue.url");
        if (isNullOrEmpty(sqsRetryQueueUrl)) {
            missingVariables.add("AWS_SQS_RETRY_QUEUE_URL (aws.sqs.retry-queue.url)");
        }

        // Bedrock Configuration
        String bedrockAgentId = environment.getProperty("bedrock.agent.id");
        if (isNullOrEmpty(bedrockAgentId)) {
            warnings.add("BEDROCK_AGENT_ID (bedrock.agent.id) - Bedrock features may not work");
        }

        String bedrockAgentAliasId = environment.getProperty("bedrock.agent.alias.id");
        if (isNullOrEmpty(bedrockAgentAliasId)) {
            warnings.add("BEDROCK_AGENT_ALIAS_ID (bedrock.agent.alias.id) - Bedrock features may not work");
        }

        // SageMaker Configuration
        String sagemakerEndpoint = environment.getProperty("sagemaker.exit-risk.endpoint-name");
        if (isNullOrEmpty(sagemakerEndpoint)) {
            warnings.add("SAGEMAKER_EXIT_RISK_ENDPOINT (sagemaker.exit-risk.endpoint-name) - Predictive features may not work");
        }

        // Redis Configuration
        String redisHost = environment.getProperty("spring.data.redis.host");
        if (isNullOrEmpty(redisHost)) {
            missingVariables.add("REDIS_HOST (spring.data.redis.host)");
        }

        String redisPassword = environment.getProperty("spring.data.redis.password");
        if (isNullOrEmpty(redisPassword)) {
            warnings.add("REDIS_PASSWORD (spring.data.redis.password) - Redis may not be secured");
        }
    }

    private void validateDevelopmentVariables(List<String> missingVariables, List<String> warnings) {
        logger.info("Validating development-specific environment variables...");

        // Check if LocalStack is configured
        String mockEnabled = environment.getProperty("aws.mock.enabled");
        if (!"true".equals(mockEnabled)) {
            warnings.add("AWS mock is not enabled - expecting LocalStack to be running");
        }

        String mockEndpoint = environment.getProperty("aws.mock.endpoint");
        if (isNullOrEmpty(mockEndpoint)) {
            warnings.add("AWS_MOCK_ENDPOINT (aws.mock.endpoint) - Using default LocalStack endpoint");
        }

        // Check if Firebase emulator is configured
        String firebaseEmulatorEnabled = environment.getProperty("firebase.emulator.enabled");
        if (!"true".equals(firebaseEmulatorEnabled)) {
            warnings.add("Firebase emulator is not enabled - expecting Firebase emulator to be running");
        }

        // Development credentials
        String firebaseCredentialsPath = environment.getProperty("firebase.credentials-path");
        if (isNullOrEmpty(firebaseCredentialsPath)) {
            warnings.add("FIREBASE_CREDENTIALS_PATH (firebase.credentials-path) - Using default dev credentials");
        }
    }

    private boolean isNullOrEmpty(String value) {
        return value == null || value.trim().isEmpty();
    }

    private boolean isDefaultOrMissing(String value, String defaultValue) {
        return isNullOrEmpty(value) || defaultValue.equals(value);
    }
}
