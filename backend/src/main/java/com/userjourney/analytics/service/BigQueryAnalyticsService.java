package com.userjourney.analytics.service;

import com.google.cloud.bigquery.*;
import com.userjourney.analytics.config.BigQueryConfig;
import com.userjourney.analytics.dto.BigQueryEventResult;
import com.userjourney.analytics.dto.EventCountAggregation;
import com.userjourney.analytics.dto.UserJourneyAnalysis;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * BigQuery Analytics Service
 * 
 * Provides methods to query Firebase Analytics data exported to BigQuery
 * for historical analytics, user journey analysis, and event aggregations.
 * 
 * This service enables cost-effective long-term analytics storage by
 * querying BigQuery instead of DynamoDB for historical data.
 */
@Service
public class BigQueryAnalyticsService {

    private static final Logger logger = LoggerFactory.getLogger(BigQueryAnalyticsService.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final BigQuery bigQuery;
    private final BigQueryConfig config;

    @Autowired
    public BigQueryAnalyticsService(BigQuery bigQuery, BigQueryConfig config) {
        this.bigQuery = bigQuery;
        this.config = config;
    }

    /**
     * Check if BigQuery is available and configured
     */
    public boolean isAvailable() {
        return bigQuery != null && config.isBigQueryEnabled();
    }

    /**
     * Get historical events for a specific user
     */
    public List<BigQueryEventResult> getHistoricalEvents(String userId, LocalDate startDate, LocalDate endDate) {
        if (!isAvailable()) {
            logger.warn("BigQuery is not available. Cannot retrieve historical events.");
            return Collections.emptyList();
        }

        try {
            String query = buildHistoricalEventsQuery(userId, startDate, endDate);
            logger.info("Executing BigQuery historical events query for user: {}", userId);

            TableResult result = executeQuery(query);
            return parseEventResults(result);
        } catch (Exception e) {
            logger.error("Error retrieving historical events from BigQuery", e);
            return Collections.emptyList();
        }
    }

    /**
     * Analyze user journey from BigQuery data
     */
    public UserJourneyAnalysis analyzeUserJourney(String userId, LocalDate startDate, LocalDate endDate) {
        if (!isAvailable()) {
            logger.warn("BigQuery is not available. Cannot analyze user journey.");
            return null;
        }

        try {
            String query = buildUserJourneyQuery(userId, startDate, endDate);
            logger.info("Executing BigQuery user journey analysis for user: {}", userId);

            TableResult result = executeQuery(query);
            return parseUserJourneyAnalysis(result, userId);
        } catch (Exception e) {
            logger.error("Error analyzing user journey from BigQuery", e);
            return null;
        }
    }

    /**
     * Get event count aggregations for a date range
     */
    public List<EventCountAggregation> getEventCountAggregations(LocalDate startDate, LocalDate endDate) {
        if (!isAvailable()) {
            logger.warn("BigQuery is not available. Cannot retrieve event counts.");
            return Collections.emptyList();
        }

        try {
            String query = buildEventCountQuery(startDate, endDate);
            logger.info("Executing BigQuery event count aggregation query");

            TableResult result = executeQuery(query);
            return parseEventCountAggregations(result);
        } catch (Exception e) {
            logger.error("Error retrieving event counts from BigQuery", e);
            return Collections.emptyList();
        }
    }

    /**
     * Get calculator interaction statistics
     */
    public Map<String, Object> getCalculatorStatistics(LocalDate startDate, LocalDate endDate) {
        if (!isAvailable()) {
            logger.warn("BigQuery is not available. Cannot retrieve calculator statistics.");
            return Collections.emptyMap();
        }

        try {
            String query = buildCalculatorStatsQuery(startDate, endDate);
            logger.info("Executing BigQuery calculator statistics query");

            TableResult result = executeQuery(query);
            return parseCalculatorStatistics(result);
        } catch (Exception e) {
            logger.error("Error retrieving calculator statistics from BigQuery", e);
            return Collections.emptyMap();
        }
    }

    /**
     * Get video engagement metrics
     */
    public Map<String, Object> getVideoEngagementMetrics(LocalDate startDate, LocalDate endDate) {
        if (!isAvailable()) {
            logger.warn("BigQuery is not available. Cannot retrieve video engagement metrics.");
            return Collections.emptyMap();
        }

        try {
            String query = buildVideoEngagementQuery(startDate, endDate);
            logger.info("Executing BigQuery video engagement query");

            TableResult result = executeQuery(query);
            return parseVideoEngagementMetrics(result);
        } catch (Exception e) {
            logger.error("Error retrieving video engagement metrics from BigQuery", e);
            return Collections.emptyMap();
        }
    }

    // Private helper methods

    private String buildHistoricalEventsQuery(String userId, LocalDate startDate, LocalDate endDate) {
        String startSuffix = startDate.format(DATE_FORMATTER);
        String endSuffix = endDate.format(DATE_FORMATTER);

        return String.format("""
            SELECT
              event_name,
              event_timestamp,
              user_pseudo_id,
              user_id,
              event_params,
              user_properties,
              device,
              geo
            FROM
              `%s.%s.events_*`
            WHERE
              _TABLE_SUFFIX BETWEEN '%s' AND '%s'
              AND (user_pseudo_id = @userId OR user_id = @userId)
            ORDER BY
              event_timestamp
            """,
            config.getProjectId(),
            config.getDatasetId(),
            startSuffix,
            endSuffix
        );
    }

    private String buildUserJourneyQuery(String userId, LocalDate startDate, LocalDate endDate) {
        String startSuffix = startDate.format(DATE_FORMATTER);
        String endSuffix = endDate.format(DATE_FORMATTER);

        return String.format("""
            SELECT
              event_name,
              event_timestamp,
              ROW_NUMBER() OVER (PARTITION BY user_pseudo_id ORDER BY event_timestamp) as sequence_number,
              (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') as page_location
            FROM
              `%s.%s.events_*`
            WHERE
              _TABLE_SUFFIX BETWEEN '%s' AND '%s'
              AND (user_pseudo_id = @userId OR user_id = @userId)
            ORDER BY
              event_timestamp
            """,
            config.getProjectId(),
            config.getDatasetId(),
            startSuffix,
            endSuffix
        );
    }

    private String buildEventCountQuery(LocalDate startDate, LocalDate endDate) {
        String startSuffix = startDate.format(DATE_FORMATTER);
        String endSuffix = endDate.format(DATE_FORMATTER);

        return String.format("""
            SELECT
              event_date,
              event_name,
              COUNT(*) as event_count,
              COUNT(DISTINCT user_pseudo_id) as unique_users
            FROM
              `%s.%s.events_*`
            WHERE
              _TABLE_SUFFIX BETWEEN '%s' AND '%s'
            GROUP BY
              event_date, event_name
            ORDER BY
              event_date, event_count DESC
            """,
            config.getProjectId(),
            config.getDatasetId(),
            startSuffix,
            endSuffix
        );
    }

    private String buildCalculatorStatsQuery(LocalDate startDate, LocalDate endDate) {
        String startSuffix = startDate.format(DATE_FORMATTER);
        String endSuffix = endDate.format(DATE_FORMATTER);

        return String.format("""
            SELECT
              (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'loan_amount') as loan_amount,
              (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'interest_rate') as interest_rate,
              (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'term_years') as term_years,
              COUNT(*) as calculation_count,
              COUNT(DISTINCT user_pseudo_id) as unique_users
            FROM
              `%s.%s.events_*`
            WHERE
              _TABLE_SUFFIX BETWEEN '%s' AND '%s'
              AND event_name = 'calculator_interaction'
            GROUP BY
              loan_amount, interest_rate, term_years
            ORDER BY
              calculation_count DESC
            LIMIT 100
            """,
            config.getProjectId(),
            config.getDatasetId(),
            startSuffix,
            endSuffix
        );
    }

    private String buildVideoEngagementQuery(LocalDate startDate, LocalDate endDate) {
        String startSuffix = startDate.format(DATE_FORMATTER);
        String endSuffix = endDate.format(DATE_FORMATTER);

        return String.format("""
            SELECT
              (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'video_id') as video_id,
              (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'action') as action,
              COUNT(*) as action_count,
              COUNT(DISTINCT user_pseudo_id) as unique_users,
              AVG((SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'completion_rate')) as avg_completion_rate
            FROM
              `%s.%s.events_*`
            WHERE
              _TABLE_SUFFIX BETWEEN '%s' AND '%s'
              AND event_name = 'video_engagement'
            GROUP BY
              video_id, action
            ORDER BY
              action_count DESC
            """,
            config.getProjectId(),
            config.getDatasetId(),
            startSuffix,
            endSuffix
        );
    }

    private TableResult executeQuery(String query) throws InterruptedException {
        QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query)
                .setUseLegacySql(false)
                .build();

        Job queryJob = bigQuery.create(JobInfo.newBuilder(queryConfig).build());
        queryJob = queryJob.waitFor();

        if (queryJob == null) {
            throw new RuntimeException("Job no longer exists");
        } else if (queryJob.getStatus() != null && queryJob.getStatus().getError() != null) {
            throw new RuntimeException(queryJob.getStatus().getError().toString());
        }

        return queryJob.getQueryResults();
    }

    private List<BigQueryEventResult> parseEventResults(TableResult result) {
        List<BigQueryEventResult> events = new ArrayList<>();

        for (FieldValueList row : result.iterateAll()) {
            BigQueryEventResult event = new BigQueryEventResult();
            event.setEventName(row.get("event_name").getStringValue());
            // Convert microseconds to seconds for Instant
            long timestampMicros = row.get("event_timestamp").getLongValue();
            event.setEventTimestamp(Instant.ofEpochSecond(timestampMicros / 1_000_000, (timestampMicros % 1_000_000) * 1000));
            event.setUserPseudoId(row.get("user_pseudo_id").getStringValue());
            
            if (!row.get("user_id").isNull()) {
                event.setUserId(row.get("user_id").getStringValue());
            }

            // Parse event params
            event.setEventParams(parseEventParams(row.get("event_params")));

            events.add(event);
        }

        logger.info("Parsed {} events from BigQuery", events.size());
        return events;
    }

    private UserJourneyAnalysis parseUserJourneyAnalysis(TableResult result, String userId) {
        UserJourneyAnalysis analysis = new UserJourneyAnalysis();
        analysis.setUserId(userId);

        List<UserJourneyAnalysis.JourneyStep> steps = new ArrayList<>();
        Instant firstTimestamp = null;
        Instant lastTimestamp = null;

        for (FieldValueList row : result.iterateAll()) {
            // Convert microseconds to seconds for Instant
            long timestampMicros = row.get("event_timestamp").getLongValue();
            Instant timestamp = Instant.ofEpochSecond(timestampMicros / 1_000_000, (timestampMicros % 1_000_000) * 1000);
            
            if (firstTimestamp == null) {
                firstTimestamp = timestamp;
            }
            lastTimestamp = timestamp;

            UserJourneyAnalysis.JourneyStep step = new UserJourneyAnalysis.JourneyStep();
            step.setEventName(row.get("event_name").getStringValue());
            step.setTimestamp(timestamp);
            step.setSequenceNumber((int) row.get("sequence_number").getLongValue());
            
            if (!row.get("page_location").isNull()) {
                step.setPageLocation(row.get("page_location").getStringValue());
            }

            steps.add(step);
        }

        analysis.setSteps(steps);
        analysis.setTotalEvents(steps.size());
        analysis.setStartTime(firstTimestamp);
        analysis.setEndTime(lastTimestamp);

        if (firstTimestamp != null && lastTimestamp != null) {
            analysis.setDurationSeconds(lastTimestamp.getEpochSecond() - firstTimestamp.getEpochSecond());
        }

        logger.info("Parsed user journey with {} steps", steps.size());
        return analysis;
    }

    private List<EventCountAggregation> parseEventCountAggregations(TableResult result) {
        Map<LocalDate, EventCountAggregation> aggregationMap = new HashMap<>();

        for (FieldValueList row : result.iterateAll()) {
            String dateStr = row.get("event_date").getStringValue();
            LocalDate date = LocalDate.parse(dateStr, DATE_FORMATTER);
            String eventName = row.get("event_name").getStringValue();
            long eventCount = row.get("event_count").getLongValue();
            long uniqueUsers = row.get("unique_users").getLongValue();

            EventCountAggregation aggregation = aggregationMap.computeIfAbsent(date, d -> {
                EventCountAggregation agg = new EventCountAggregation();
                agg.setDate(d);
                agg.setEventCounts(new HashMap<>());
                return agg;
            });

            aggregation.getEventCounts().put(eventName, eventCount);
            aggregation.setTotalEvents(aggregation.getTotalEvents() + eventCount);
            aggregation.setUniqueUsers(Math.max(aggregation.getUniqueUsers(), uniqueUsers));
        }

        List<EventCountAggregation> aggregations = new ArrayList<>(aggregationMap.values());
        aggregations.sort(Comparator.comparing(EventCountAggregation::getDate));

        logger.info("Parsed {} event count aggregations", aggregations.size());
        return aggregations;
    }

    private Map<String, Object> parseCalculatorStatistics(TableResult result) {
        Map<String, Object> stats = new HashMap<>();
        List<Map<String, Object>> calculations = new ArrayList<>();

        for (FieldValueList row : result.iterateAll()) {
            Map<String, Object> calc = new HashMap<>();
            
            if (!row.get("loan_amount").isNull()) {
                calc.put("loanAmount", row.get("loan_amount").getLongValue());
            }
            if (!row.get("interest_rate").isNull()) {
                calc.put("interestRate", row.get("interest_rate").getDoubleValue());
            }
            if (!row.get("term_years").isNull()) {
                calc.put("termYears", row.get("term_years").getLongValue());
            }
            calc.put("count", row.get("calculation_count").getLongValue());
            calc.put("uniqueUsers", row.get("unique_users").getLongValue());

            calculations.add(calc);
        }

        stats.put("calculations", calculations);
        stats.put("totalCalculations", calculations.stream()
                .mapToLong(c -> (Long) c.get("count"))
                .sum());

        logger.info("Parsed calculator statistics with {} unique calculations", calculations.size());
        return stats;
    }

    private Map<String, Object> parseVideoEngagementMetrics(TableResult result) {
        Map<String, Object> metrics = new HashMap<>();
        List<Map<String, Object>> videos = new ArrayList<>();

        for (FieldValueList row : result.iterateAll()) {
            Map<String, Object> video = new HashMap<>();
            
            if (!row.get("video_id").isNull()) {
                video.put("videoId", row.get("video_id").getStringValue());
            }
            if (!row.get("action").isNull()) {
                video.put("action", row.get("action").getStringValue());
            }
            video.put("actionCount", row.get("action_count").getLongValue());
            video.put("uniqueUsers", row.get("unique_users").getLongValue());
            
            if (!row.get("avg_completion_rate").isNull()) {
                video.put("avgCompletionRate", row.get("avg_completion_rate").getDoubleValue());
            }

            videos.add(video);
        }

        metrics.put("videos", videos);
        metrics.put("totalEngagements", videos.stream()
                .mapToLong(v -> (Long) v.get("actionCount"))
                .sum());

        logger.info("Parsed video engagement metrics for {} video actions", videos.size());
        return metrics;
    }

    private Map<String, Object> parseEventParams(FieldValue eventParamsField) {
        Map<String, Object> params = new HashMap<>();
        
        if (eventParamsField.isNull()) {
            return params;
        }

        for (FieldValue param : eventParamsField.getRepeatedValue()) {
            FieldValueList paramFields = param.getRecordValue();
            String key = paramFields.get("key").getStringValue();
            FieldValue value = paramFields.get("value").getRecordValue().get(0);

            if (!value.isNull()) {
                if (value.getAttribute() == FieldValue.Attribute.PRIMITIVE) {
                    params.put(key, value.getValue());
                }
            }
        }

        return params;
    }
}
