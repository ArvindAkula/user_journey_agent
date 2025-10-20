package com.userjourney.analytics.config;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.encoder.PatternLayoutEncoder;
import ch.qos.logback.core.ConsoleAppender;
import ch.qos.logback.core.rolling.RollingFileAppender;
import ch.qos.logback.core.rolling.TimeBasedRollingPolicy;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cloudwatchlogs.CloudWatchLogsClient;

import javax.annotation.PostConstruct;

/**
 * Configuration for CloudWatch logging integration
 */
@Configuration
@ConditionalOnProperty(name = "logging.cloudwatch.enabled", havingValue = "true")
public class CloudWatchLoggingConfig {

    @Value("${logging.cloudwatch.log-group:/aws/user-journey-analytics/application}")
    private String logGroup;

    @Value("${logging.cloudwatch.log-stream:${HOSTNAME:localhost}-${spring.application.name}}")
    private String logStream;

    @Value("${aws.region:us-east-1}")
    private String region;

    @Value("${logging.cloudwatch.retention-days:30}")
    private int retentionDays;

    @Value("${logging.cloudwatch.batch-size:100}")
    private int batchSize;

    @Value("${logging.cloudwatch.batch-timeout:5000}")
    private int batchTimeout;

    /**
     * CloudWatch Logs client for sending logs
     */
    @Bean
    public CloudWatchLogsClient cloudWatchLogsClient() {
        return CloudWatchLogsClient.builder()
                .region(Region.of(region))
                .build();
    }

    /**
     * Initialize CloudWatch logging configuration
     */
    @PostConstruct
    public void initializeCloudWatchLogging() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        
        // Create CloudWatch appender
        CloudWatchAppender cloudWatchAppender = new CloudWatchAppender();
        cloudWatchAppender.setContext(context);
        cloudWatchAppender.setName("CLOUDWATCH");
        cloudWatchAppender.setLogGroup(logGroup);
        cloudWatchAppender.setLogStream(logStream);
        cloudWatchAppender.setRegion(region);
        cloudWatchAppender.setBatchSize(batchSize);
        cloudWatchAppender.setBatchTimeout(batchTimeout);
        
        // Create encoder for structured logging
        PatternLayoutEncoder encoder = new PatternLayoutEncoder();
        encoder.setContext(context);
        encoder.setPattern("%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level [%X{correlationId}] %logger{36} - %msg%n");
        encoder.start();
        
        cloudWatchAppender.setEncoder(encoder);
        cloudWatchAppender.start();
        
        // Add appender to root logger
        ch.qos.logback.classic.Logger rootLogger = context.getLogger(ch.qos.logback.classic.Logger.ROOT_LOGGER_NAME);
        rootLogger.addAppender(cloudWatchAppender);
        
        // Create separate appenders for different log types
        createStructuredLogAppenders(context);
    }

    /**
     * Create structured log appenders for different log categories
     */
    private void createStructuredLogAppenders(LoggerContext context) {
        // Business events appender
        createCategoryAppender(context, "BUSINESS_EVENTS", 
                logGroup + "/business-events", "business-events-" + logStream);
        
        // Performance metrics appender
        createCategoryAppender(context, "PERFORMANCE_METRICS", 
                logGroup + "/performance", "performance-" + logStream);
        
        // Security events appender
        createCategoryAppender(context, "SECURITY_EVENTS", 
                logGroup + "/security", "security-" + logStream);
        
        // Error logs appender
        createCategoryAppender(context, "ERROR_LOGS", 
                logGroup + "/errors", "errors-" + logStream);
        
        // AI service logs appender
        createCategoryAppender(context, "AI_SERVICE_LOGS", 
                logGroup + "/ai-services", "ai-services-" + logStream);
    }

    /**
     * Create category-specific CloudWatch appender
     */
    private void createCategoryAppender(LoggerContext context, String name, 
                                      String categoryLogGroup, String categoryLogStream) {
        CloudWatchAppender appender = new CloudWatchAppender();
        appender.setContext(context);
        appender.setName(name);
        appender.setLogGroup(categoryLogGroup);
        appender.setLogStream(categoryLogStream);
        appender.setRegion(region);
        appender.setBatchSize(batchSize);
        appender.setBatchTimeout(batchTimeout);
        
        // Create JSON encoder for structured logs
        JsonPatternLayoutEncoder jsonEncoder = new JsonPatternLayoutEncoder();
        jsonEncoder.setContext(context);
        jsonEncoder.start();
        
        appender.setEncoder(jsonEncoder);
        appender.start();
    }
}