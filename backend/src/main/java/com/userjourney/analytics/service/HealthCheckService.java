package com.userjourney.analytics.service;

import com.userjourney.analytics.resilience.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.sqs.SqsClient;

import java.time.Instant;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Comprehensive health check service for container orchestration and monitoring
 */
@Service
public class HealthCheckService {

    private static final Logger logger = LoggerFactory.getLogger(HealthCheckService.class);

    @Autowired(required = false)
    private DynamoDbClient dynamoDbClient;

    @Autowired(required = false)
    private KinesisClient kinesisClient;

    @Autowired(required = false)
    private S3Client s3Client;

    @Autowired(required = false)
    private SqsClient sqsClient;

    @Autowired(required = false)
    private CircuitBreaker circuitBreaker;

    @Autowired
    private MonitoringService monitoringService;

    @Value("${aws.dynamodb.table-prefix:prod-}")
    private String tablePrefix;

    @Value("${aws.kinesis.stream-name:user-events-prod}")
    private String kinesisStreamName;

    @Value("${aws.s3.bucket-name:}")
    private String s3BucketName;

    @Value("${aws.sqs.dlq.url:}")
    private String dlqUrl;

    private final Instant startTime = Instant.now();

    /**
     * Perform basic health check - fast response for load balancers
     */
    public HealthStatus getBasicHealth() {
        try {
            // Basic application health
            boolean isHealthy = monitoringService.isHealthy();
            
            return new HealthStatus(
                isHealthy ? HealthStatus.Status.UP : HealthStatus.Status.DOWN,
                "Basic health check",
                Map.of(
                    "status", isHealthy ? "UP" : "DOWN",
                    "timestamp", Instant.now().toString(),
                    "uptime", Duration.between(startTime, Instant.now()).toString()
                )
            );
        } catch (Exception e) {
            logger.error("Basic health check failed", e);
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "Health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    /**
     * Perform detailed health check - comprehensive status for monitoring
     */
    public DetailedHealthStatus getDetailedHealth() {
        Map<String, HealthStatus> components = new HashMap<>();
        boolean overallHealthy = true;

        // Check application components
        components.put("application", checkApplicationHealth());
        components.put("monitoring", checkMonitoringHealth());

        // Check AWS services
        components.put("dynamodb", checkDynamoDBHealth());
        components.put("kinesis", checkKinesisHealth());
        components.put("s3", checkS3Health());
        components.put("sqs", checkSQSHealth());

        // Check circuit breakers
        components.put("circuitBreakers", checkCircuitBreakersHealth());

        // Determine overall health
        for (HealthStatus status : components.values()) {
            if (status.getStatus() != HealthStatus.Status.UP) {
                overallHealthy = false;
                break;
            }
        }

        return new DetailedHealthStatus(
            overallHealthy ? HealthStatus.Status.UP : HealthStatus.Status.DOWN,
            "Detailed health check completed",
            components,
            getSystemInfo()
        );
    }

    /**
     * Perform readiness check - for Kubernetes readiness probe
     */
    public HealthStatus getReadinessCheck() {
        try {
            // Check if application is ready to serve traffic
            boolean ready = true;
            Map<String, Object> details = new HashMap<>();

            // Check critical dependencies
            HealthStatus dynamoHealth = checkDynamoDBHealth();
            if (dynamoHealth.getStatus() != HealthStatus.Status.UP) {
                ready = false;
                details.put("dynamodb", "NOT_READY");
            }

            HealthStatus kinesisHealth = checkKinesisHealth();
            if (kinesisHealth.getStatus() != HealthStatus.Status.UP) {
                ready = false;
                details.put("kinesis", "NOT_READY");
            }

            details.put("ready", ready);
            details.put("timestamp", Instant.now().toString());

            return new HealthStatus(
                ready ? HealthStatus.Status.UP : HealthStatus.Status.DOWN,
                ready ? "Application is ready" : "Application is not ready",
                details
            );
        } catch (Exception e) {
            logger.error("Readiness check failed", e);
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "Readiness check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    /**
     * Perform liveness check - for Kubernetes liveness probe
     */
    public HealthStatus getLivenessCheck() {
        try {
            // Check if application is alive and not deadlocked
            boolean alive = true;
            Map<String, Object> details = new HashMap<>();

            // Check if monitoring service is responsive
            boolean monitoringResponsive = monitoringService.isHealthy();
            if (!monitoringResponsive) {
                alive = false;
                details.put("monitoring", "UNRESPONSIVE");
            }

            // Check memory usage
            Runtime runtime = Runtime.getRuntime();
            long maxMemory = runtime.maxMemory();
            long totalMemory = runtime.totalMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            double memoryUsagePercent = (double) usedMemory / maxMemory * 100;

            if (memoryUsagePercent > 90) {
                alive = false;
                details.put("memory", "HIGH_USAGE");
            }

            details.put("alive", alive);
            details.put("memoryUsagePercent", memoryUsagePercent);
            details.put("timestamp", Instant.now().toString());

            return new HealthStatus(
                alive ? HealthStatus.Status.UP : HealthStatus.Status.DOWN,
                alive ? "Application is alive" : "Application may be unhealthy",
                details
            );
        } catch (Exception e) {
            logger.error("Liveness check failed", e);
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "Liveness check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private HealthStatus checkApplicationHealth() {
        try {
            Map<String, Object> details = new HashMap<>();
            details.put("uptime", Duration.between(startTime, Instant.now()).toString());
            details.put("startTime", startTime.toString());
            
            return new HealthStatus(
                HealthStatus.Status.UP,
                "Application is running",
                details
            );
        } catch (Exception e) {
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "Application health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private HealthStatus checkMonitoringHealth() {
        try {
            boolean healthy = monitoringService.isHealthy();
            return new HealthStatus(
                healthy ? HealthStatus.Status.UP : HealthStatus.Status.DOWN,
                healthy ? "Monitoring is healthy" : "Monitoring is unhealthy",
                Map.of("healthy", healthy)
            );
        } catch (Exception e) {
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "Monitoring health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private HealthStatus checkDynamoDBHealth() {
        if (dynamoDbClient == null) {
            return new HealthStatus(
                HealthStatus.Status.UNKNOWN,
                "DynamoDB client not configured",
                Map.of("configured", false)
            );
        }

        try {
            // Use circuit breaker if available
            if (circuitBreaker != null) {
                return circuitBreaker.execute(
                    "dynamodb",
                    () -> performDynamoDBCheck(),
                    () -> new HealthStatus(
                        HealthStatus.Status.DOWN,
                        "DynamoDB circuit breaker is open",
                        Map.of("circuitBreakerOpen", true)
                    )
                );
            } else {
                return performDynamoDBCheck();
            }
        } catch (Exception e) {
            logger.warn("DynamoDB health check failed", e);
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "DynamoDB health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private HealthStatus performDynamoDBCheck() {
        try {
            // Simple operation to check DynamoDB connectivity
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                dynamoDbClient.listTables();
            });
            
            future.get(5, TimeUnit.SECONDS); // 5 second timeout
            
            return new HealthStatus(
                HealthStatus.Status.UP,
                "DynamoDB is accessible",
                Map.of("accessible", true)
            );
        } catch (Exception e) {
            throw new RuntimeException("DynamoDB check failed", e);
        }
    }

    private HealthStatus checkKinesisHealth() {
        if (kinesisClient == null) {
            return new HealthStatus(
                HealthStatus.Status.UNKNOWN,
                "Kinesis client not configured",
                Map.of("configured", false)
            );
        }

        try {
            if (circuitBreaker != null) {
                return circuitBreaker.execute(
                    "kinesis",
                    () -> performKinesisCheck(),
                    () -> new HealthStatus(
                        HealthStatus.Status.DOWN,
                        "Kinesis circuit breaker is open",
                        Map.of("circuitBreakerOpen", true)
                    )
                );
            } else {
                return performKinesisCheck();
            }
        } catch (Exception e) {
            logger.warn("Kinesis health check failed", e);
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "Kinesis health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private HealthStatus performKinesisCheck() {
        try {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                kinesisClient.listStreams();
            });
            
            future.get(5, TimeUnit.SECONDS);
            
            return new HealthStatus(
                HealthStatus.Status.UP,
                "Kinesis is accessible",
                Map.of("accessible", true)
            );
        } catch (Exception e) {
            throw new RuntimeException("Kinesis check failed", e);
        }
    }

    private HealthStatus checkS3Health() {
        if (s3Client == null) {
            return new HealthStatus(
                HealthStatus.Status.UNKNOWN,
                "S3 client not configured",
                Map.of("configured", false)
            );
        }

        try {
            if (circuitBreaker != null) {
                return circuitBreaker.execute(
                    "s3",
                    () -> performS3Check(),
                    () -> new HealthStatus(
                        HealthStatus.Status.DOWN,
                        "S3 circuit breaker is open",
                        Map.of("circuitBreakerOpen", true)
                    )
                );
            } else {
                return performS3Check();
            }
        } catch (Exception e) {
            logger.warn("S3 health check failed", e);
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "S3 health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private HealthStatus performS3Check() {
        try {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                s3Client.listBuckets();
            });
            
            future.get(5, TimeUnit.SECONDS);
            
            return new HealthStatus(
                HealthStatus.Status.UP,
                "S3 is accessible",
                Map.of("accessible", true)
            );
        } catch (Exception e) {
            throw new RuntimeException("S3 check failed", e);
        }
    }

    private HealthStatus checkSQSHealth() {
        if (sqsClient == null) {
            return new HealthStatus(
                HealthStatus.Status.UNKNOWN,
                "SQS client not configured",
                Map.of("configured", false)
            );
        }

        try {
            if (circuitBreaker != null) {
                return circuitBreaker.execute(
                    "sqs",
                    () -> performSQSCheck(),
                    () -> new HealthStatus(
                        HealthStatus.Status.DOWN,
                        "SQS circuit breaker is open",
                        Map.of("circuitBreakerOpen", true)
                    )
                );
            } else {
                return performSQSCheck();
            }
        } catch (Exception e) {
            logger.warn("SQS health check failed", e);
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "SQS health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private HealthStatus performSQSCheck() {
        try {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                sqsClient.listQueues();
            });
            
            future.get(5, TimeUnit.SECONDS);
            
            return new HealthStatus(
                HealthStatus.Status.UP,
                "SQS is accessible",
                Map.of("accessible", true)
            );
        } catch (Exception e) {
            throw new RuntimeException("SQS check failed", e);
        }
    }

    private HealthStatus checkCircuitBreakersHealth() {
        if (circuitBreaker == null) {
            return new HealthStatus(
                HealthStatus.Status.UNKNOWN,
                "Circuit breaker not configured",
                Map.of("configured", false)
            );
        }

        try {
            Map<String, CircuitBreaker.CircuitBreakerStatus> statuses = circuitBreaker.getAllStatuses();
            Map<String, Object> details = new HashMap<>();
            boolean allHealthy = true;

            for (Map.Entry<String, CircuitBreaker.CircuitBreakerStatus> entry : statuses.entrySet()) {
                CircuitBreaker.CircuitBreakerStatus status = entry.getValue();
                details.put(entry.getKey(), Map.of(
                    "state", status.getState().toString(),
                    "failureCount", status.getFailureCount(),
                    "successCount", status.getSuccessCount()
                ));

                if (status.getState() == CircuitBreaker.CircuitState.OPEN) {
                    allHealthy = false;
                }
            }

            return new HealthStatus(
                allHealthy ? HealthStatus.Status.UP : HealthStatus.Status.DEGRADED,
                allHealthy ? "All circuit breakers healthy" : "Some circuit breakers are open",
                details
            );
        } catch (Exception e) {
            return new HealthStatus(
                HealthStatus.Status.DOWN,
                "Circuit breaker health check failed: " + e.getMessage(),
                Map.of("error", e.getMessage())
            );
        }
    }

    private Map<String, Object> getSystemInfo() {
        Runtime runtime = Runtime.getRuntime();
        Map<String, Object> systemInfo = new HashMap<>();
        
        systemInfo.put("javaVersion", System.getProperty("java.version"));
        systemInfo.put("javaVendor", System.getProperty("java.vendor"));
        systemInfo.put("osName", System.getProperty("os.name"));
        systemInfo.put("osVersion", System.getProperty("os.version"));
        systemInfo.put("maxMemory", runtime.maxMemory());
        systemInfo.put("totalMemory", runtime.totalMemory());
        systemInfo.put("freeMemory", runtime.freeMemory());
        systemInfo.put("availableProcessors", runtime.availableProcessors());
        systemInfo.put("uptime", Duration.between(startTime, Instant.now()).toString());
        
        return systemInfo;
    }

    // Health status classes
    public static class HealthStatus {
        public enum Status {
            UP, DOWN, DEGRADED, UNKNOWN
        }

        private final Status status;
        private final String message;
        private final Map<String, Object> details;

        public HealthStatus(Status status, String message, Map<String, Object> details) {
            this.status = status;
            this.message = message;
            this.details = details != null ? details : new HashMap<>();
        }

        // Getters
        public Status getStatus() { return status; }
        public String getMessage() { return message; }
        public Map<String, Object> getDetails() { return details; }
    }

    public static class DetailedHealthStatus extends HealthStatus {
        private final Map<String, HealthStatus> components;
        private final Map<String, Object> systemInfo;

        public DetailedHealthStatus(Status status, String message, 
                                  Map<String, HealthStatus> components,
                                  Map<String, Object> systemInfo) {
            super(status, message, new HashMap<>());
            this.components = components;
            this.systemInfo = systemInfo;
        }

        public Map<String, HealthStatus> getComponents() { return components; }
        public Map<String, Object> getSystemInfo() { return systemInfo; }
    }
}