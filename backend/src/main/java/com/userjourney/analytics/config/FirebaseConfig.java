package com.userjourney.analytics.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;

/**
 * Firebase Configuration
 * 
 * Provides environment-aware Firebase initialization:
 * - Development: Uses Firebase Emulator
 * - Production: Uses actual Firebase services
 */
@Configuration
public class FirebaseConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);
    
    @Value("${firebase.project-id}")
    private String projectId;
    
    @Value("${firebase.credentials-path}")
    private Resource credentialsPath;
    
    @Value("${firebase.emulator.enabled:false}")
    private boolean emulatorEnabled;
    
    @Value("${firebase.emulator.host:localhost}")
    private String emulatorHost;
    
    @Value("${firebase.emulator.port:9099}")
    private int emulatorPort;
    
    @Value("${spring.profiles.active:dev}")
    private String activeProfile;
    
    @PostConstruct
    public void logFirebaseConfiguration() {
        logger.info("=".repeat(80));
        logger.info("Firebase Configuration Initialized");
        logger.info("=".repeat(80));
        logger.info("Active Profile: {}", activeProfile);
        logger.info("Project ID: {}", projectId);
        logger.info("Emulator Enabled: {}", emulatorEnabled);
        if (emulatorEnabled) {
            logger.info("Emulator Host: {}", emulatorHost);
            logger.info("Emulator Port: {}", emulatorPort);
            logger.info("Using Firebase Auth Emulator");
        } else {
            logger.info("Using actual Firebase services");
        }
        logger.info("=".repeat(80));
    }
    
    /**
     * Initialize Firebase App for Development (with Emulator)
     */
    @Bean
    @Profile("dev")
    public FirebaseApp devFirebaseApp() throws IOException {
        logger.info("Initializing Firebase App for development");
        
        if (FirebaseApp.getApps().isEmpty()) {
            FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder()
                .setProjectId(projectId);
            
            // Try to load credentials if available, otherwise use default
            try {
                if (credentialsPath.exists()) {
                    try (InputStream serviceAccount = credentialsPath.getInputStream()) {
                        GoogleCredentials credentials = GoogleCredentials.fromStream(serviceAccount);
                        optionsBuilder.setCredentials(credentials);
                        logger.info("Loaded Firebase credentials from: {}", credentialsPath.getFilename());
                    }
                } else {
                    logger.warn("Firebase credentials file not found, using default credentials");
                }
            } catch (Exception e) {
                logger.warn("Could not load Firebase credentials, using default: {}", e.getMessage());
            }
            
            FirebaseApp app = FirebaseApp.initializeApp(optionsBuilder.build());
            
            // Configure emulator if enabled
            if (emulatorEnabled) {
                String emulatorUrl = String.format("http://%s:%d", emulatorHost, emulatorPort);
                logger.info("Configuring Firebase Auth to use emulator at: {}", emulatorUrl);
                // Note: Firebase Admin SDK doesn't directly support emulator configuration
                // The emulator connection is handled by the client SDKs
                // For backend, we'll validate tokens from the emulator
            }
            
            logger.info("Firebase App initialized successfully for development");
            return app;
        }
        
        return FirebaseApp.getInstance();
    }
    
    /**
     * Initialize Firebase App for Production
     */
    @Bean
    @Profile("prod")
    public FirebaseApp prodFirebaseApp() throws IOException {
        logger.info("Initializing Firebase App for production");
        
        if (FirebaseApp.getApps().isEmpty()) {
            if (!credentialsPath.exists()) {
                throw new IllegalStateException(
                    "Firebase credentials file not found at: " + credentialsPath.getFilename() +
                    ". Please ensure FIREBASE_CREDENTIALS_PATH is set correctly."
                );
            }
            
            try (InputStream serviceAccount = credentialsPath.getInputStream()) {
                GoogleCredentials credentials = GoogleCredentials.fromStream(serviceAccount);
                
                FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(credentials)
                    .setProjectId(projectId)
                    .build();
                
                FirebaseApp app = FirebaseApp.initializeApp(options);
                logger.info("Firebase App initialized successfully for production");
                return app;
            }
        }
        
        return FirebaseApp.getInstance();
    }
    
    /**
     * Get FirebaseAuth instance
     */
    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        FirebaseAuth auth = FirebaseAuth.getInstance(firebaseApp);
        logger.info("FirebaseAuth instance created");
        return auth;
    }
}
