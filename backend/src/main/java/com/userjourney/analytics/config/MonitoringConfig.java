package com.userjourney.analytics.config;

import io.micrometer.cloudwatch2.CloudWatchConfig;
import io.micrometer.cloudwatch2.CloudWatchMeterRegistry;
import io.micrometer.core.instrument.Clock;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;

import java.time.Duration;
import java.util.Map;

@Configuration
public class MonitoringConfig {

    @Value("${aws.region:us-east-1}")
    private String awsRegion;

    @Value("${spring.application.name:user-journey-analytics}")
    private String applicationName;

    @Value("${monitoring.namespace:UserJourneyAnalytics}")
    private String namespace;

    @Value("${monitoring.enabled:true}")
    private boolean monitoringEnabled;

    @Bean
    public CloudWatchAsyncClient cloudWatchAsyncClient() {
        return CloudWatchAsyncClient.builder()
                .region(software.amazon.awssdk.regions.Region.of(awsRegion))
                .build();
    }

    @Bean
    public MeterRegistry meterRegistry(CloudWatchAsyncClient cloudWatchAsyncClient) {
        if (!monitoringEnabled) {
            return new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        }

        CloudWatchConfig cloudWatchConfig = new CloudWatchConfig() {
            private final Map<String, String> configuration = Map.of(
                "cloudwatch.namespace", namespace,
                "cloudwatch.step", "PT1M" // 1 minute intervals
            );

            @Override
            public String get(String key) {
                return configuration.get(key);
            }

            @Override
            public Duration step() {
                return Duration.ofMinutes(1);
            }

            @Override
            public String namespace() {
                return namespace;
            }

            @Override
            public boolean enabled() {
                return monitoringEnabled;
            }
        };

        return new CloudWatchMeterRegistry(cloudWatchConfig, Clock.SYSTEM, cloudWatchAsyncClient);
    }
}