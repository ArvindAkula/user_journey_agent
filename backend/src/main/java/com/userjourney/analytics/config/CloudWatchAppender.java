package com.userjourney.analytics.config;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import ch.qos.logback.core.encoder.Encoder;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cloudwatchlogs.CloudWatchLogsClient;
import software.amazon.awssdk.services.cloudwatchlogs.model.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Custom Logback appender for sending logs to AWS CloudWatch
 */
public class CloudWatchAppender extends AppenderBase<ILoggingEvent> {

    private CloudWatchLogsClient cloudWatchLogsClient;
    private Encoder<ILoggingEvent> encoder;
    private String logGroup;
    private String logStream;
    private String region;
    private int batchSize = 100;
    private int batchTimeout = 5000; // milliseconds
    
    private final List<InputLogEvent> logEventBuffer = new ArrayList<>();
    private final AtomicLong sequenceToken = new AtomicLong(0);
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private ScheduledFuture<?> flushTask;
    
    @Override
    public void start() {
        if (this.encoder == null) {
            addError("No encoder set for the appender named [" + name + "].");
            return;
        }
        
        try {
            // Initialize CloudWatch client
            if (cloudWatchLogsClient == null) {
                cloudWatchLogsClient = CloudWatchLogsClient.builder()
                        .region(Region.of(region))
                        .build();
            }
            
            // Create log group and stream if they don't exist
            createLogGroupAndStream();
            
            // Start periodic flush task
            flushTask = scheduler.scheduleAtFixedRate(this::flushLogs, 
                    batchTimeout, batchTimeout, TimeUnit.MILLISECONDS);
            
            super.start();
        } catch (Exception e) {
            addError("Failed to start CloudWatch appender", e);
        }
    }

    @Override
    public void stop() {
        if (flushTask != null) {
            flushTask.cancel(false);
        }
        
        // Flush remaining logs
        flushLogs();
        
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        if (cloudWatchLogsClient != null) {
            cloudWatchLogsClient.close();
        }
        
        super.stop();
    }

    @Override
    protected void append(ILoggingEvent event) {
        if (!isStarted()) {
            return;
        }
        
        try {
            String formattedMessage = new String(encoder.encode(event), StandardCharsets.UTF_8);
            
            InputLogEvent logEvent = InputLogEvent.builder()
                    .timestamp(event.getTimeStamp())
                    .message(formattedMessage.trim())
                    .build();
            
            synchronized (logEventBuffer) {
                logEventBuffer.add(logEvent);
                
                // Flush if buffer is full
                if (logEventBuffer.size() >= batchSize) {
                    flushLogs();
                }
            }
        } catch (Exception e) {
            addError("Failed to append log event to CloudWatch", e);
        }
    }

    /**
     * Flush accumulated log events to CloudWatch
     */
    private void flushLogs() {
        List<InputLogEvent> eventsToSend;
        
        synchronized (logEventBuffer) {
            if (logEventBuffer.isEmpty()) {
                return;
            }
            
            eventsToSend = new ArrayList<>(logEventBuffer);
            logEventBuffer.clear();
        }
        
        try {
            // Sort events by timestamp (required by CloudWatch)
            eventsToSend.sort((e1, e2) -> Long.compare(e1.timestamp(), e2.timestamp()));
            
            PutLogEventsRequest.Builder requestBuilder = PutLogEventsRequest.builder()
                    .logGroupName(logGroup)
                    .logStreamName(logStream)
                    .logEvents(eventsToSend);
            
            // Add sequence token if we have one
            long currentToken = sequenceToken.get();
            if (currentToken > 0) {
                requestBuilder.sequenceToken(String.valueOf(currentToken));
            }
            
            PutLogEventsResponse response = cloudWatchLogsClient.putLogEvents(requestBuilder.build());
            
            // Update sequence token for next batch
            if (response.nextSequenceToken() != null) {
                try {
                    sequenceToken.set(Long.parseLong(response.nextSequenceToken()));
                } catch (NumberFormatException e) {
                    // Handle non-numeric sequence tokens
                    sequenceToken.set(System.currentTimeMillis());
                }
            }
            
        } catch (Exception e) {
            addError("Failed to send log events to CloudWatch", e);
            
            // Re-add events to buffer for retry (with limit to prevent memory issues)
            synchronized (logEventBuffer) {
                if (logEventBuffer.size() < batchSize * 2) {
                    logEventBuffer.addAll(0, eventsToSend);
                }
            }
        }
    }

    /**
     * Create CloudWatch log group and stream if they don't exist
     */
    private void createLogGroupAndStream() {
        try {
            // Create log group
            try {
                cloudWatchLogsClient.createLogGroup(CreateLogGroupRequest.builder()
                        .logGroupName(logGroup)
                        .build());
            } catch (ResourceAlreadyExistsException e) {
                // Log group already exists, which is fine
            }
            
            // Set retention policy
            try {
                cloudWatchLogsClient.putRetentionPolicy(PutRetentionPolicyRequest.builder()
                        .logGroupName(logGroup)
                        .retentionInDays(30) // Default 30 days retention
                        .build());
            } catch (Exception e) {
                addWarn("Failed to set retention policy for log group: " + logGroup, e);
            }
            
            // Create log stream
            try {
                cloudWatchLogsClient.createLogStream(CreateLogStreamRequest.builder()
                        .logGroupName(logGroup)
                        .logStreamName(logStream)
                        .build());
            } catch (ResourceAlreadyExistsException e) {
                // Log stream already exists, get the sequence token
                try {
                    DescribeLogStreamsResponse response = cloudWatchLogsClient.describeLogStreams(
                            DescribeLogStreamsRequest.builder()
                                    .logGroupName(logGroup)
                                    .logStreamNamePrefix(logStream)
                                    .build());
                    
                    response.logStreams().stream()
                            .filter(stream -> stream.logStreamName().equals(logStream))
                            .findFirst()
                            .ifPresent(stream -> {
                                if (stream.uploadSequenceToken() != null) {
                                    try {
                                        sequenceToken.set(Long.parseLong(stream.uploadSequenceToken()));
                                    } catch (NumberFormatException ex) {
                                        sequenceToken.set(System.currentTimeMillis());
                                    }
                                }
                            });
                } catch (Exception ex) {
                    addWarn("Failed to get sequence token for existing log stream", ex);
                }
            }
            
        } catch (Exception e) {
            addError("Failed to create CloudWatch log group/stream", e);
        }
    }

    // Getters and setters
    public Encoder<ILoggingEvent> getEncoder() {
        return encoder;
    }

    public void setEncoder(Encoder<ILoggingEvent> encoder) {
        this.encoder = encoder;
    }

    public String getLogGroup() {
        return logGroup;
    }

    public void setLogGroup(String logGroup) {
        this.logGroup = logGroup;
    }

    public String getLogStream() {
        return logStream;
    }

    public void setLogStream(String logStream) {
        this.logStream = logStream;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public int getBatchSize() {
        return batchSize;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

    public int getBatchTimeout() {
        return batchTimeout;
    }

    public void setBatchTimeout(int batchTimeout) {
        this.batchTimeout = batchTimeout;
    }
}