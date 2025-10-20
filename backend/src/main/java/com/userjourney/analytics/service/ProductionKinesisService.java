package com.userjourney.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.model.UserEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@Profile("production")
public class ProductionKinesisService {

    private static final Logger logger = LoggerFactory.getLogger(ProductionKinesisService.class);

    @Autowired
    private KinesisClient kinesisClient;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuditLogService auditLogService;

    @Value("${aws.kinesis.stream-name:user-events-prod}")
    private String streamName;

    @Value("${aws.kinesis.shard-count:2}")
    private int shardCount;

    private final ExecutorService executorService = Executors.newFixedThreadPool(10);
    
    @javax.annotation.PostConstruct
    public void init() {
        logger.info("🌊 ProductionKinesisService initialized");
        logger.info("🌊 Kinesis Stream Name: {}", streamName);
        logger.info("🌊 Kinesis Shard Count: {}", shardCount);
        logger.info("🌊 Checking if stream is ready...");
        boolean ready = isStreamReady();
        logger.info("🌊 Kinesis Stream Ready: {}", ready ? "✅ YES" : "❌ NO");
    }

    /**
     * Send a single event to Kinesis stream
     */
    public CompletableFuture<String> sendEvent(UserEvent event) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("🌊 KINESIS: Attempting to send event to stream: {}", streamName);
                logger.info("🌊 KINESIS: Event type: {}, User: {}", event.getEventType(), event.getUserId());
                
                String eventJson = objectMapper.writeValueAsString(event);
                
                PutRecordRequest request = PutRecordRequest.builder()
                    .streamName(streamName)
                    .partitionKey(event.getUserId())
                    .data(SdkBytes.fromUtf8String(eventJson))
                    .build();

                PutRecordResponse response = kinesisClient.putRecord(request);
                
                logger.info("✅ KINESIS: Successfully sent event to stream {}: sequenceNumber={}, shardId={}", 
                    streamName, response.sequenceNumber(), response.shardId());

                auditLogService.logDataAccess(
                    event.getUserId(),
                    "EVENT_SENT_TO_KINESIS",
                    "kinesis",
                    streamName,
                    "system"
                );

                return response.sequenceNumber();

            } catch (Exception e) {
                logger.error("Failed to send event to Kinesis stream {}: {}", streamName, e.getMessage(), e);
                
                auditLogService.logSecurityEvent(
                    event.getUserId(),
                    "EVENT_SEND_FAILED",
                    "system",
                    "Failed to send event to Kinesis: " + e.getMessage()
                );
                
                throw new RuntimeException("Failed to send event to Kinesis", e);
            }
        }, executorService);
    }

    /**
     * Send multiple events to Kinesis stream in batch
     */
    public CompletableFuture<List<String>> sendEventsBatch(List<UserEvent> events) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                List<PutRecordsRequestEntry> records = events.stream()
                    .map(event -> {
                        try {
                            String eventJson = objectMapper.writeValueAsString(event);
                            return PutRecordsRequestEntry.builder()
                                .partitionKey(event.getUserId())
                                .data(SdkBytes.fromUtf8String(eventJson))
                                .build();
                        } catch (Exception e) {
                            logger.error("Failed to serialize event for batch: {}", e.getMessage());
                            throw new RuntimeException("Failed to serialize event", e);
                        }
                    })
                    .toList();

                PutRecordsRequest request = PutRecordsRequest.builder()
                    .streamName(streamName)
                    .records(records)
                    .build();

                PutRecordsResponse response = kinesisClient.putRecords(request);

                List<String> sequenceNumbers = response.records().stream()
                    .map(PutRecordsResultEntry::sequenceNumber)
                    .toList();

                logger.info("Successfully sent {} events to Kinesis stream {}, {} failed", 
                    response.records().size() - response.failedRecordCount(),
                    streamName,
                    response.failedRecordCount());

                if (response.failedRecordCount() > 0) {
                    logger.warn("Failed to send {} out of {} events to Kinesis", 
                        response.failedRecordCount(), events.size());
                    
                    // Log failed records
                    for (int i = 0; i < response.records().size(); i++) {
                        PutRecordsResultEntry record = response.records().get(i);
                        if (record.errorCode() != null) {
                            logger.error("Failed to send event {}: {} - {}", 
                                i, record.errorCode(), record.errorMessage());
                        }
                    }
                }

                return sequenceNumbers;

            } catch (Exception e) {
                logger.error("Failed to send batch events to Kinesis stream {}: {}", streamName, e.getMessage(), e);
                throw new RuntimeException("Failed to send batch events to Kinesis", e);
            }
        }, executorService);
    }

    /**
     * Check if Kinesis stream exists and is active
     */
    public boolean isStreamReady() {
        try {
            DescribeStreamRequest request = DescribeStreamRequest.builder()
                .streamName(streamName)
                .build();

            DescribeStreamResponse response = kinesisClient.describeStream(request);
            StreamStatus status = response.streamDescription().streamStatus();

            logger.debug("Kinesis stream {} status: {}", streamName, status);
            return status == StreamStatus.ACTIVE;

        } catch (ResourceNotFoundException e) {
            logger.warn("Kinesis stream {} does not exist", streamName);
            return false;
        } catch (Exception e) {
            logger.error("Error checking Kinesis stream status: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Get stream information
     */
    public StreamDescription getStreamInfo() {
        try {
            DescribeStreamRequest request = DescribeStreamRequest.builder()
                .streamName(streamName)
                .build();

            DescribeStreamResponse response = kinesisClient.describeStream(request);
            return response.streamDescription();

        } catch (Exception e) {
            logger.error("Error getting stream info for {}: {}", streamName, e.getMessage(), e);
            throw new RuntimeException("Failed to get stream info", e);
        }
    }

    /**
     * Create Kinesis stream if it doesn't exist (for development/testing)
     */
    public void createStreamIfNotExists() {
        try {
            if (!isStreamReady()) {
                logger.info("Creating Kinesis stream: {}", streamName);

                CreateStreamRequest request = CreateStreamRequest.builder()
                    .streamName(streamName)
                    .shardCount(shardCount)
                    .build();

                kinesisClient.createStream(request);

                // Wait for stream to become active
                waitForStreamToBeActive();
                
                logger.info("Successfully created Kinesis stream: {}", streamName);
            }
        } catch (Exception e) {
            logger.error("Failed to create Kinesis stream {}: {}", streamName, e.getMessage(), e);
            throw new RuntimeException("Failed to create Kinesis stream", e);
        }
    }

    /**
     * Wait for stream to become active
     */
    private void waitForStreamToBeActive() {
        int maxAttempts = 30; // 5 minutes max wait time
        int attempt = 0;

        while (attempt < maxAttempts) {
            try {
                if (isStreamReady()) {
                    return;
                }
                
                Thread.sleep(10000); // Wait 10 seconds
                attempt++;
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Interrupted while waiting for stream to be active", e);
            }
        }

        throw new RuntimeException("Stream did not become active within timeout period");
    }

    /**
     * Get stream metrics
     */
    public Map<String, Object> getStreamMetrics() {
        try {
            StreamDescription streamDesc = getStreamInfo();
            
            return Map.of(
                "streamName", streamName,
                "status", streamDesc.streamStatus().toString(),
                "shardCount", streamDesc.shards().size(),
                "retentionPeriod", streamDesc.retentionPeriodHours(),
                "streamCreationTimestamp", streamDesc.streamCreationTimestamp().toString()
            );

        } catch (Exception e) {
            logger.error("Error getting stream metrics: {}", e.getMessage(), e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Shutdown the executor service
     */
    public void shutdown() {
        executorService.shutdown();
    }
}