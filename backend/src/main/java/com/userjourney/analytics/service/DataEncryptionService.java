package com.userjourney.analytics.service;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.Security;
import java.util.Base64;

/**
 * Service for encrypting and decrypting sensitive data using AES-GCM encryption.
 * Uses environment-specific encryption keys for enhanced security.
 * 
 * Security Features:
 * - AES-256-GCM encryption
 * - Environment-specific keys (dev vs prod)
 * - Secure key storage validation
 * - JWT secret encryption support
 */
@Service
public class DataEncryptionService {

    private static final Logger logger = LoggerFactory.getLogger(DataEncryptionService.class);
    
    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 16;
    private static final int MINIMUM_KEY_LENGTH = 32; // 256 bits in base64

    @Value("${app.encryption.key}")
    private String encryptionKey;
    
    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    private final SecureRandom secureRandom;

    public DataEncryptionService() {
        Security.addProvider(new BouncyCastleProvider());
        this.secureRandom = new SecureRandom();
    }
    
    /**
     * Validates encryption key on startup to ensure secure configuration
     */
    @PostConstruct
    public void validateEncryptionKey() {
        if (encryptionKey == null || encryptionKey.isEmpty()) {
            String errorMsg = "CRITICAL: Encryption key is not configured. Set app.encryption.key in application.yml or ENCRYPTION_KEY environment variable.";
            logger.error(errorMsg);
            throw new IllegalStateException(errorMsg);
        }
        
        // Validate key length
        try {
            byte[] decodedKey = Base64.getDecoder().decode(encryptionKey);
            if (decodedKey.length < MINIMUM_KEY_LENGTH) {
                String errorMsg = String.format(
                    "CRITICAL: Encryption key is too short (%d bytes). Minimum required: %d bytes (256 bits). " +
                    "Generate a secure key using: openssl rand -base64 32",
                    decodedKey.length, MINIMUM_KEY_LENGTH
                );
                logger.error(errorMsg);
                throw new IllegalStateException(errorMsg);
            }
            
            // Warn if using default/weak keys in production
            if ("prod".equalsIgnoreCase(activeProfile)) {
                String keyPreview = encryptionKey.substring(0, Math.min(10, encryptionKey.length()));
                if (encryptionKey.contains("default") || encryptionKey.contains("Default") || 
                    encryptionKey.contains("example") || encryptionKey.contains("test")) {
                    String errorMsg = "CRITICAL: Using a default/test encryption key in PRODUCTION environment! " +
                                    "This is a severe security risk. Generate a secure key immediately.";
                    logger.error(errorMsg);
                    throw new IllegalStateException(errorMsg);
                }
                logger.info("Encryption key validated successfully for PRODUCTION environment (key preview: {}...)", keyPreview);
            } else {
                logger.info("Encryption key validated successfully for {} environment", activeProfile);
            }
            
        } catch (IllegalArgumentException e) {
            String errorMsg = "CRITICAL: Encryption key is not valid base64. Generate a secure key using: openssl rand -base64 32";
            logger.error(errorMsg, e);
            throw new IllegalStateException(errorMsg, e);
        }
    }

    /**
     * Encrypts sensitive data using AES-GCM encryption
     */
    public String encryptSensitiveData(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return plainText;
        }

        try {
            SecretKey secretKey = getSecretKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);
            
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);
            
            byte[] encryptedData = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            
            // Combine IV and encrypted data
            byte[] encryptedWithIv = new byte[iv.length + encryptedData.length];
            System.arraycopy(iv, 0, encryptedWithIv, 0, iv.length);
            System.arraycopy(encryptedData, 0, encryptedWithIv, iv.length, encryptedData.length);
            
            return Base64.getEncoder().encodeToString(encryptedWithIv);
            
        } catch (Exception e) {
            logger.error("Error encrypting data", e);
            throw new RuntimeException("Failed to encrypt sensitive data", e);
        }
    }

    /**
     * Decrypts sensitive data using AES-GCM decryption
     */
    public String decryptSensitiveData(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) {
            return encryptedText;
        }

        try {
            SecretKey secretKey = getSecretKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            
            byte[] encryptedWithIv = Base64.getDecoder().decode(encryptedText);
            
            // Extract IV and encrypted data
            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] encryptedData = new byte[encryptedWithIv.length - GCM_IV_LENGTH];
            
            System.arraycopy(encryptedWithIv, 0, iv, 0, iv.length);
            System.arraycopy(encryptedWithIv, iv.length, encryptedData, 0, encryptedData.length);
            
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);
            
            byte[] decryptedData = cipher.doFinal(encryptedData);
            return new String(decryptedData, StandardCharsets.UTF_8);
            
        } catch (Exception e) {
            logger.error("Error decrypting data", e);
            throw new RuntimeException("Failed to decrypt sensitive data", e);
        }
    }

    /**
     * Generates a hash for data anonymization
     */
    public String anonymizeData(String data) {
        if (data == null || data.isEmpty()) {
            return data;
        }
        
        try {
            // Use SHA-256 with salt for anonymization
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            String saltedData = data + encryptionKey; // Use encryption key as salt
            byte[] hash = digest.digest(saltedData.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            logger.error("Error anonymizing data", e);
            throw new RuntimeException("Failed to anonymize data", e);
        }
    }

    /**
     * Generates a new encryption key
     */
    public String generateNewEncryptionKey() {
        try {
            KeyGenerator keyGenerator = KeyGenerator.getInstance(ALGORITHM);
            keyGenerator.init(256);
            SecretKey secretKey = keyGenerator.generateKey();
            return Base64.getEncoder().encodeToString(secretKey.getEncoded());
        } catch (NoSuchAlgorithmException e) {
            logger.error("Error generating encryption key", e);
            throw new RuntimeException("Failed to generate encryption key", e);
        }
    }

    private SecretKey getSecretKey() {
        byte[] decodedKey = Base64.getDecoder().decode(encryptionKey);
        return new SecretKeySpec(decodedKey, ALGORITHM);
    }

    /**
     * Encrypts PII (Personally Identifiable Information)
     */
    public String encryptPII(String pii) {
        return encryptSensitiveData(pii);
    }

    /**
     * Decrypts PII (Personally Identifiable Information)
     */
    public String decryptPII(String encryptedPii) {
        return decryptSensitiveData(encryptedPii);
    }
    
    /**
     * Encrypts JWT secrets for secure storage
     * This can be used to encrypt JWT secrets before storing them in configuration
     */
    public String encryptJwtSecret(String jwtSecret) {
        if (jwtSecret == null || jwtSecret.isEmpty()) {
            throw new IllegalArgumentException("JWT secret cannot be null or empty");
        }
        
        logger.debug("Encrypting JWT secret for secure storage");
        return encryptSensitiveData(jwtSecret);
    }
    
    /**
     * Decrypts JWT secrets from secure storage
     * This can be used to decrypt JWT secrets when loading from configuration
     */
    public String decryptJwtSecret(String encryptedJwtSecret) {
        if (encryptedJwtSecret == null || encryptedJwtSecret.isEmpty()) {
            throw new IllegalArgumentException("Encrypted JWT secret cannot be null or empty");
        }
        
        logger.debug("Decrypting JWT secret from secure storage");
        return decryptSensitiveData(encryptedJwtSecret);
    }
    
    /**
     * Validates that a key meets minimum security requirements
     * 
     * @param key The key to validate (base64 encoded)
     * @param keyName The name of the key (for error messages)
     * @throws IllegalArgumentException if key doesn't meet requirements
     */
    public void validateKeyStrength(String key, String keyName) {
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException(keyName + " cannot be null or empty");
        }
        
        try {
            byte[] decodedKey = Base64.getDecoder().decode(key);
            if (decodedKey.length < MINIMUM_KEY_LENGTH) {
                throw new IllegalArgumentException(
                    String.format("%s is too short (%d bytes). Minimum required: %d bytes (256 bits)",
                        keyName, decodedKey.length, MINIMUM_KEY_LENGTH)
                );
            }
        } catch (IllegalArgumentException e) {
            if (e.getMessage().contains("Illegal base64")) {
                throw new IllegalArgumentException(keyName + " is not valid base64 encoding", e);
            }
            throw e;
        }
    }
    
    /**
     * Gets the active encryption profile (dev or prod)
     * Useful for logging and auditing
     */
    public String getActiveProfile() {
        return activeProfile;
    }
    
    /**
     * Checks if running in production mode
     * Used for additional security validations
     */
    public boolean isProductionMode() {
        return "prod".equalsIgnoreCase(activeProfile);
    }
}