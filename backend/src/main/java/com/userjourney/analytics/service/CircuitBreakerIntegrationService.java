package com.userjourney.analytics.service;

import com.userjourney.analytics.resilience.CircuitBreaker;
import com.userjourney.analytics.resilience.ErrorHandlingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.function.Supplier;

/**
 * Service to integrate circuit breakers with external AWS services
 * Provides standardized circuit breaker patterns for all external service calls
 */
@Service
public class CircuitBreakerIntegrationService {

    private static final Logger logger = LoggerFactory.getLogger(CircuitBreakerIntegrationService.class);

    @Autowired
    private CircuitBreaker circuitBreaker;

    @Autowired
    private ErrorHandlingService errorHandlingService;

    @Autowired
    private MonitoringService monitoringService;

    // Circuit breaker configuration from application properties
    @Value("${resilience.circuit-breaker.failure-threshold:5}")
    private int failureThreshold;

    @Value("${resilience.circuit-breaker.timeout-duration:60000}")
    private long timeoutDuration;

    @Value("${resilience.circuit-breaker.success-threshold:3}")
    private int successThreshold;

    @Value("${resilience.circuit-breaker.call-timeout:30000}")
    private long callTimeout;

    /**
     * Execute DynamoDB operation with circuit breaker protection
     */
    public <T> T executeDynamoDBOperation(String operation, Supplier<T> dbOperation, Supplier<T> fallback) {
        return executeWithCircuitBreaker(
            "dynamodb",
            operation,
            dbOperation,
            fallback,
            "DynamoDB operation"
        );
    }

    /**
     * Execute Kinesis operation with circuit breaker protection
     */
    public <T> T executeKinesisOperation(String operation, Supplier<T> kinesisOperation, Supplier<T> fallback) {
        return executeWithCircuitBreaker(
            "kinesis",
            operation,
            kinesisOperation,
            fallback,
            "Kinesis operation"
        );
    }

    /**
     * Execute S3 operation with circuit breaker protection
     */
    public <T> T executeS3Operation(String operation, Supplier<T> s3Operation, Supplier<T> fallback) {
        return executeWithCircuitBreaker(
            "s3",
            operation,
            s3Operation,
            fallback,
            "S3 operation"
        );
    }

    /**
     * Execute SQS operation with circuit breaker protection
     */
    public <T> T executeSQSOperation(String operation, Supplier<T> sqsOperation, Supplier<T> fallback) {
        return executeWithCircuitBreaker(
            "sqs",
            operation,
            sqsOperation,
            fallback,
            "SQS operation"
        );
    }

    /**
     * Execute Bedrock operation with circuit breaker protection
     */
    public <T> T executeBedrockOperation(String operation, Supplier<T> bedrockOperation, Supplier<T> fallback) {
        return executeWithCircuitBreaker(
            "bedrock",
            operation,
            bedrockOperation,
            fallback,
            "Bedrock operation"
        );
    }

    /**
     * Execute SageMaker operation with circuit breaker protection
     */
    public <T> T executeSageMakerOperation(String operation, Supplier<T> sagemakerOperation, Supplier<T> fallback) {
        return executeWithCircuitBreaker(
            "sagemaker",
            operation,
            sagemakerOperation,
            fallback,
            "SageMaker operation"
        );
    }

    /**
     * Execute CloudWatch operation with circuit breaker protection
     */
    public <T> T executeCloudWatchOperation(String operation, Supplier<T> cloudwatchOperation, Supplier<T> fallback) {
        return executeWithCircuitBreaker(
            "cloudwatch",
            operation,
            cloudwatchOperation,
            fallback,
            "CloudWatch operation"
        );
    }

    /**
     * Generic circuit breaker execution with comprehensive error handling and monitoring
     */
    private <T> T executeWithCircuitBreaker(String serviceName, String operation, 
                                          Supplier<T> serviceOperation, Supplier<T> fallback,
                                          String operationDescription) {
        
        String correlationId = MDC.get("correlationId");
        String requestId = MDC.get("requestId");
        
        logger.debug("Executing {} {} with circuit breaker - correlationId: {}, requestId: {}", 
                    serviceName, operation, correlationId, requestId);

        // Start timing for monitoring
        io.micrometer.core.instrument.Timer.Sample sample = monitoringService.startDatabaseTimer();
        
        try {
            T result = circuitBreaker.execute(
                serviceName,
                () -> {
                    try {
                        logger.debug("Executing {} operation: {} - correlationId: {}", 
                                   serviceName, operation, correlationId);
                        
                        T operationResult = serviceOperation.get();
                        
                        logger.debug("Successfully completed {} operation: {} - correlationId: {}", 
                                   serviceName, operation, correlationId);
                        
                        // Record success metrics
                        monitoringService.recordPerformanceMetric(
                            serviceName + "." + operation, 
                            java.time.Duration.ofMillis(System.currentTimeMillis()), 
                            true
                        );
                        
                        return operationResult;
                        
                    } catch (Exception e) {
                        logger.error("Failed to execute {} operation: {} - correlationId: {}, error: {}", 
                                   serviceName, operation, correlationId, e.getMessage(), e);
                        
                        // Handle error through error handling service
                        errorHandlingService.handleError(serviceName, operation, e, 
                            Map.of(
                                "correlationId", correlationId != null ? correlationId : "unknown",
                                "requestId", requestId != null ? requestId : "unknown",
                                "operation", operation
                            )
                        );
                        
                        // Record failure metrics
                        monitoringService.recordPerformanceMetric(
                            serviceName + "." + operation, 
                            java.time.Duration.ofMillis(System.currentTimeMillis()), 
                            false
                        );
                        
                        throw e;
                    }
                },
                () -> {
                    logger.warn("Circuit breaker is open for {} - using fallback for operation: {} - correlationId: {}", 
                              serviceName, operation, correlationId);
                    
                    // Handle graceful degradation
                    T fallbackResult = errorHandlingService.handleGracefulDegradation(
                        serviceName + "." + operation,
                        new RuntimeException("Circuit breaker is open"),
                        fallback.get(),
                        "Circuit breaker protection"
                    );
                    
                    // Record degradation metrics
                    monitoringService.recordPerformanceMetric(
                        serviceName + "." + operation + ".fallback", 
                        java.time.Duration.ofMillis(System.currentTimeMillis()), 
                        true
                    );
                    
                    return fallbackResult;
                },
                failureThreshold,
                timeoutDuration,
                successThreshold,
                callTimeout
            );
            
            return result;
            
        } catch (Exception e) {
            logger.error("Circuit breaker execution failed for {} operation: {} - correlationId: {}", 
                       serviceName, operation, correlationId, e);
            
            // Final fallback if circuit breaker itself fails
            return errorHandlingService.handleGracefulDegradation(
                serviceName + "." + operation,
                e,
                fallback.get(),
                "Circuit breaker execution failure"
            );
            
        } finally {
            // Record timing metrics
            monitoringService.recordDatabaseTime(sample, serviceName + "." + operation);
        }
    }

    /**
     * Execute operation with timeout handling
     */
    public <T> T executeWithTimeout(String serviceName, String operation, 
                                  Supplier<T> serviceOperation, long timeoutMs) {
        
        String correlationId = MDC.get("correlationId");
        
        try {
            // This is a simplified timeout implementation
            // In production, you might want to use CompletableFuture with timeout
            long startTime = System.currentTimeMillis();
            T result = serviceOperation.get();
            long duration = System.currentTimeMillis() - startTime;
            
            if (duration > timeoutMs) {
                errorHandlingService.handleServiceTimeout(serviceName, timeoutMs, operation);
                throw new RuntimeException("Operation timed out after " + duration + "ms");
            }
            
            return result;
            
        } catch (Exception e) {
            logger.error("Timeout execution failed for {} operation: {} - correlationId: {}", 
                       serviceName, operation, correlationId, e);
            throw e;
        }
    }

    /**
     * Get circuit breaker status for monitoring
     */
    public Map<String, CircuitBreaker.CircuitBreakerStatus> getCircuitBreakerStatuses() {
        return circuitBreaker.getAllStatuses();
    }

    /**
     * Reset circuit breaker for a specific service
     */
    public void resetCircuitBreaker(String serviceName) {
        logger.info("Manually resetting circuit breaker for service: {} - correlationId: {}", 
                   serviceName, MDC.get("correlationId"));
        circuitBreaker.reset(serviceName);
    }

    /**
     * Check if circuit breaker is open for a service
     */
    public boolean isCircuitBreakerOpen(String serviceName) {
        CircuitBreaker.CircuitBreakerStatus status = circuitBreaker.getStatus(serviceName);
        return status.getState() == CircuitBreaker.CircuitState.OPEN;
    }

    /**
     * Execute operation with retry logic (for non-circuit breaker scenarios)
     */
    public <T> T executeWithRetry(String serviceName, String operation, 
                                Supplier<T> serviceOperation, int maxRetries) {
        
        String correlationId = MDC.get("correlationId");
        Exception lastException = null;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.debug("Attempting {} operation: {} (attempt {}/{}) - correlationId: {}", 
                           serviceName, operation, attempt, maxRetries, correlationId);
                
                return serviceOperation.get();
                
            } catch (Exception e) {
                lastException = e;
                logger.warn("Attempt {}/{} failed for {} operation: {} - correlationId: {}, error: {}", 
                          attempt, maxRetries, serviceName, operation, correlationId, e.getMessage());
                
                if (attempt < maxRetries) {
                    try {
                        // Exponential backoff
                        long delay = (long) Math.pow(2, attempt - 1) * 1000;
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Retry interrupted", ie);
                    }
                }
            }
        }
        
        // All retries failed
        logger.error("All {} retry attempts failed for {} operation: {} - correlationId: {}", 
                   maxRetries, serviceName, operation, correlationId);
        
        errorHandlingService.handleError(serviceName, operation, lastException, 
            Map.of(
                "correlationId", correlationId != null ? correlationId : "unknown",
                "maxRetries", maxRetries,
                "operation", operation
            )
        );
        
        throw new RuntimeException("Operation failed after " + maxRetries + " retries", lastException);
    }
}