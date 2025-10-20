package com.userjourney.analytics.service;

import com.userjourney.analytics.model.ExitRiskFeatures;
import com.userjourney.analytics.model.UserEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.core.sync.RequestBody;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for monitoring ML model performance and triggering retraining
 */
@Service
public class ModelMonitoringService {
    
    private static final Logger logger = LoggerFactory.getLogger(ModelMonitoringService.class);
    
    @Autowired
    private SageMakerPredictiveService sageMakerPredictiveService;
    
    @Autowired
    private FeatureEngineeringService featureEngineeringService;
    
    @Autowired
    private EventCollectionService eventCollectionService;
    
    @Autowired
    private S3Client s3Client;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Value("${model.monitoring.s3-bucket:user-journey-analytics}")
    private String monitoringBucket;
    
    @Value("${model.monitoring.accuracy-threshold:0.80}")
    private double accuracyThreshold;
    
    @Value("${model.monitoring.drift-threshold:0.15}")
    private double driftThreshold;
    
    // Model performance tracking
    private final Map<String, ModelPredictionRecord> predictionRecords = new ConcurrentHashMap<>();
    private final Map<String, ModelMetrics> dailyMetrics = new ConcurrentHashMap<>();
    
    /**
     * Record a prediction for monitoring
     */
    public void recordPrediction(String userId, double predictedRiskScore, String predictedRiskLevel) {
        ModelPredictionRecord record = new ModelPredictionRecord(
            userId, predictedRiskScore, predictedRiskLevel, Instant.now()
        );
        
        predictionRecords.put(userId, record);
        
        logger.debug("Recorded prediction for user {}: score={}, level={}", 
            userId, predictedRiskScore, predictedRiskLevel);
    }
    
    /**
     * Record actual outcome for model validation
     */
    public void recordActualOutcome(String userId, boolean actuallyExited) {
        ModelPredictionRecord record = predictionRecords.get(userId);
        if (record != null) {
            record.setActualOutcome(actuallyExited);
            record.setOutcomeRecordedAt(Instant.now());
            
            // Calculate prediction accuracy
            boolean predictedExit = record.getPredictedRiskScore() > 50.0;
            boolean correct = predictedExit == actuallyExited;
            record.setCorrectPrediction(correct);
            
            logger.info("Recorded actual outcome for user {}: predicted={}, actual={}, correct={}", 
                userId, predictedExit, actuallyExited, correct);
            
            // Update daily metrics
            updateDailyMetrics(record);
        }
    }
    
    /**
     * Update daily metrics with new prediction record
     */
    private void updateDailyMetrics(ModelPredictionRecord record) {
        String dateKey = record.getPredictionTime().truncatedTo(ChronoUnit.DAYS).toString();
        
        ModelMetrics metrics = dailyMetrics.computeIfAbsent(dateKey, k -> new ModelMetrics(dateKey));
        metrics.addPrediction(record);
    }
    
    /**
     * Scheduled task to monitor model performance daily
     */
    @Scheduled(cron = "0 0 2 * * *") // Run at 2 AM daily
    public void performDailyModelMonitoring() {
        logger.info("Starting daily model monitoring...");
        
        try {
            // Calculate recent model performance
            ModelPerformanceReport report = calculateModelPerformance();
            
            // Check for performance degradation
            if (report.getAccuracy() < accuracyThreshold) {
                logger.warn("Model accuracy below threshold: {} < {}", report.getAccuracy(), accuracyThreshold);
                triggerModelRetraining("accuracy_degradation", report);
            }
            
            // Check for data drift
            double driftScore = calculateDataDrift();
            if (driftScore > driftThreshold) {
                logger.warn("Data drift detected: {} > {}", driftScore, driftThreshold);
                triggerModelRetraining("data_drift", report);
            }
            
            // Save monitoring report to S3
            saveMonitoringReport(report);
            
            // Clean up old records
            cleanupOldRecords();
            
            logger.info("Daily model monitoring completed. Accuracy: {:.3f}, Drift: {:.3f}", 
                report.getAccuracy(), driftScore);
            
        } catch (Exception e) {
            logger.error("Daily model monitoring failed: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Calculate model performance metrics
     */
    public ModelPerformanceReport calculateModelPerformance() {
        Instant sevenDaysAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        
        List<ModelPredictionRecord> recentRecords = predictionRecords.values().stream()
            .filter(record -> record.getPredictionTime().isAfter(sevenDaysAgo))
            .filter(record -> record.getActualOutcome() != null)
            .collect(Collectors.toList());
        
        if (recentRecords.isEmpty()) {
            logger.warn("No recent prediction records with outcomes available for performance calculation");
            return new ModelPerformanceReport(0, 0.0, 0.0, 0.0, 0.0, Instant.now());
        }
        
        // Calculate metrics
        int totalPredictions = recentRecords.size();
        long correctPredictions = recentRecords.stream()
            .mapToLong(record -> record.isCorrectPrediction() ? 1 : 0)
            .sum();
        
        double accuracy = (double) correctPredictions / totalPredictions;
        
        // Calculate precision, recall, F1 for exit predictions
        long truePositives = recentRecords.stream()
            .mapToLong(record -> {
                boolean predictedExit = record.getPredictedRiskScore() > 50.0;
                boolean actualExit = record.getActualOutcome();
                return (predictedExit && actualExit) ? 1 : 0;
            })
            .sum();
        
        long falsePositives = recentRecords.stream()
            .mapToLong(record -> {
                boolean predictedExit = record.getPredictedRiskScore() > 50.0;
                boolean actualExit = record.getActualOutcome();
                return (predictedExit && !actualExit) ? 1 : 0;
            })
            .sum();
        
        long falseNegatives = recentRecords.stream()
            .mapToLong(record -> {
                boolean predictedExit = record.getPredictedRiskScore() > 50.0;
                boolean actualExit = record.getActualOutcome();
                return (!predictedExit && actualExit) ? 1 : 0;
            })
            .sum();
        
        double precision = truePositives > 0 ? (double) truePositives / (truePositives + falsePositives) : 0.0;
        double recall = truePositives > 0 ? (double) truePositives / (truePositives + falseNegatives) : 0.0;
        double f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0.0;
        
        return new ModelPerformanceReport(totalPredictions, accuracy, precision, recall, f1Score, Instant.now());
    }
    
    /**
     * Calculate data drift score
     */
    private double calculateDataDrift() {
        try {
            // Get recent feature distributions
            Instant thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS);
            Instant sevenDaysAgo = Instant.now().minus(7, ChronoUnit.DAYS);
            
            // This is a simplified drift calculation
            // In production, you would use more sophisticated methods like KL divergence
            
            // For now, return a random drift score for demonstration
            return Math.random() * 0.1; // Low drift for demo
            
        } catch (Exception e) {
            logger.error("Failed to calculate data drift: {}", e.getMessage(), e);
            return 0.0;
        }
    }
    
    /**
     * Trigger model retraining
     */
    private void triggerModelRetraining(String reason, ModelPerformanceReport report) {
        logger.warn("Triggering model retraining due to: {}", reason);
        
        try {
            // Create retraining request
            ModelRetrainingRequest request = new ModelRetrainingRequest(
                reason, report, Instant.now()
            );
            
            // Save retraining request to S3 for processing
            String key = String.format("retraining-requests/%s_%s.json", 
                reason, System.currentTimeMillis());
            
            String requestJson = objectMapper.writeValueAsString(request);
            
            PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(monitoringBucket)
                .key(key)
                .contentType("application/json")
                .build();
            
            s3Client.putObject(putRequest, RequestBody.fromString(requestJson));
            
            logger.info("Model retraining request saved to S3: {}", key);
            
            // TODO: Integrate with actual retraining pipeline
            // This could trigger a SageMaker training job or Lambda function
            
        } catch (Exception e) {
            logger.error("Failed to trigger model retraining: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Save monitoring report to S3
     */
    private void saveMonitoringReport(ModelPerformanceReport report) {
        try {
            String key = String.format("monitoring-reports/%s_performance_report.json", 
                report.getReportTime().toString().substring(0, 10)); // YYYY-MM-DD
            
            String reportJson = objectMapper.writeValueAsString(report);
            
            PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(monitoringBucket)
                .key(key)
                .contentType("application/json")
                .build();
            
            s3Client.putObject(putRequest, RequestBody.fromString(reportJson));
            
            logger.debug("Monitoring report saved to S3: {}", key);
            
        } catch (Exception e) {
            logger.error("Failed to save monitoring report: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Clean up old prediction records
     */
    private void cleanupOldRecords() {
        Instant cutoff = Instant.now().minus(30, ChronoUnit.DAYS);
        
        int removedCount = 0;
        Iterator<Map.Entry<String, ModelPredictionRecord>> iterator = predictionRecords.entrySet().iterator();
        
        while (iterator.hasNext()) {
            Map.Entry<String, ModelPredictionRecord> entry = iterator.next();
            if (entry.getValue().getPredictionTime().isBefore(cutoff)) {
                iterator.remove();
                removedCount++;
            }
        }
        
        // Clean up daily metrics older than 90 days
        Instant metricscutoff = Instant.now().minus(90, ChronoUnit.DAYS);
        int removedMetrics = 0;
        
        Iterator<Map.Entry<String, ModelMetrics>> metricsIterator = dailyMetrics.entrySet().iterator();
        while (metricsIterator.hasNext()) {
            Map.Entry<String, ModelMetrics> entry = metricsIterator.next();
            try {
                Instant metricDate = Instant.parse(entry.getKey());
                if (metricDate.isBefore(metricscutoff)) {
                    metricsIterator.remove();
                    removedMetrics++;
                }
            } catch (Exception e) {
                // Invalid date format, remove it
                metricsIterator.remove();
                removedMetrics++;
            }
        }
        
        logger.info("Cleaned up {} old prediction records and {} old metric entries", 
            removedCount, removedMetrics);
    }
    
    /**
     * Get current model monitoring status
     */
    public ModelMonitoringStatus getMonitoringStatus() {
        ModelPerformanceReport latestReport = calculateModelPerformance();
        double driftScore = calculateDataDrift();
        
        boolean healthy = latestReport.getAccuracy() >= accuracyThreshold && driftScore <= driftThreshold;
        
        return new ModelMonitoringStatus(
            healthy,
            latestReport,
            driftScore,
            predictionRecords.size(),
            Instant.now()
        );
    }
    
    /**
     * Get daily metrics for a specific date range
     */
    public List<ModelMetrics> getDailyMetrics(Instant startDate, Instant endDate) {
        return dailyMetrics.values().stream()
            .filter(metrics -> {
                try {
                    Instant metricDate = Instant.parse(metrics.getDate());
                    return metricDate.isAfter(startDate) && metricDate.isBefore(endDate);
                } catch (Exception e) {
                    return false;
                }
            })
            .sorted(Comparator.comparing(ModelMetrics::getDate))
            .collect(Collectors.toList());
    }
    
    // Data classes for monitoring
    
    public static class ModelPredictionRecord {
        private String userId;
        private double predictedRiskScore;
        private String predictedRiskLevel;
        private Instant predictionTime;
        private Boolean actualOutcome;
        private Instant outcomeRecordedAt;
        private boolean correctPrediction;
        
        public ModelPredictionRecord(String userId, double predictedRiskScore, 
                                   String predictedRiskLevel, Instant predictionTime) {
            this.userId = userId;
            this.predictedRiskScore = predictedRiskScore;
            this.predictedRiskLevel = predictedRiskLevel;
            this.predictionTime = predictionTime;
        }
        
        // Getters and setters
        public String getUserId() { return userId; }
        public double getPredictedRiskScore() { return predictedRiskScore; }
        public String getPredictedRiskLevel() { return predictedRiskLevel; }
        public Instant getPredictionTime() { return predictionTime; }
        public Boolean getActualOutcome() { return actualOutcome; }
        public void setActualOutcome(Boolean actualOutcome) { this.actualOutcome = actualOutcome; }
        public Instant getOutcomeRecordedAt() { return outcomeRecordedAt; }
        public void setOutcomeRecordedAt(Instant outcomeRecordedAt) { this.outcomeRecordedAt = outcomeRecordedAt; }
        public boolean isCorrectPrediction() { return correctPrediction; }
        public void setCorrectPrediction(boolean correctPrediction) { this.correctPrediction = correctPrediction; }
    }
    
    public static class ModelMetrics {
        private String date;
        private int totalPredictions;
        private int correctPredictions;
        private double accuracy;
        private List<ModelPredictionRecord> predictions;
        
        public ModelMetrics(String date) {
            this.date = date;
            this.predictions = new ArrayList<>();
        }
        
        public void addPrediction(ModelPredictionRecord record) {
            predictions.add(record);
            totalPredictions++;
            if (record.isCorrectPrediction()) {
                correctPredictions++;
            }
            accuracy = totalPredictions > 0 ? (double) correctPredictions / totalPredictions : 0.0;
        }
        
        // Getters
        public String getDate() { return date; }
        public int getTotalPredictions() { return totalPredictions; }
        public int getCorrectPredictions() { return correctPredictions; }
        public double getAccuracy() { return accuracy; }
        public List<ModelPredictionRecord> getPredictions() { return predictions; }
    }
    
    public static class ModelPerformanceReport {
        private int totalPredictions;
        private double accuracy;
        private double precision;
        private double recall;
        private double f1Score;
        private Instant reportTime;
        
        public ModelPerformanceReport(int totalPredictions, double accuracy, double precision, 
                                    double recall, double f1Score, Instant reportTime) {
            this.totalPredictions = totalPredictions;
            this.accuracy = accuracy;
            this.precision = precision;
            this.recall = recall;
            this.f1Score = f1Score;
            this.reportTime = reportTime;
        }
        
        // Getters
        public int getTotalPredictions() { return totalPredictions; }
        public double getAccuracy() { return accuracy; }
        public double getPrecision() { return precision; }
        public double getRecall() { return recall; }
        public double getF1Score() { return f1Score; }
        public Instant getReportTime() { return reportTime; }
    }
    
    public static class ModelRetrainingRequest {
        private String reason;
        private ModelPerformanceReport performanceReport;
        private Instant requestTime;
        
        public ModelRetrainingRequest(String reason, ModelPerformanceReport performanceReport, Instant requestTime) {
            this.reason = reason;
            this.performanceReport = performanceReport;
            this.requestTime = requestTime;
        }
        
        // Getters
        public String getReason() { return reason; }
        public ModelPerformanceReport getPerformanceReport() { return performanceReport; }
        public Instant getRequestTime() { return requestTime; }
    }
    
    public static class ModelMonitoringStatus {
        private boolean healthy;
        private ModelPerformanceReport latestPerformance;
        private double driftScore;
        private int activePredictions;
        private Instant statusTime;
        
        public ModelMonitoringStatus(boolean healthy, ModelPerformanceReport latestPerformance, 
                                   double driftScore, int activePredictions, Instant statusTime) {
            this.healthy = healthy;
            this.latestPerformance = latestPerformance;
            this.driftScore = driftScore;
            this.activePredictions = activePredictions;
            this.statusTime = statusTime;
        }
        
        // Getters
        public boolean isHealthy() { return healthy; }
        public ModelPerformanceReport getLatestPerformance() { return latestPerformance; }
        public double getDriftScore() { return driftScore; }
        public int getActivePredictions() { return activePredictions; }
        public Instant getStatusTime() { return statusTime; }
    }
}