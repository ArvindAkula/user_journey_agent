package com.userjourney.analytics.config;

import com.userjourney.analytics.resilience.CircuitBreaker;
import com.userjourney.analytics.resilience.ErrorHandlingService;
import com.userjourney.analytics.resilience.RetryHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Configuration for resilience features including circuit breakers, retry logic, and error handling
 */
@Configuration
@EnableScheduling
public class ResilienceConfig {
    
    @Value("${resilience.circuit-breaker.failure-threshold:5}")
    private int circuitBreakerFailureThreshold;
    
    @Value("${resilience.circuit-breaker.timeout-duration:60000}")
    private long circuitBreakerTimeoutDuration;
    
    @Value("${resilience.circuit-breaker.success-threshold:3}")
    private int circuitBreakerSuccessThreshold;
    
    @Value("${resilience.retry.max-attempts:3}")
    private int retryMaxAttempts;
    
    @Value("${resilience.retry.initial-delay:500}")
    private long retryInitialDelay;
    
    @Value("${resilience.retry.backoff-multiplier:2.0}")
    private double retryBackoffMultiplier;
    
    @Value("${resilience.retry.max-delay:30000}")
    private long retryMaxDelay;
    
    @Bean
    public CircuitBreaker circuitBreaker() {
        return new CircuitBreaker();
    }
    
    @Bean
    public RetryHandler retryHandler() {
        return new RetryHandler();
    }
    
    @Bean
    public ErrorHandlingService errorHandlingService() {
        return new ErrorHandlingService();
    }
    
    /**
     * Get circuit breaker configuration
     */
    public CircuitBreakerConfig getCircuitBreakerConfig() {
        return new CircuitBreakerConfig(
            circuitBreakerFailureThreshold,
            circuitBreakerTimeoutDuration,
            circuitBreakerSuccessThreshold
        );
    }
    
    /**
     * Get retry configuration
     */
    public RetryConfig getRetryConfig() {
        return new RetryConfig(
            retryMaxAttempts,
            retryInitialDelay,
            retryBackoffMultiplier,
            retryMaxDelay
        );
    }
    
    /**
     * Circuit breaker configuration holder
     */
    public static class CircuitBreakerConfig {
        private final int failureThreshold;
        private final long timeoutDuration;
        private final int successThreshold;
        
        public CircuitBreakerConfig(int failureThreshold, long timeoutDuration, int successThreshold) {
            this.failureThreshold = failureThreshold;
            this.timeoutDuration = timeoutDuration;
            this.successThreshold = successThreshold;
        }
        
        public int getFailureThreshold() { return failureThreshold; }
        public long getTimeoutDuration() { return timeoutDuration; }
        public int getSuccessThreshold() { return successThreshold; }
    }
    
    /**
     * Retry configuration holder
     */
    public static class RetryConfig {
        private final int maxAttempts;
        private final long initialDelay;
        private final double backoffMultiplier;
        private final long maxDelay;
        
        public RetryConfig(int maxAttempts, long initialDelay, double backoffMultiplier, long maxDelay) {
            this.maxAttempts = maxAttempts;
            this.initialDelay = initialDelay;
            this.backoffMultiplier = backoffMultiplier;
            this.maxDelay = maxDelay;
        }
        
        public int getMaxAttempts() { return maxAttempts; }
        public long getInitialDelay() { return initialDelay; }
        public double getBackoffMultiplier() { return backoffMultiplier; }
        public long getMaxDelay() { return maxDelay; }
    }
}