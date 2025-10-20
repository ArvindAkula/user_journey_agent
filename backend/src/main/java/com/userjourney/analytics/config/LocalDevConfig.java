package com.userjourney.analytics.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("dev")
@ConditionalOnProperty(name = "app.local-dev", havingValue = "true", matchIfMissing = true)
public class LocalDevConfig {
    // This configuration is for local development only
    // It excludes AWS-dependent beans that require actual AWS credentials
}