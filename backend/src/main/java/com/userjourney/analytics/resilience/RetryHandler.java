package com.userjourney.analytics.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;

/**
 * Retry handler with exponential backoff and jitter
 * Provides resilient retry logic for external service calls
 */
@Component
public class RetryHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(RetryHandler.class);
    
    private final Random random = new Random();
    private final Executor retryExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "retry-handler");
        t.setDaemon(true);
        return t;
    });
    
    // Default retry configuration
    private static final int DEFAULT_MAX_ATTEMPTS = 3;
    private static final Duration DEFAULT_INITIAL_DELAY = Duration.ofMillis(100);
    private static final double DEFAULT_BACKOFF_MULTIPLIER = 2.0;
    private static final Duration DEFAULT_MAX_DELAY = Duration.ofSeconds(30);
    private static final double DEFAULT_JITTER_FACTOR = 0.1;
    
    /**
     * Execute operation with default retry configuration
     */
    public <T> T executeWithRetry(String operationName, Supplier<T> operation) {
        return executeWithRetry(operationName, operation, RetryConfig.defaultConfig());
    }
    
    /**
     * Execute operation with custom retry configuration
     */
    public <T> T executeWithRetry(String operationName, Supplier<T> operation, RetryConfig config) {
        Exception lastException = null;
        
        for (int attempt = 1; attempt <= config.getMaxAttempts(); attempt++) {
            try {
                logger.debug("Executing {} - attempt {}/{}", operationName, attempt, config.getMaxAttempts());
                
                T result = operation.get();
                
                if (attempt > 1) {
                    logger.info("Operation {} succeeded on attempt {}/{}", operationName, attempt, config.getMaxAttempts());
                }
                
                return result;
                
            } catch (Exception e) {
                lastException = e;
                
                if (attempt == config.getMaxAttempts()) {
                    logger.error("Operation {} failed after {} attempts", operationName, config.getMaxAttempts(), e);
                    break;
                }
                
                if (!config.shouldRetry(e)) {
                    logger.warn("Operation {} failed with non-retryable exception: {}", operationName, e.getMessage());
                    break;
                }
                
                Duration delay = calculateDelay(attempt, config);
                logger.warn("Operation {} failed on attempt {}/{}, retrying in {}ms: {}", 
                           operationName, attempt, config.getMaxAttempts(), delay.toMillis(), e.getMessage());
                
                try {
                    Thread.sleep(delay.toMillis());
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Retry interrupted", ie);
                }
            }
        }
        
        throw new RetryExhaustedException(operationName, config.getMaxAttempts(), lastException);
    }
    
    /**
     * Execute operation asynchronously with retry
     */
    public <T> CompletableFuture<T> executeWithRetryAsync(String operationName, Supplier<T> operation) {
        return executeWithRetryAsync(operationName, operation, RetryConfig.defaultConfig());
    }
    
    /**
     * Execute operation asynchronously with custom retry configuration
     */
    public <T> CompletableFuture<T> executeWithRetryAsync(String operationName, Supplier<T> operation, RetryConfig config) {
        return CompletableFuture.supplyAsync(() -> executeWithRetry(operationName, operation, config), retryExecutor);
    }
    
    /**
     * Execute operation with retry and fallback
     */
    public <T> T executeWithRetryAndFallback(String operationName, Supplier<T> operation, 
                                           Supplier<T> fallback, RetryConfig config) {
        try {
            return executeWithRetry(operationName, operation, config);
        } catch (RetryExhaustedException e) {
            logger.warn("All retry attempts exhausted for {}, using fallback", operationName);
            return fallback.get();
        }
    }
    
    /**
     * Calculate delay with exponential backoff and jitter
     */
    private Duration calculateDelay(int attempt, RetryConfig config) {
        // Calculate exponential backoff
        long baseDelayMs = config.getInitialDelay().toMillis();
        long exponentialDelay = (long) (baseDelayMs * Math.pow(config.getBackoffMultiplier(), attempt - 1));
        
        // Apply maximum delay limit
        long delayMs = Math.min(exponentialDelay, config.getMaxDelay().toMillis());
        
        // Add jitter to prevent thundering herd
        if (config.getJitterFactor() > 0) {
            double jitter = 1.0 + (random.nextDouble() - 0.5) * 2 * config.getJitterFactor();
            delayMs = (long) (delayMs * jitter);
        }
        
        return Duration.ofMillis(Math.max(0, delayMs));
    }
    
    /**
     * Retry configuration class
     */
    public static class RetryConfig {
        private final int maxAttempts;
        private final Duration initialDelay;
        private final double backoffMultiplier;
        private final Duration maxDelay;
        private final double jitterFactor;
        private final Predicate<Exception> retryPredicate;
        
        private RetryConfig(Builder builder) {
            this.maxAttempts = builder.maxAttempts;
            this.initialDelay = builder.initialDelay;
            this.backoffMultiplier = builder.backoffMultiplier;
            this.maxDelay = builder.maxDelay;
            this.jitterFactor = builder.jitterFactor;
            this.retryPredicate = builder.retryPredicate;
        }
        
        public static RetryConfig defaultConfig() {
            return new Builder().build();
        }
        
        public static Builder builder() {
            return new Builder();
        }
        
        public boolean shouldRetry(Exception e) {
            return retryPredicate.test(e);
        }
        
        // Getters
        public int getMaxAttempts() { return maxAttempts; }
        public Duration getInitialDelay() { return initialDelay; }
        public double getBackoffMultiplier() { return backoffMultiplier; }
        public Duration getMaxDelay() { return maxDelay; }
        public double getJitterFactor() { return jitterFactor; }
        
        public static class Builder {
            private int maxAttempts = DEFAULT_MAX_ATTEMPTS;
            private Duration initialDelay = DEFAULT_INITIAL_DELAY;
            private double backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER;
            private Duration maxDelay = DEFAULT_MAX_DELAY;
            private double jitterFactor = DEFAULT_JITTER_FACTOR;
            private Predicate<Exception> retryPredicate = this::defaultRetryPredicate;
            
            public Builder maxAttempts(int maxAttempts) {
                this.maxAttempts = maxAttempts;
                return this;
            }
            
            public Builder initialDelay(Duration initialDelay) {
                this.initialDelay = initialDelay;
                return this;
            }
            
            public Builder backoffMultiplier(double backoffMultiplier) {
                this.backoffMultiplier = backoffMultiplier;
                return this;
            }
            
            public Builder maxDelay(Duration maxDelay) {
                this.maxDelay = maxDelay;
                return this;
            }
            
            public Builder jitterFactor(double jitterFactor) {
                this.jitterFactor = jitterFactor;
                return this;
            }
            
            public Builder retryOn(Class<? extends Exception>... exceptionTypes) {
                this.retryPredicate = e -> {
                    for (Class<? extends Exception> type : exceptionTypes) {
                        if (type.isInstance(e)) {
                            return true;
                        }
                    }
                    return false;
                };
                return this;
            }
            
            public Builder retryIf(Predicate<Exception> predicate) {
                this.retryPredicate = predicate;
                return this;
            }
            
            public RetryConfig build() {
                return new RetryConfig(this);
            }
            
            private boolean defaultRetryPredicate(Exception e) {
                // Retry on common transient exceptions
                String message = e.getMessage();
                if (message != null) {
                    String lowerMessage = message.toLowerCase();
                    return lowerMessage.contains("timeout") ||
                           lowerMessage.contains("connection") ||
                           lowerMessage.contains("network") ||
                           lowerMessage.contains("unavailable") ||
                           lowerMessage.contains("throttl") ||
                           lowerMessage.contains("rate limit") ||
                           lowerMessage.contains("service temporarily unavailable");
                }
                
                // Retry on specific exception types
                return e instanceof java.net.SocketTimeoutException ||
                       e instanceof java.net.ConnectException ||
                       e instanceof java.io.IOException ||
                       e instanceof RuntimeException && e.getCause() instanceof java.net.SocketTimeoutException;
            }
        }
    }
    
    /**
     * Exception thrown when all retry attempts are exhausted
     */
    public static class RetryExhaustedException extends RuntimeException {
        private final String operationName;
        private final int maxAttempts;
        
        public RetryExhaustedException(String operationName, int maxAttempts, Throwable cause) {
            super(String.format("Operation '%s' failed after %d attempts", operationName, maxAttempts), cause);
            this.operationName = operationName;
            this.maxAttempts = maxAttempts;
        }
        
        public String getOperationName() { return operationName; }
        public int getMaxAttempts() { return maxAttempts; }
    }
    
    /**
     * Retry statistics for monitoring
     */
    public static class RetryStats {
        private final String operationName;
        private final int totalAttempts;
        private final Duration totalDuration;
        private final boolean successful;
        private final Instant startTime;
        private final Instant endTime;
        
        public RetryStats(String operationName, int totalAttempts, Duration totalDuration, 
                         boolean successful, Instant startTime, Instant endTime) {
            this.operationName = operationName;
            this.totalAttempts = totalAttempts;
            this.totalDuration = totalDuration;
            this.successful = successful;
            this.startTime = startTime;
            this.endTime = endTime;
        }
        
        // Getters
        public String getOperationName() { return operationName; }
        public int getTotalAttempts() { return totalAttempts; }
        public Duration getTotalDuration() { return totalDuration; }
        public boolean isSuccessful() { return successful; }
        public Instant getStartTime() { return startTime; }
        public Instant getEndTime() { return endTime; }
    }
}