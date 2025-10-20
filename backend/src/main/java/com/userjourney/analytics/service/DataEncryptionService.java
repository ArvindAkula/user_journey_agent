package com.userjourney.analytics.service;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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

@Service
public class DataEncryptionService {

    private static final Logger logger = LoggerFactory.getLogger(DataEncryptionService.class);
    
    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 16;

    @Value("${app.encryption.key:defaultEncryptionKeyThatShouldBeChangedInProduction}")
    private String encryptionKey;

    private final SecureRandom secureRandom;

    public DataEncryptionService() {
        Security.addProvider(new BouncyCastleProvider());
        this.secureRandom = new SecureRandom();
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
}