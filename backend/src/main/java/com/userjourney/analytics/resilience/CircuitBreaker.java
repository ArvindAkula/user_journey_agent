package com.userjourney.analytics.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Circuit breaker implementation for external service calls
 * Prevents cascading failures by failing fast when services are unavailable
 */
@Component
public class CircuitBreaker {
    
    private static final Logger logger = LoggerFactory.getLogger(CircuitBreaker.class);
    
    private final ConcurrentHashMap<String, CircuitBreakerState> circuits = new ConcurrentHashMap<>();
    
    // Default configuration
    private static final int DEFAULT_FAILURE_THRESHOLD = 5;
    private static final long DEFAULT_TIMEOUT_DURATION_MS = 60000; // 1 minute
    private static final int DEFAULT_SUCCESS_THRESHOLD = 3;
    private static final long DEFAULT_CALL_TIMEOUT_MS = 30000; // 30 seconds
    
    /**
     * Execute a function with circuit breaker protection
     */
    public <T> T execute(String serviceName, Supplier<T> operation, Supplier<T> fallback) {
        return execute(serviceName, operation, fallback, 
                      DEFAULT_FAILURE_THRESHOLD, DEFAULT_TIMEOUT_DURATION_MS, 
                      DEFAULT_SUCCESS_THRESHOLD, DEFAULT_CALL_TIMEOUT_MS);
    }
    
    /**
     * Execute a function with circuit breaker protection and custom configuration
     */
    public <T> T execute(String serviceName, Supplier<T> operation, Supplier<T> fallback,
                        int failureThreshold, long timeoutDurationMs, 
                        int successThreshold, long callTimeoutMs) {
        
        CircuitBreakerState state = circuits.computeIfAbsent(serviceName, 
            k -> new CircuitBreakerState(failureThreshold, timeoutDurationMs, successThreshold));
        
        CircuitState currentState = state.getState();
        
        switch (currentState) {
            case CLOSED:
                return executeClosed(serviceName, operation, fallback, state, callTimeoutMs);
            case OPEN:
                return executeOpen(serviceName, operation, fallback, state);
            case HALF_OPEN:
                return executeHalfOpen(serviceName, operation, fallback, state, callTimeoutMs);
            default:
                logger.error("Unknown circuit state for service: {}", serviceName);
                return fallback.get();
        }
    }
    
    /**
     * Execute when circuit is closed (normal operation)
     */
    private <T> T executeClosed(String serviceName, Supplier<T> operation, Supplier<T> fallback,
                               CircuitBreakerState state, long callTimeoutMs) {
        try {
            T result = executeWithTimeout(operation, callTimeoutMs);
            state.recordSuccess();
            logger.debug("Circuit breaker success for service: {}", serviceName);
            return result;
        } catch (Exception e) {
            state.recordFailure();
            logger.warn("Circuit breaker failure for service: {} - {}", serviceName, e.getMessage());
            
            if (state.shouldOpen()) {
                state.open();
                logger.warn("Circuit breaker opened for service: {} after {} failures", 
                           serviceName, state.getFailureCount());
            }
            
            return fallback.get();
        }
    }
    
    /**
     * Execute when circuit is open (failing fast)
     */
    private <T> T executeOpen(String serviceName, Supplier<T> operation, Supplier<T> fallback,
                             CircuitBreakerState state) {
        if (state.shouldAttemptReset()) {
            state.halfOpen();
            logger.info("Circuit breaker transitioning to half-open for service: {}", serviceName);
            return executeHalfOpen(serviceName, operation, fallback, state, DEFAULT_CALL_TIMEOUT_MS);
        } else {
            logger.debug("Circuit breaker open - failing fast for service: {}", serviceName);
            return fallback.get();
        }
    }
    
    /**
     * Execute when circuit is half-open (testing if service is recovered)
     */
    private <T> T executeHalfOpen(String serviceName, Supplier<T> operation, Supplier<T> fallback,
                                 CircuitBreakerState state, long callTimeoutMs) {
        try {
            T result = executeWithTimeout(operation, callTimeoutMs);
            state.recordSuccess();
            
            if (state.shouldClose()) {
                state.close();
                logger.info("Circuit breaker closed for service: {} after {} successful calls", 
                           serviceName, state.getSuccessCount());
            }
            
            return result;
        } catch (Exception e) {
            state.recordFailure();
            state.open();
            logger.warn("Circuit breaker reopened for service: {} - {}", serviceName, e.getMessage());
            return fallback.get();
        }
    }
    
    /**
     * Execute operation with timeout
     */
    private <T> T executeWithTimeout(Supplier<T> operation, long timeoutMs) {
        // For simplicity, we'll execute directly. In production, you might want to use CompletableFuture with timeout
        long startTime = System.currentTimeMillis();
        try {
            T result = operation.get();
            long duration = System.currentTimeMillis() - startTime;
            if (duration > timeoutMs) {
                throw new RuntimeException("Operation timed out after " + duration + "ms");
            }
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            if (duration > timeoutMs) {
                throw new RuntimeException("Operation timed out after " + duration + "ms", e);
            }
            throw e;
        }
    }
    
    /**
     * Get circuit breaker status for a service
     */
    public CircuitBreakerStatus getStatus(String serviceName) {
        CircuitBreakerState state = circuits.get(serviceName);
        if (state == null) {
            return new CircuitBreakerStatus(serviceName, CircuitState.CLOSED, 0, 0, null);
        }
        
        return new CircuitBreakerStatus(
            serviceName,
            state.getState(),
            state.getFailureCount(),
            state.getSuccessCount(),
            state.getLastFailureTime()
        );
    }
    
    /**
     * Reset circuit breaker for a service
     */
    public void reset(String serviceName) {
        CircuitBreakerState state = circuits.get(serviceName);
        if (state != null) {
            state.close();
            logger.info("Circuit breaker manually reset for service: {}", serviceName);
        }
    }
    
    /**
     * Get all circuit breaker statuses
     */
    public ConcurrentHashMap<String, CircuitBreakerStatus> getAllStatuses() {
        ConcurrentHashMap<String, CircuitBreakerStatus> statuses = new ConcurrentHashMap<>();
        circuits.forEach((serviceName, state) -> {
            statuses.put(serviceName, new CircuitBreakerStatus(
                serviceName,
                state.getState(),
                state.getFailureCount(),
                state.getSuccessCount(),
                state.getLastFailureTime()
            ));
        });
        return statuses;
    }
    
    /**
     * Circuit breaker state management
     */
    private static class CircuitBreakerState {
        private final AtomicReference<CircuitState> state = new AtomicReference<>(CircuitState.CLOSED);
        private final AtomicInteger failureCount = new AtomicInteger(0);
        private final AtomicInteger successCount = new AtomicInteger(0);
        private final AtomicLong lastFailureTime = new AtomicLong(0);
        private final AtomicLong stateChangeTime = new AtomicLong(System.currentTimeMillis());
        
        private final int failureThreshold;
        private final long timeoutDurationMs;
        private final int successThreshold;
        
        public CircuitBreakerState(int failureThreshold, long timeoutDurationMs, int successThreshold) {
            this.failureThreshold = failureThreshold;
            this.timeoutDurationMs = timeoutDurationMs;
            this.successThreshold = successThreshold;
        }
        
        public CircuitState getState() {
            return state.get();
        }
        
        public void recordSuccess() {
            successCount.incrementAndGet();
            if (state.get() == CircuitState.CLOSED) {
                failureCount.set(0); // Reset failure count on success in closed state
            }
        }
        
        public void recordFailure() {
            failureCount.incrementAndGet();
            lastFailureTime.set(System.currentTimeMillis());
            successCount.set(0); // Reset success count on failure
        }
        
        public boolean shouldOpen() {
            return state.get() == CircuitState.CLOSED && failureCount.get() >= failureThreshold;
        }
        
        public boolean shouldClose() {
            return state.get() == CircuitState.HALF_OPEN && successCount.get() >= successThreshold;
        }
        
        public boolean shouldAttemptReset() {
            return state.get() == CircuitState.OPEN && 
                   (System.currentTimeMillis() - stateChangeTime.get()) >= timeoutDurationMs;
        }
        
        public void open() {
            state.set(CircuitState.OPEN);
            stateChangeTime.set(System.currentTimeMillis());
        }
        
        public void close() {
            state.set(CircuitState.CLOSED);
            stateChangeTime.set(System.currentTimeMillis());
            failureCount.set(0);
            successCount.set(0);
        }
        
        public void halfOpen() {
            state.set(CircuitState.HALF_OPEN);
            stateChangeTime.set(System.currentTimeMillis());
            successCount.set(0);
        }
        
        public int getFailureCount() {
            return failureCount.get();
        }
        
        public int getSuccessCount() {
            return successCount.get();
        }
        
        public Instant getLastFailureTime() {
            long time = lastFailureTime.get();
            return time > 0 ? Instant.ofEpochMilli(time) : null;
        }
    }
    
    /**
     * Circuit states
     */
    public enum CircuitState {
        CLOSED,    // Normal operation
        OPEN,      // Failing fast
        HALF_OPEN  // Testing if service recovered
    }
    
    /**
     * Circuit breaker status information
     */
    public static class CircuitBreakerStatus {
        private final String serviceName;
        private final CircuitState state;
        private final int failureCount;
        private final int successCount;
        private final Instant lastFailureTime;
        
        public CircuitBreakerStatus(String serviceName, CircuitState state, 
                                   int failureCount, int successCount, Instant lastFailureTime) {
            this.serviceName = serviceName;
            this.state = state;
            this.failureCount = failureCount;
            this.successCount = successCount;
            this.lastFailureTime = lastFailureTime;
        }
        
        // Getters
        public String getServiceName() { return serviceName; }
        public CircuitState getState() { return state; }
        public int getFailureCount() { return failureCount; }
        public int getSuccessCount() { return successCount; }
        public Instant getLastFailureTime() { return lastFailureTime; }
    }
}