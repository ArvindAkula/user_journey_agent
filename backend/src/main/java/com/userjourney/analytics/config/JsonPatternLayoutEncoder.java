package com.userjourney.analytics.config;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.StackTraceElementProxy;
import ch.qos.logback.core.encoder.EncoderBase;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.MDC;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * JSON encoder for structured logging to CloudWatch
 */
public class JsonPatternLayoutEncoder extends EncoderBase<ILoggingEvent> {

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_INSTANT;

    @Override
    public byte[] headerBytes() {
        return null;
    }

    @Override
    public byte[] encode(ILoggingEvent event) {
        try {
            ObjectNode logEntry = objectMapper.createObjectNode();
            
            // Basic log information
            logEntry.put("timestamp", ISO_FORMATTER.format(Instant.ofEpochMilli(event.getTimeStamp())));
            logEntry.put("level", event.getLevel().toString());
            logEntry.put("logger", event.getLoggerName());
            logEntry.put("message", event.getFormattedMessage());
            logEntry.put("thread", event.getThreadName());
            
            // Application context
            logEntry.put("application", "user-journey-analytics");
            logEntry.put("environment", System.getProperty("spring.profiles.active", "unknown"));
            
            // MDC context
            Map<String, String> mdcProperties = event.getMDCPropertyMap();
            if (mdcProperties != null && !mdcProperties.isEmpty()) {
                ObjectNode mdcNode = objectMapper.createObjectNode();
                mdcProperties.forEach(mdcNode::put);
                logEntry.set("mdc", mdcNode);
                
                // Extract common fields to top level for easier querying
                if (mdcProperties.containsKey("correlationId")) {
                    logEntry.put("correlationId", mdcProperties.get("correlationId"));
                }
                if (mdcProperties.containsKey("requestId")) {
                    logEntry.put("requestId", mdcProperties.get("requestId"));
                }
                if (mdcProperties.containsKey("userId")) {
                    logEntry.put("userId", mdcProperties.get("userId"));
                }
                if (mdcProperties.containsKey("sessionId")) {
                    logEntry.put("sessionId", mdcProperties.get("sessionId"));
                }
            }
            
            // Exception information
            if (event.getThrowableProxy() != null) {
                ObjectNode exceptionNode = objectMapper.createObjectNode();
                exceptionNode.put("class", event.getThrowableProxy().getClassName());
                exceptionNode.put("message", event.getThrowableProxy().getMessage());
                
                // Add stack trace for non-production environments
                String activeProfile = System.getProperty("spring.profiles.active", "");
                if (!activeProfile.equals("production")) {
                    StringBuilder stackTrace = new StringBuilder();
                    for (StackTraceElementProxy step : event.getThrowableProxy().getStackTraceElementProxyArray()) {
                        stackTrace.append(step.toString()).append("\n");
                    }
                    exceptionNode.put("stackTrace", stackTrace.toString());
                }
                
                logEntry.set("exception", exceptionNode);
            }
            
            // Marker information (for categorizing logs)
            if (event.getMarker() != null) {
                logEntry.put("marker", event.getMarker().getName());
            }
            
            // Parse structured log messages
            parseStructuredMessage(event.getFormattedMessage(), logEntry);
            
            String jsonString = objectMapper.writeValueAsString(logEntry);
            return (jsonString + "\n").getBytes(StandardCharsets.UTF_8);
            
        } catch (Exception e) {
            // Fallback to simple format if JSON encoding fails
            String fallback = String.format("%s [%s] %s - %s%n",
                    Instant.ofEpochMilli(event.getTimeStamp()),
                    event.getLevel(),
                    event.getLoggerName(),
                    event.getFormattedMessage());
            return fallback.getBytes(StandardCharsets.UTF_8);
        }
    }

    @Override
    public byte[] footerBytes() {
        return null;
    }

    /**
     * Parse structured log messages to extract additional fields
     */
    private void parseStructuredMessage(String message, ObjectNode logEntry) {
        try {
            // Check if message contains structured data patterns
            if (message.startsWith("BUSINESS_EVENT:") || 
                message.startsWith("PERFORMANCE_METRIC:") ||
                message.startsWith("SECURITY_EVENT:") ||
                message.startsWith("ERROR:") ||
                message.startsWith("USER_JOURNEY:") ||
                message.startsWith("AI_SERVICE:") ||
                message.startsWith("CIRCUIT_BREAKER:") ||
                message.startsWith("DATA_PROCESSING:")) {
                
                // Extract log type
                String[] parts = message.split(":", 2);
                if (parts.length == 2) {
                    logEntry.put("logType", parts[0]);
                    
                    // Try to parse JSON data from the message
                    String jsonPart = parts[1].trim();
                    if (jsonPart.startsWith("{") && jsonPart.endsWith("}")) {
                        try {
                            ObjectNode structuredData = (ObjectNode) objectMapper.readTree(jsonPart);
                            logEntry.setAll(structuredData);
                        } catch (Exception e) {
                            // If JSON parsing fails, keep the original message
                            logEntry.put("structuredMessage", jsonPart);
                        }
                    } else {
                        logEntry.put("structuredMessage", jsonPart);
                    }
                }
            }
            
            // Extract performance metrics from message patterns
            if (message.contains("completed in") && message.contains("ms")) {
                try {
                    String[] words = message.split("\\s+");
                    for (int i = 0; i < words.length - 1; i++) {
                        if (words[i].equals("in") && words[i + 1].endsWith("ms")) {
                            String durationStr = words[i + 1].replace("ms", "");
                            logEntry.put("durationMs", Long.parseLong(durationStr));
                            break;
                        }
                    }
                } catch (NumberFormatException e) {
                    // Ignore parsing errors
                }
            }
            
        } catch (Exception e) {
            // Ignore parsing errors and keep original message
        }
    }
}