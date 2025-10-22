package com.userjourney.analytics.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.BigQueryOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.io.FileInputStream;
import java.io.IOException;

/**
 * BigQuery Configuration
 * 
 * Configures Google Cloud BigQuery client for querying Firebase Analytics data
 * exported to BigQuery. This enables cost-effective historical analytics queries.
 */
@Configuration
public class BigQueryConfig {

    private static final Logger logger = LoggerFactory.getLogger(BigQueryConfig.class);

    @Value("${bigquery.project-id:}")
    private String projectId;

    @Value("${bigquery.dataset-id:}")
    private String datasetId;

    @Value("${bigquery.credentials.path:}")
    private String credentialsPath;

    @Value("${bigquery.enabled:false}")
    private boolean bigQueryEnabled;

    /**
     * Create BigQuery client for production environment
     */
    @Bean
    @Profile("prod")
    public BigQuery bigQuery() throws IOException {
        if (!bigQueryEnabled) {
            logger.warn("BigQuery is disabled. Historical analytics queries will not be available.");
            return null;
        }

        logger.info("Initializing BigQuery client for project: {}", projectId);

        GoogleCredentials credentials;
        if (credentialsPath != null && !credentialsPath.isEmpty()) {
            credentials = GoogleCredentials.fromStream(new FileInputStream(credentialsPath));
            logger.info("Loaded BigQuery credentials from: {}", credentialsPath);
        } else {
            credentials = GoogleCredentials.getApplicationDefault();
            logger.info("Using application default credentials for BigQuery");
        }

        BigQuery bigQuery = BigQueryOptions.newBuilder()
                .setProjectId(projectId)
                .setCredentials(credentials)
                .build()
                .getService();

        logger.info("BigQuery client initialized successfully");
        return bigQuery;
    }

    /**
     * Create mock BigQuery client for development environment
     */
    @Bean
    @Profile("dev")
    public BigQuery bigQueryDev() {
        logger.info("BigQuery is not available in development mode. Using mock implementation.");
        return null;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getDatasetId() {
        return datasetId;
    }

    public boolean isBigQueryEnabled() {
        return bigQueryEnabled;
    }
}
