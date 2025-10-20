package com.userjourney.analytics.resilience;

import com.userjourney.analytics.controller.ResilienceMonitoringController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for resilience features
 * Tests the complete resilience stack working together
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
    "resilience.circuit-breaker.failure-threshold=3",
    "resilience.circuit-breaker.timeout-duration=5000",
    "resilience.retry.max-attempts=2",
    "resilience.retry.initial-delay=100"
})
public class ResilienceIntegrationTest {
    
    @LocalServerPort
    private int port;
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Autowired
    private CircuitBreaker circuitBreaker;
    
    @Autowired
    private RetryHandler retryHandler;
    
    @Autowired
    private ErrorHandlingService errorHandlingService;
    
    @Autowired
    private ResilienceMonitoringController monitoringController;
    
    private String baseUrl;
    
    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port + "/api/resilience";
        
        // Clear any existing state
        errorHandlingService.clearErrorStatistics();
    }
    
    /**
     * Test complete resilience health endpoint
     */
    @Test
    void testResilienceHealthEndpoint() {
        ResponseEntity<Map> response = restTemplate.getForEntity(baseUrl + "/health", Map.class);
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        
        Map<String, Object> health = response.getBody();
        assertTrue(health.containsKey("status"));
        assertTrue(health.containsKey("circuitBreakers"));
        assertTrue(health.containsKey("errors"));
        assertTrue(health.containsKey("timestamp"));
    }
    
    /**
     * Test circuit breaker integration with monitoring
     */
    @Test
    void testCircuitBreakerIntegration() {
        String serviceName = "IntegrationTestService";
        AtomicInteger callCount = new AtomicInteger(0);
        
        // Trigger circuit breaker by causing failures
        for (int i = 0; i < 5; i++) {
            circuitBreaker.execute(
                serviceName,
                () -> {
                    callCount.incrementAndGet();
                    throw new RuntimeException("Test failure");
                },
                () -> "Fallback"
            );
        }
        
        // Check circuit breaker status via monitoring endpoint
        ResponseEntity<Map> statusResponse = restTemplate.getForEntity(
            baseUrl + "/circuit-breakers/" + serviceName, Map.class);
        
        assertEquals(HttpStatus.OK, statusResponse.getStatusCode());
        assertNotNull(statusResponse.getBody());
        
        Map<String, Object> status = statusResponse.getBody();
        assertTrue((Integer) status.get("failureCount") > 0);
    }
    
    /**
     * Test error handling integration
     */
    @Test
    void testErrorHandlingIntegration() {
        // Generate some errors
        for (int i = 0; i < 3; i++) {
            errorHandlingService.handleError("TestComponent", "testOperation", 
                new RuntimeException("Test error " + i), Map.of("iteration", i));
        }
        
        // Check error statistics via monitoring endpoint
        ResponseEntity<Map> errorResponse = restTemplate.getForEntity(baseUrl + "/errors", Map.class);
        
        assertEquals(HttpStatus.OK, errorResponse.getStatusCode());
        assertNotNull(errorResponse.getBody());
        
        Map<String, Object> errors = errorResponse.getBody();
        assertFalse(errors.isEmpty());
    }
    
    /**
     * Test resilience under concurrent load
     */
    @Test
    void testResilienceUnderConcurrentLoad() throws InterruptedException {
        String serviceName = "ConcurrentLoadTest";
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger fallbackCount = new AtomicInteger(0);
        
        ExecutorService executor = Executors.newFixedThreadPool(10);
        
        // Submit concurrent requests
        for (int i = 0; i < 50; i++) {
            final int requestId = i;
            executor.submit(() -> {
                try {
                    String result = circuitBreaker.execute(
                        serviceName,
                        () -> {
                            // Simulate 20% failure rate
                            if (requestId % 5 == 0) {
                                throw new RuntimeException("Simulated failure");
                            }
                            return "Success";
                        },
                        () -> {
                            fallbackCount.incrementAndGet();
                            return "Fallback";
                        }
                    );
                    
                    if ("Success".equals(result)) {
                        successCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    // Handle any unexpected errors
                    errorHandlingService.handleError("ConcurrentTest", "execute", e, 
                        Map.of("requestId", requestId));
                }
            });
        }
        
        executor.shutdown();
        executor.awaitTermination(30, TimeUnit.SECONDS);
        
        // Verify system handled concurrent load
        assertTrue(successCount.get() > 0, "Should have successful requests");
        assertTrue(fallbackCount.get() > 0, "Should have fallback responses");
        
        // Check health after load test
        ResponseEntity<Map> healthResponse = restTemplate.getForEntity(baseUrl + "/health", Map.class);
        assertEquals(HttpStatus.OK, healthResponse.getStatusCode());
    }
    
    /**
     * Test retry mechanism integration
     */
    @Test
    void testRetryMechanismIntegration() {
        AtomicInteger attemptCount = new AtomicInteger(0);
        
        // Service that fails first attempt, succeeds on second
        String result = retryHandler.executeWithRetry(
            "RetryIntegrationTest",
            () -> {
                int attempt = attemptCount.incrementAndGet();
                if (attempt == 1) {
                    throw new RuntimeException("First attempt failure");
                }
                return "Success on retry";
            },
            RetryHandler.RetryConfig.builder()
                .maxAttempts(2)
                .initialDelay(java.time.Duration.ofMillis(50))
                .build()
        );
        
        assertEquals("Success on retry", result);
        assertEquals(2, attemptCount.get());
    }
    
    /**
     * Test graceful degradation scenario
     */
    @Test
    void testGracefulDegradation() {
        String feature = "TestFeature";
        Exception testError = new RuntimeException("Service overloaded");
        String degradedValue = "Simplified response";
        String reason = "Service overload detected";
        
        String result = errorHandlingService.handleGracefulDegradation(
            feature, testError, degradedValue, reason);
        
        assertEquals(degradedValue, result);
        
        // Verify degradation was recorded
        Map<String, ErrorHandlingService.ErrorMetrics> errorStats = 
            errorHandlingService.getErrorStatistics();
        
        assertTrue(errorStats.containsKey("GracefulDegradation:" + feature));
    }
    
    /**
     * Test monitoring endpoints functionality
     */
    @Test
    void testMonitoringEndpoints() {
        // Test health endpoint
        ResponseEntity<Map> healthResponse = restTemplate.getForEntity(baseUrl + "/health", Map.class);
        assertEquals(HttpStatus.OK, healthResponse.getStatusCode());
        
        // Test circuit breakers endpoint
        ResponseEntity<Map> circuitResponse = restTemplate.getForEntity(baseUrl + "/circuit-breakers", Map.class);
        assertEquals(HttpStatus.OK, circuitResponse.getStatusCode());
        
        // Test config endpoint
        ResponseEntity<Map> configResponse = restTemplate.getForEntity(baseUrl + "/config", Map.class);
        assertEquals(HttpStatus.OK, configResponse.getStatusCode());
        
        Map<String, Object> config = configResponse.getBody();
        assertNotNull(config);
        assertTrue(config.containsKey("circuitBreaker"));
        assertTrue(config.containsKey("retry"));
    }
    
    /**
     * Test resilience feature testing endpoints
     */
    @Test
    void testResilienceFeatureTestEndpoints() {
        // Test circuit breaker feature
        ResponseEntity<Map> cbTestResponse = restTemplate.postForEntity(
            baseUrl + "/test/circuit-breaker?shouldFail=false", null, Map.class);
        assertEquals(HttpStatus.OK, cbTestResponse.getStatusCode());
        
        Map<String, Object> cbResult = cbTestResponse.getBody();
        assertNotNull(cbResult);
        assertTrue((Boolean) cbResult.get("success"));
        
        // Test error handling feature
        ResponseEntity<Map> ehTestResponse = restTemplate.postForEntity(
            baseUrl + "/test/error-handling?shouldFail=true", null, Map.class);
        assertEquals(HttpStatus.OK, ehTestResponse.getStatusCode());
        
        Map<String, Object> ehResult = ehTestResponse.getBody();
        assertNotNull(ehResult);
        assertTrue((Boolean) ehResult.get("success"));
        assertTrue((Boolean) ehResult.get("errorGenerated"));
    }
    
    /**
     * Test circuit breaker reset functionality
     */
    @Test
    void testCircuitBreakerReset() {
        String serviceName = "ResetTestService";
        
        // Trigger circuit breaker
        for (int i = 0; i < 5; i++) {
            circuitBreaker.execute(
                serviceName,
                () -> { throw new RuntimeException("Test failure"); },
                () -> "Fallback"
            );
        }
        
        // Reset circuit breaker via endpoint
        ResponseEntity<Map> resetResponse = restTemplate.postForEntity(
            baseUrl + "/circuit-breakers/" + serviceName + "/reset", null, Map.class);
        
        assertEquals(HttpStatus.OK, resetResponse.getStatusCode());
        
        Map<String, Object> resetResult = resetResponse.getBody();
        assertNotNull(resetResult);
        assertEquals("Circuit breaker reset successfully", resetResult.get("message"));
        
        // Verify circuit breaker was reset
        CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(serviceName);
        assertEquals(CircuitBreaker.CircuitState.CLOSED, status.getState());
    }
    
    /**
     * Test async resilience operations
     */
    @Test
    void testAsyncResilienceOperations() throws Exception {
        AtomicInteger asyncCallCount = new AtomicInteger(0);
        
        // Test async retry
        CompletableFuture<String> asyncResult = retryHandler.executeWithRetryAsync(
            "AsyncTest",
            () -> {
                int count = asyncCallCount.incrementAndGet();
                if (count == 1) {
                    throw new RuntimeException("Async failure");
                }
                return "Async success";
            }
        );
        
        String result = asyncResult.get(5, TimeUnit.SECONDS);
        assertEquals("Async success", result);
        assertEquals(2, asyncCallCount.get());
    }
    
    /**
     * Test error statistics clearing
     */
    @Test
    void testErrorStatisticsClearing() {
        // Generate some errors
        errorHandlingService.handleError("TestComponent", "testOp", 
            new RuntimeException("Test"), null);
        
        // Verify errors exist
        Map<String, ErrorHandlingService.ErrorMetrics> errorsBefore = 
            errorHandlingService.getErrorStatistics();
        assertFalse(errorsBefore.isEmpty());
        
        // Clear via endpoint
        ResponseEntity<Map> clearResponse = restTemplate.postForEntity(
            baseUrl + "/errors/clear", null, Map.class);
        assertEquals(HttpStatus.OK, clearResponse.getStatusCode());
        
        // Verify errors cleared
        Map<String, ErrorHandlingService.ErrorMetrics> errorsAfter = 
            errorHandlingService.getErrorStatistics();
        assertTrue(errorsAfter.isEmpty());
    }
}