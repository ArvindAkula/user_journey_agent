package com.userjourney.analytics.resilience;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for CircuitBreaker functionality
 */
public class CircuitBreakerTest {
    
    private CircuitBreaker circuitBreaker;
    
    @BeforeEach
    void setUp() {
        circuitBreaker = new CircuitBreaker();
    }
    
    @Test
    void testCircuitBreakerClosedState() {
        String serviceName = "TestService";
        AtomicInteger callCount = new AtomicInteger(0);
        
        Supplier<String> service = () -> {
            callCount.incrementAndGet();
            return "Success";
        };
        
        Supplier<String> fallback = () -> "Fallback";
        
        String result = circuitBreaker.execute(serviceName, service, fallback);
        
        assertEquals("Success", result);
        assertEquals(1, callCount.get());
        
        CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(serviceName);
        assertEquals(CircuitBreaker.CircuitState.CLOSED, status.getState());
        assertEquals(0, status.getFailureCount());
    }
    
    @Test
    void testCircuitBreakerOpensAfterFailures() {
        String serviceName = "FailingService";
        AtomicInteger callCount = new AtomicInteger(0);
        AtomicInteger fallbackCount = new AtomicInteger(0);
        
        Supplier<String> failingService = () -> {
            callCount.incrementAndGet();
            throw new RuntimeException("Service failure");
        };
        
        Supplier<String> fallback = () -> {
            fallbackCount.incrementAndGet();
            return "Fallback";
        };
        
        // Trigger failures to open circuit breaker
        for (int i = 0; i < 6; i++) {
            String result = circuitBreaker.execute(serviceName, failingService, fallback);
            assertEquals("Fallback", result);
        }
        
        assertTrue(fallbackCount.get() > 0);
        
        CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(serviceName);
        assertTrue(status.getFailureCount() > 0);
    }
    
    @Test
    void testCircuitBreakerReset() {
        String serviceName = "ResetTestService";
        
        // Trigger failures
        Supplier<String> failingService = () -> {
            throw new RuntimeException("Failure");
        };
        Supplier<String> fallback = () -> "Fallback";
        
        for (int i = 0; i < 6; i++) {
            circuitBreaker.execute(serviceName, failingService, fallback);
        }
        
        // Reset circuit breaker
        circuitBreaker.reset(serviceName);
        
        CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(serviceName);
        assertEquals(CircuitBreaker.CircuitState.CLOSED, status.getState());
    }
    
    @Test
    void testMultipleServices() {
        String service1 = "Service1";
        String service2 = "Service2";
        
        Supplier<String> successService = () -> "Success";
        Supplier<String> fallback = () -> "Fallback";
        
        String result1 = circuitBreaker.execute(service1, successService, fallback);
        String result2 = circuitBreaker.execute(service2, successService, fallback);
        
        assertEquals("Success", result1);
        assertEquals("Success", result2);
        
        // Verify both services are tracked separately
        assertNotNull(circuitBreaker.getStatus(service1));
        assertNotNull(circuitBreaker.getStatus(service2));
    }
}