package com.userjourney.analytics.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class MonitoringService {

    private static final Logger logger = LoggerFactory.getLogger(MonitoringService.class);

    private final MeterRegistry meterRegistry;
    private final ConcurrentHashMap<String, AtomicLong> gaugeValues = new ConcurrentHashMap<>();

    // Counters
    private final Counter userEventsProcessed;
    private final Counter struggleSignalsDetected;
    private final Counter interventionsExecuted;
    private final Counter aiServiceErrors;
    private final Counter bedrockInvocations;
    private final Counter novaAnalysisRequests;
    private final Counter sagemakerPredictions;
    private final Counter highVideoEngagement;

    // Timers
    private final Timer dataProcessingTimer;
    private final Timer aiServiceResponseTimer;
    private final Timer databaseOperationTimer;

    @Autowired
    public MonitoringService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;

        // Initialize counters
        this.userEventsProcessed = Counter.builder("user.events.processed")
                .description("Total number of user events processed")
                .register(meterRegistry);

        this.struggleSignalsDetected = Counter.builder("struggle.signals.detected")
                .description("Total number of struggle signals detected")
                .register(meterRegistry);

        this.interventionsExecuted = Counter.builder("interventions.executed")
                .description("Total number of interventions executed")
                .register(meterRegistry);

        this.aiServiceErrors = Counter.builder("ai.service.errors")
                .description("Total number of AI service errors")
                .register(meterRegistry);

        this.bedrockInvocations = Counter.builder("bedrock.invocations")
                .description("Total number of Bedrock invocations")
                .register(meterRegistry);

        this.novaAnalysisRequests = Counter.builder("nova.analysis.requests")
                .description("Total number of Nova analysis requests")
                .register(meterRegistry);

        this.sagemakerPredictions = Counter.builder("sagemaker.predictions")
                .description("Total number of SageMaker predictions")
                .register(meterRegistry);

        this.highVideoEngagement = Counter.builder("video.engagement.high")
                .description("Total number of high video engagement events")
                .register(meterRegistry);

        // Initialize timers
        this.dataProcessingTimer = Timer.builder("data.processing.duration")
                .description("Time taken to process data")
                .register(meterRegistry);

        this.aiServiceResponseTimer = Timer.builder("ai.service.response.duration")
                .description("Time taken for AI service responses")
                .register(meterRegistry);

        this.databaseOperationTimer = Timer.builder("database.operation.duration")
                .description("Time taken for database operations")
                .register(meterRegistry);

        // Initialize gauges
        initializeGauges();
    }

    private void initializeGauges() {
        // Active users gauge
        gaugeValues.put("active.users", new AtomicLong(0));
        Gauge.builder("active.users", this, MonitoringService::getActiveUsers)
                .description("Number of currently active users")
                .register(meterRegistry);

        // Processing queue size gauge
        gaugeValues.put("processing.queue.size", new AtomicLong(0));
        Gauge.builder("processing.queue.size", this, MonitoringService::getProcessingQueueSize)
                .description("Current processing queue size")
                .register(meterRegistry);

        // AI service health gauge
        gaugeValues.put("ai.service.health", new AtomicLong(1));
        Gauge.builder("ai.service.health", this, MonitoringService::getAiServiceHealth)
                .description("AI service health status (1=healthy, 0=unhealthy)")
                .register(meterRegistry);
    }

    // Counter methods
    public void incrementUserEventsProcessed() {
        userEventsProcessed.increment();
        logger.info("EVENT_PROCESSED: User event processed successfully");
    }

    public void incrementUserEventsProcessed(String eventType) {
        Counter.builder("user.events.processed")
                .tag("event.type", eventType)
                .register(meterRegistry)
                .increment();
        logger.info("EVENT_PROCESSED: User event processed successfully, type: {}", eventType);
    }

    public void incrementStruggleSignalsDetected() {
        struggleSignalsDetected.increment();
        logger.info("STRUGGLE_SIGNAL_DETECTED: Struggle signal detected and logged");
    }

    public void incrementStruggleSignalsDetected(String feature, int severity) {
        Counter.builder("struggle.signals.detected")
                .tag("feature", feature)
                .tag("severity", String.valueOf(severity))
                .register(meterRegistry)
                .increment();
        logger.info("STRUGGLE_SIGNAL_DETECTED: Struggle signal detected for feature: {}, severity: {}", feature, severity);
    }

    public void incrementInterventionsExecuted() {
        interventionsExecuted.increment();
        logger.info("INTERVENTION_EXECUTED: Intervention executed successfully");
    }

    public void incrementInterventionsExecuted(String interventionType) {
        Counter.builder("interventions.executed")
                .tag("intervention.type", interventionType)
                .register(meterRegistry)
                .increment();
        logger.info("INTERVENTION_EXECUTED: Intervention executed successfully, type: {}", interventionType);
    }

    public void incrementAiServiceErrors() {
        aiServiceErrors.increment();
        logger.error("AI_SERVICE_ERROR: AI service error occurred");
    }

    public void incrementAiServiceErrors(String service, String errorType) {
        Counter.builder("ai.service.errors")
                .tag("service", service)
                .tag("error.type", errorType)
                .register(meterRegistry)
                .increment();
        logger.error("AI_SERVICE_ERROR: AI service error occurred, service: {}, error: {}", service, errorType);
    }

    public void incrementBedrockInvocations() {
        bedrockInvocations.increment();
        logger.info("BEDROCK_INVOCATION: Bedrock service invoked");
    }

    public void incrementBedrockInvocations(String model) {
        Counter.builder("bedrock.invocations")
                .tag("model", model)
                .register(meterRegistry)
                .increment();
        logger.info("BEDROCK_INVOCATION: Bedrock service invoked, model: {}", model);
    }

    public void incrementNovaAnalysisRequests() {
        novaAnalysisRequests.increment();
        logger.info("NOVA_ANALYSIS_REQUEST: Nova analysis requested");
    }

    public void incrementSagemakerPredictions() {
        sagemakerPredictions.increment();
        logger.info("SAGEMAKER_PREDICTION: SageMaker prediction requested");
    }

    public void incrementHighVideoEngagement() {
        highVideoEngagement.increment();
        logger.info("HIGH_ENGAGEMENT_DETECTED: High video engagement detected");
    }

    public void incrementHighVideoEngagement(String videoId, double engagementScore) {
        Counter.builder("video.engagement.high")
                .tag("video.id", videoId)
                .register(meterRegistry)
                .increment();
        logger.info("HIGH_ENGAGEMENT_DETECTED: High video engagement detected for video: {}, score: {}", videoId, engagementScore);
    }

    // Timer methods
    public Timer.Sample startDataProcessingTimer() {
        return Timer.start(meterRegistry);
    }

    public void recordDataProcessingTime(Timer.Sample sample) {
        sample.stop(dataProcessingTimer);
    }

    public void recordDataProcessingTime(Duration duration) {
        dataProcessingTimer.record(duration);
        logger.info("PROCESSING_LATENCY: Data processing completed, latency_ms: {}", duration.toMillis());
    }

    public Timer.Sample startAiServiceTimer() {
        return Timer.start(meterRegistry);
    }

    public void recordAiServiceTime(Timer.Sample sample, String service) {
        sample.stop(Timer.builder("ai.service.response.duration")
                .tag("service", service)
                .register(meterRegistry));
    }

    public void recordAiServiceTime(java.time.Duration duration, String service) {
        aiServiceResponseTimer.record(duration);
        logger.info("AI_SERVICE_LATENCY: AI service {} completed, latency_ms: {}", service, duration.toMillis());
    }

    public Timer.Sample startDatabaseTimer() {
        return Timer.start(meterRegistry);
    }

    public void recordDatabaseTime(Timer.Sample sample, String operation) {
        sample.stop(Timer.builder("database.operation.duration")
                .tag("operation", operation)
                .register(meterRegistry));
    }

    public void recordDatabaseTime(java.time.Duration duration, String operation) {
        databaseOperationTimer.record(duration);
        logger.info("DATABASE_LATENCY: Database operation {} completed, latency_ms: {}", operation, duration.toMillis());
    }

    // Gauge methods
    public void setActiveUsers(long count) {
        gaugeValues.get("active.users").set(count);
    }

    public void setProcessingQueueSize(long size) {
        gaugeValues.get("processing.queue.size").set(size);
    }

    public void setAiServiceHealth(boolean healthy) {
        gaugeValues.get("ai.service.health").set(healthy ? 1 : 0);
    }

    // Gauge value getters (used by Micrometer)
    public double getActiveUsers() {
        return gaugeValues.get("active.users").get();
    }

    public double getProcessingQueueSize() {
        return gaugeValues.get("processing.queue.size").get();
    }

    public double getAiServiceHealth() {
        return gaugeValues.get("ai.service.health").get();
    }

    // Business metrics methods
    public void recordUserJourneyMetric(String metricName, double value, String... tags) {
        meterRegistry.gauge("user.journey." + metricName, 
            io.micrometer.core.instrument.Tags.of(tags), value);
    }

    public void recordPerformanceMetric(String operation, Duration duration, boolean success) {
        Timer.builder("operation.performance")
                .tag("operation", operation)
                .tag("success", String.valueOf(success))
                .register(meterRegistry)
                .record(duration);
    }

    // Health check method
    public boolean isHealthy() {
        try {
            // Perform basic health checks
            boolean aiServiceHealthy = gaugeValues.get("ai.service.health").get() == 1;
            boolean queueSizeReasonable = gaugeValues.get("processing.queue.size").get() < 1000;
            
            return aiServiceHealthy && queueSizeReasonable;
        } catch (Exception e) {
            logger.error("Health check failed", e);
            return false;
        }
    }

    // Utility methods for complex metrics
    public void recordUserEngagementPattern(String userId, String pattern, double score) {
        meterRegistry.counter("user.engagement.pattern", 
                "user.id", userId, "pattern", pattern)
                .increment();
        
        meterRegistry.gauge("user.engagement.score", 
                io.micrometer.core.instrument.Tags.of("user.id", userId), score);
    }

    public void recordInterventionEffectiveness(String interventionType, boolean successful) {
        meterRegistry.counter("intervention.effectiveness",
                "type", interventionType, "successful", String.valueOf(successful))
                .increment();
    }

    public void recordCostMetric(String service, double cost) {
        meterRegistry.gauge("service.cost",
                io.micrometer.core.instrument.Tags.of("service", service), cost);
    }
}