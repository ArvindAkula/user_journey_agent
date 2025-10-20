package com.userjourney.analytics.config;

import io.micrometer.core.instrument.config.MeterFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for metrics collection and customization
 */
@Configuration
public class PrometheusConfig {

    @Value("${spring.application.name:user-journey-analytics}")
    private String applicationName;

    /**
     * Customize meter registry with common tags and filters
     */
    @Bean
    public io.micrometer.core.instrument.config.MeterFilter metricsCommonTags() {
        return MeterFilter.commonTags(
            io.micrometer.core.instrument.Tags.of(
                "application", applicationName,
                "environment", System.getProperty("spring.profiles.active", "unknown")
            )
        );
    }

    /**
     * Filter out noisy metrics
     */
    @Bean
    public io.micrometer.core.instrument.config.MeterFilter noisyMetricsFilter() {
        return MeterFilter.deny(id -> {
            // Filter out noisy metrics that aren't useful for monitoring
            String name = id.getName();
            return name.startsWith("jvm.gc.pause") && 
                   id.getTag("cause") != null && 
                   id.getTag("cause").equals("No GC");
        });
    }

    /**
     * Configure maximum expected values for custom metrics
     */
    @Bean
    public io.micrometer.core.instrument.config.MeterFilter businessMetricsFilter() {
        return MeterFilter.accept(id -> {
            // Accept all metrics for now - can be customized later
            return true;
        });
    }
}