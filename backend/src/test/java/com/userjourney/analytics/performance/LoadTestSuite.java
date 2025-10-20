package com.userjourney.analytics.performance;

import com.userjourney.analytics.model.UserEvent;


import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Load Testing Suite for User Journey Analytics System
 * Tests system performance under various load conditions
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
    "aws.region=us-east-1",
    "spring.profiles.active=test",
    "aws.mock.enabled=true"
})
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LoadTestSuite {

    @Autowired
    private TestRestTemplate restTemplate;



    private ExecutorService executorService;
    private final Random random = new Random();

    // Performance thresholds
    private static final int BASELINE_RPS = 100; // Requests per second
    private static final int STRESS_RPS = 500;
    private static final int SPIKE_RPS = 1000;
    private static final long MAX_RESPONSE_TIME_MS = 2000;
    private static final double MAX_ERROR_RATE = 0.05; // 5%

    @BeforeEach
    void setUp() {
        executorService = Executors.newFixedThreadPool(50);
    }

    @Test
    @Order(1)
    void testBaselinePerformance() throws InterruptedException {
        System.out.println("=== BASELINE PERFORMANCE TEST ===");
        
        LoadTestResult result = executeLoadTest(
            "Baseline Load Test",
            BASELINE_RPS,
            Duration.ofMinutes(2),
            10 // concurrent users
        );
        
        // Assertions for baseline performance
        assertTrue(result.getAverageResponseTime() < MAX_RESPONSE_TIME_MS, 
            "Average response time should be under " + MAX_RESPONSE_TIME_MS + "ms");
        assertTrue(result.getErrorRate() < MAX_ERROR_RATE, 
            "Error rate should be under " + (MAX_ERROR_RATE * 100) + "%");
        assertTrue(result.getThroughput() >= BASELINE_RPS * 0.9, 
            "Throughput should be at least 90% of target RPS");
        
        System.out.println("Baseline test completed successfully");
        printTestResults(result);
    }

    @Test
    @Order(2)
    void testStressPerformance() throws InterruptedException {
        System.out.println("=== STRESS PERFORMANCE TEST ===");
        
        LoadTestResult result = executeLoadTest(
            "Stress Load Test",
            STRESS_RPS,
            Duration.ofMinutes(3),
            25 // concurrent users
        );
        
        // More lenient assertions for stress test
        assertTrue(result.getAverageResponseTime() < MAX_RESPONSE_TIME_MS * 2, 
            "Average response time should be under " + (MAX_RESPONSE_TIME_MS * 2) + "ms during stress");
        assertTrue(result.getErrorRate() < MAX_ERROR_RATE * 2, 
            "Error rate should be under " + (MAX_ERROR_RATE * 200) + "% during stress");
        assertTrue(result.getThroughput() >= STRESS_RPS * 0.7, 
            "Throughput should be at least 70% of target RPS during stress");
        
        System.out.println("Stress test completed successfully");
        printTestResults(result);
    }

    @Test
    @Order(3)
    void testSpikePerformance() throws InterruptedException {
        System.out.println("=== SPIKE PERFORMANCE TEST ===");
        
        // Spike test: sudden increase in load
        executeLoadTest(
            "Spike Warmup",
            BASELINE_RPS,
            Duration.ofSeconds(30),
            10
        );
        
        LoadTestResult spikeResult = executeLoadTest(
            "Spike Load Test",
            SPIKE_RPS,
            Duration.ofMinutes(1),
            50 // concurrent users
        );
        
        // Spike test assertions - system should handle sudden load increase
        assertTrue(spikeResult.getAverageResponseTime() < MAX_RESPONSE_TIME_MS * 3, 
            "System should handle spike load within reasonable response time");
        assertTrue(spikeResult.getErrorRate() < MAX_ERROR_RATE * 3, 
            "Error rate should remain manageable during spike");
        
        System.out.println("Spike test completed successfully");
        printTestResults(spikeResult);
    }

    @Test
    @Order(4)
    void testEndurancePerformance() throws InterruptedException {
        System.out.println("=== ENDURANCE PERFORMANCE TEST ===");
        
        LoadTestResult result = executeLoadTest(
            "Endurance Load Test",
            BASELINE_RPS / 2, // Sustained moderate load
            Duration.ofMinutes(5),
            15 // concurrent users
        );
        
        // Endurance test should maintain consistent performance
        assertTrue(result.getAverageResponseTime() < MAX_RESPONSE_TIME_MS, 
            "System should maintain performance over extended period");
        assertTrue(result.getErrorRate() < MAX_ERROR_RATE, 
            "Error rate should remain low during endurance test");
        
        // Check for memory leaks or performance degradation
        assertTrue(result.getResponseTimeStdDev() < result.getAverageResponseTime() * 0.5, 
            "Response time should remain consistent (low standard deviation)");
        
        System.out.println("Endurance test completed successfully");
        printTestResults(result);
    }

    @Test
    @Order(5)
    void testConcurrentUserScenarios() throws InterruptedException {
        System.out.println("=== CONCURRENT USER SCENARIOS TEST ===");
        
        // Test different user behavior patterns simultaneously
        List<Future<LoadTestResult>> futures = new ArrayList<>();
        
        // Scenario 1: New users registering and exploring
        futures.add(executorService.submit(() -> 
            executeUserScenario("new_user_journey", 20, Duration.ofMinutes(2))));
        
        // Scenario 2: Active users with video engagement
        futures.add(executorService.submit(() -> 
            executeUserScenario("video_engagement", 15, Duration.ofMinutes(2))));
        
        // Scenario 3: Users experiencing struggles
        futures.add(executorService.submit(() -> 
            executeUserScenario("struggle_scenario", 10, Duration.ofMinutes(2))));
        
        // Wait for all scenarios to complete
        List<LoadTestResult> results = new ArrayList<>();
        for (Future<LoadTestResult> future : futures) {
            try {
                results.add(future.get(5, TimeUnit.MINUTES));
            } catch (ExecutionException | TimeoutException e) {
                fail("Concurrent user scenario failed: " + e.getMessage());
            }
        }
        
        // Verify all scenarios completed successfully
        for (LoadTestResult result : results) {
            assertTrue(result.getErrorRate() < MAX_ERROR_RATE * 2, 
                "Concurrent scenarios should maintain acceptable error rates");
            assertTrue(result.getAverageResponseTime() < MAX_RESPONSE_TIME_MS * 1.5, 
                "Concurrent scenarios should maintain reasonable response times");
        }
        
        System.out.println("Concurrent user scenarios test completed successfully");
        results.forEach(this::printTestResults);
    }

    @Test
    @Order(6)
    void testDatabaseConnectionPooling() throws InterruptedException {
        System.out.println("=== DATABASE CONNECTION POOLING TEST ===");
        
        // Test high database connection usage
        LoadTestResult result = executeLoadTest(
            "Database Connection Pool Test",
            200, // High RPS to stress connection pool
            Duration.ofMinutes(2),
            30 // concurrent users
        );
        
        // Should handle high connection usage without errors
        assertTrue(result.getErrorRate() < MAX_ERROR_RATE, 
            "Connection pool should handle high concurrent database access");
        assertTrue(result.getAverageResponseTime() < MAX_RESPONSE_TIME_MS * 1.5, 
            "Database operations should remain performant under load");
        
        System.out.println("Database connection pooling test completed successfully");
        printTestResults(result);
    }

    private LoadTestResult executeLoadTest(String testName, int targetRPS, Duration duration, int concurrentUsers) 
            throws InterruptedException {
        
        System.out.println("Starting " + testName + " - Target RPS: " + targetRPS + 
                          ", Duration: " + duration.toMinutes() + "m, Concurrent Users: " + concurrentUsers);
        
        AtomicInteger totalRequests = new AtomicInteger(0);
        AtomicInteger successfulRequests = new AtomicInteger(0);
        AtomicInteger failedRequests = new AtomicInteger(0);
        AtomicLong totalResponseTime = new AtomicLong(0);
        List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());
        
        Instant startTime = Instant.now();
        Instant endTime = startTime.plus(duration);
        
        // Calculate delay between requests to achieve target RPS
        long delayBetweenRequests = 1000 / (targetRPS / concurrentUsers);
        
        List<Future<?>> userTasks = new ArrayList<>();
        
        for (int user = 0; user < concurrentUsers; user++) {
            final int userId = user;
            Future<?> userTask = executorService.submit(() -> {
                while (Instant.now().isBefore(endTime)) {
                    try {
                        long requestStart = System.currentTimeMillis();
                        
                        UserEvent testEvent = createLoadTestEvent("load-test-user-" + userId);
                        ResponseEntity<Void> response = restTemplate.postForEntity(
                            "/api/events/track", testEvent, Void.class);
                        
                        long requestEnd = System.currentTimeMillis();
                        long responseTime = requestEnd - requestStart;
                        
                        totalRequests.incrementAndGet();
                        totalResponseTime.addAndGet(responseTime);
                        responseTimes.add(responseTime);
                        
                        if (response.getStatusCode() == HttpStatus.OK) {
                            successfulRequests.incrementAndGet();
                        } else {
                            failedRequests.incrementAndGet();
                        }
                        
                        Thread.sleep(delayBetweenRequests);
                        
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (Exception e) {
                        failedRequests.incrementAndGet();
                        totalRequests.incrementAndGet();
                    }
                }
            });
            userTasks.add(userTask);
        }
        
        // Wait for all user tasks to complete
        for (Future<?> task : userTasks) {
            try {
                task.get();
            } catch (ExecutionException | InterruptedException e) {
                System.err.println("User task failed: " + e.getMessage());
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
            }
        }
        
        Instant actualEndTime = Instant.now();
        Duration actualDuration = Duration.between(startTime, actualEndTime);
        
        return calculateLoadTestResult(testName, totalRequests.get(), successfulRequests.get(), 
                                     failedRequests.get(), totalResponseTime.get(), 
                                     responseTimes, actualDuration);
    }

    private LoadTestResult executeUserScenario(String scenarioType, int concurrentUsers, Duration duration) {
        System.out.println("Executing user scenario: " + scenarioType);
        
        AtomicInteger totalRequests = new AtomicInteger(0);
        AtomicInteger successfulRequests = new AtomicInteger(0);
        AtomicInteger failedRequests = new AtomicInteger(0);
        AtomicLong totalResponseTime = new AtomicLong(0);
        List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());
        
        Instant startTime = Instant.now();
        Instant endTime = startTime.plus(duration);
        
        List<Future<?>> userTasks = new ArrayList<>();
        
        for (int user = 0; user < concurrentUsers; user++) {
            final int userId = user;
            Future<?> userTask = executorService.submit(() -> {
                while (Instant.now().isBefore(endTime)) {
                    try {
                        List<UserEvent> scenarioEvents = createScenarioEvents(scenarioType, "scenario-user-" + userId);
                        
                        for (UserEvent event : scenarioEvents) {
                            long requestStart = System.currentTimeMillis();
                            
                            ResponseEntity<Void> response = restTemplate.postForEntity(
                                "/api/events/track", event, Void.class);
                            
                            long requestEnd = System.currentTimeMillis();
                            long responseTime = requestEnd - requestStart;
                            
                            totalRequests.incrementAndGet();
                            totalResponseTime.addAndGet(responseTime);
                            responseTimes.add(responseTime);
                            
                            if (response.getStatusCode() == HttpStatus.OK) {
                                successfulRequests.incrementAndGet();
                            } else {
                                failedRequests.incrementAndGet();
                            }
                            
                            Thread.sleep(100); // Small delay between events in scenario
                        }
                        
                        Thread.sleep(2000); // Delay between scenario iterations
                        
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (Exception e) {
                        failedRequests.incrementAndGet();
                        totalRequests.incrementAndGet();
                    }
                }
            });
            userTasks.add(userTask);
        }
        
        // Wait for all user tasks to complete
        for (Future<?> task : userTasks) {
            try {
                task.get();
            } catch (ExecutionException | InterruptedException e) {
                System.err.println("Scenario task failed: " + e.getMessage());
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
            }
        }
        
        Instant actualEndTime = Instant.now();
        Duration actualDuration = Duration.between(startTime, actualEndTime);
        
        return calculateLoadTestResult(scenarioType, totalRequests.get(), successfulRequests.get(), 
                                     failedRequests.get(), totalResponseTime.get(), 
                                     responseTimes, actualDuration);
    }

    private LoadTestResult calculateLoadTestResult(String testName, int totalRequests, int successfulRequests, 
                                                 int failedRequests, long totalResponseTime, 
                                                 List<Long> responseTimes, Duration duration) {
        
        double errorRate = totalRequests > 0 ? (double) failedRequests / totalRequests : 0;
        double averageResponseTime = totalRequests > 0 ? (double) totalResponseTime / totalRequests : 0;
        double throughput = totalRequests / (duration.toMillis() / 1000.0);
        
        // Calculate percentiles
        Collections.sort(responseTimes);
        long p50 = responseTimes.isEmpty() ? 0 : responseTimes.get((int) (responseTimes.size() * 0.5));
        long p95 = responseTimes.isEmpty() ? 0 : responseTimes.get((int) (responseTimes.size() * 0.95));
        long p99 = responseTimes.isEmpty() ? 0 : responseTimes.get((int) (responseTimes.size() * 0.99));
        
        // Calculate standard deviation
        double variance = responseTimes.stream()
            .mapToDouble(rt -> Math.pow(rt - averageResponseTime, 2))
            .average()
            .orElse(0);
        double stdDev = Math.sqrt(variance);
        
        return new LoadTestResult(testName, totalRequests, successfulRequests, failedRequests, 
                                errorRate, averageResponseTime, stdDev, throughput, 
                                p50, p95, p99, duration);
    }

    private UserEvent createLoadTestEvent(String userId) {
        UserEvent event = new UserEvent();
        event.setUserId(userId);
        event.setSessionId("load-test-session-" + random.nextInt(1000));
        event.setTimestamp(System.currentTimeMillis());
        
        // Randomize event types for realistic load testing
        String[] eventTypes = {"page_view", "feature_interaction", "video_engagement", "session_start"};
        event.setEventType(eventTypes[random.nextInt(eventTypes.length)]);
        
        UserEvent.EventData data = new UserEvent.EventData();
        data.setFeature("load_test_feature_" + random.nextInt(10));
        data.setDuration(random.nextInt(300) + 30);
        event.setEventData(data);
        
        UserEvent.DeviceInfo deviceInfo = new UserEvent.DeviceInfo();
        deviceInfo.setPlatform("Web");
        deviceInfo.setAppVersion("1.0.0");
        deviceInfo.setDeviceModel("LoadTest");
        event.setDeviceInfo(deviceInfo);
        
        UserEvent.UserContext userContext = new UserEvent.UserContext();
        userContext.setUserSegment("load_test_user");
        userContext.setSessionStage("active");
        userContext.setPreviousActions(new ArrayList<>());
        event.setUserContext(userContext);
        
        return event;
    }

    private List<UserEvent> createScenarioEvents(String scenarioType, String userId) {
        List<UserEvent> events = new ArrayList<>();
        
        switch (scenarioType) {
            case "new_user_journey":
                events.add(createEventForScenario(userId, "user_registration", Map.of("method", "email")));
                events.add(createEventForScenario(userId, "page_view", Map.of("page", "dashboard")));
                events.add(createEventForScenario(userId, "feature_interaction", Map.of("feature", "tutorial")));
                break;
                
            case "video_engagement":
                events.add(createEventForScenario(userId, "video_engagement", 
                    Map.of("video_id", "tutorial_" + random.nextInt(10), "duration", 120)));
                events.add(createEventForScenario(userId, "video_engagement", 
                    Map.of("video_id", "advanced_" + random.nextInt(5), "duration", 180)));
                break;
                
            case "struggle_scenario":
                for (int i = 1; i <= 3; i++) {
                    events.add(createEventForScenario(userId, "feature_interaction", 
                        Map.of("feature", "complex_form", "attempt_count", i, "success", false)));
                }
                break;
        }
        
        return events;
    }

    private UserEvent createEventForScenario(String userId, String eventType, Map<String, Object> eventData) {
        UserEvent event = createLoadTestEvent(userId);
        event.setEventType(eventType);
        
        UserEvent.EventData data = event.getEventData();
        eventData.forEach((key, value) -> {
            switch (key) {
                case "feature" -> data.setFeature((String) value);
                case "video_id" -> data.setVideoId((String) value);
                case "duration" -> data.setDuration((Integer) value);
                case "attempt_count" -> data.setAttemptCount((Integer) value);
                // Skip additional properties for now since they're not in the model
            }
        });
        
        return event;
    }

    private void printTestResults(LoadTestResult result) {
        System.out.println("\n" + "=".repeat(50));
        System.out.println("LOAD TEST RESULTS: " + result.getTestName());
        System.out.println("=".repeat(50));
        System.out.println("Duration: " + result.getDuration().toSeconds() + " seconds");
        System.out.println("Total Requests: " + result.getTotalRequests());
        System.out.println("Successful Requests: " + result.getSuccessfulRequests());
        System.out.println("Failed Requests: " + result.getFailedRequests());
        System.out.println("Error Rate: " + String.format("%.2f%%", result.getErrorRate() * 100));
        System.out.println("Throughput: " + String.format("%.2f RPS", result.getThroughput()));
        System.out.println("Average Response Time: " + String.format("%.2f ms", result.getAverageResponseTime()));
        System.out.println("Response Time Std Dev: " + String.format("%.2f ms", result.getResponseTimeStdDev()));
        System.out.println("Response Time P50: " + result.getP50() + " ms");
        System.out.println("Response Time P95: " + result.getP95() + " ms");
        System.out.println("Response Time P99: " + result.getP99() + " ms");
        System.out.println("=".repeat(50) + "\n");
    }

    // Inner class for load test results
    public static class LoadTestResult {
        private final String testName;
        private final int totalRequests;
        private final int successfulRequests;
        private final int failedRequests;
        private final double errorRate;
        private final double averageResponseTime;
        private final double responseTimeStdDev;
        private final double throughput;
        private final long p50;
        private final long p95;
        private final long p99;
        private final Duration duration;

        public LoadTestResult(String testName, int totalRequests, int successfulRequests, int failedRequests,
                            double errorRate, double averageResponseTime, double responseTimeStdDev, 
                            double throughput, long p50, long p95, long p99, Duration duration) {
            this.testName = testName;
            this.totalRequests = totalRequests;
            this.successfulRequests = successfulRequests;
            this.failedRequests = failedRequests;
            this.errorRate = errorRate;
            this.averageResponseTime = averageResponseTime;
            this.responseTimeStdDev = responseTimeStdDev;
            this.throughput = throughput;
            this.p50 = p50;
            this.p95 = p95;
            this.p99 = p99;
            this.duration = duration;
        }

        // Getters
        public String getTestName() { return testName; }
        public int getTotalRequests() { return totalRequests; }
        public int getSuccessfulRequests() { return successfulRequests; }
        public int getFailedRequests() { return failedRequests; }
        public double getErrorRate() { return errorRate; }
        public double getAverageResponseTime() { return averageResponseTime; }
        public double getResponseTimeStdDev() { return responseTimeStdDev; }
        public double getThroughput() { return throughput; }
        public long getP50() { return p50; }
        public long getP95() { return p95; }
        public long getP99() { return p99; }
        public Duration getDuration() { return duration; }
    }
}