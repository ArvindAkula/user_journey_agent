package com.userjourney.analytics.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermission;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;

/**
 * Utility class for secure key storage and management.
 * Provides methods for generating, storing, and loading encryption keys securely.
 * 
 * Security Features:
 * - Secure random key generation
 * - File permission validation (Unix/Linux)
 * - Key rotation support
 * - Audit logging
 */
@Component
public class SecureKeyStorage {
    
    private static final Logger logger = LoggerFactory.getLogger(SecureKeyStorage.class);
    private static final int AES_256_KEY_SIZE = 32; // 256 bits
    private final SecureRandom secureRandom;
    
    public SecureKeyStorage() {
        this.secureRandom = new SecureRandom();
    }
    
    /**
     * Generates a cryptographically secure random key for AES-256 encryption
     * 
     * @return Base64-encoded 256-bit key
     */
    public String generateSecureKey() {
        byte[] key = new byte[AES_256_KEY_SIZE];
        secureRandom.nextBytes(key);
        String encodedKey = Base64.getEncoder().encodeToString(key);
        
        logger.info("Generated new secure 256-bit encryption key");
        return encodedKey;
    }
    
    /**
     * Generates a secure JWT secret
     * 
     * @return Base64-encoded 256-bit secret
     */
    public String generateJwtSecret() {
        return generateSecureKey();
    }
    
    /**
     * Saves a key to a file with secure permissions (Unix/Linux only)
     * 
     * @param key The key to save (base64 encoded)
     * @param filePath Path where to save the key
     * @throws IOException if file operations fail
     */
    public void saveKeyToFile(String key, String filePath) throws IOException {
        Path path = Paths.get(filePath);
        
        // Write key to file
        Files.writeString(path, key);
        
        // Set restrictive permissions (owner read/write only) on Unix/Linux
        try {
            Set<PosixFilePermission> permissions = new HashSet<>();
            permissions.add(PosixFilePermission.OWNER_READ);
            permissions.add(PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(path, permissions);
            
            logger.info("Saved encryption key to {} with secure permissions (0600)", filePath);
        } catch (UnsupportedOperationException e) {
            // Windows doesn't support POSIX permissions
            logger.warn("Unable to set POSIX permissions on {}. Ensure file permissions are restricted manually.", filePath);
        }
    }
    
    /**
     * Loads a key from a file and validates its permissions
     * 
     * @param filePath Path to the key file
     * @return The key (base64 encoded)
     * @throws IOException if file operations fail
     * @throws SecurityException if file permissions are too permissive
     */
    public String loadKeyFromFile(String filePath) throws IOException {
        Path path = Paths.get(filePath);
        
        if (!Files.exists(path)) {
            throw new IOException("Key file not found: " + filePath);
        }
        
        // Validate file permissions on Unix/Linux
        try {
            Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(path);
            
            // Check if file is readable by group or others
            if (permissions.contains(PosixFilePermission.GROUP_READ) ||
                permissions.contains(PosixFilePermission.GROUP_WRITE) ||
                permissions.contains(PosixFilePermission.OTHERS_READ) ||
                permissions.contains(PosixFilePermission.OTHERS_WRITE)) {
                
                String errorMsg = String.format(
                    "SECURITY WARNING: Key file %s has overly permissive permissions. " +
                    "File should only be readable by owner (chmod 600). Current permissions: %s",
                    filePath, permissions
                );
                logger.error(errorMsg);
                throw new SecurityException(errorMsg);
            }
        } catch (UnsupportedOperationException e) {
            // Windows doesn't support POSIX permissions
            logger.warn("Unable to validate POSIX permissions on {}. Ensure file permissions are restricted.", filePath);
        }
        
        String key = Files.readString(path).trim();
        logger.info("Loaded encryption key from {}", filePath);
        
        return key;
    }
    
    /**
     * Validates that a key meets minimum security requirements
     * 
     * @param key The key to validate (base64 encoded)
     * @throws IllegalArgumentException if key doesn't meet requirements
     */
    public void validateKey(String key) {
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("Key cannot be null or empty");
        }
        
        try {
            byte[] decodedKey = Base64.getDecoder().decode(key);
            if (decodedKey.length < AES_256_KEY_SIZE) {
                throw new IllegalArgumentException(
                    String.format("Key is too short (%d bytes). Minimum required: %d bytes (256 bits)",
                        decodedKey.length, AES_256_KEY_SIZE)
                );
            }
        } catch (IllegalArgumentException e) {
            if (e.getMessage().contains("Illegal base64")) {
                throw new IllegalArgumentException("Key is not valid base64 encoding", e);
            }
            throw e;
        }
    }
    
    /**
     * Rotates an encryption key by generating a new one
     * Note: This doesn't handle re-encrypting existing data
     * 
     * @param oldKeyFilePath Path to the old key file
     * @param newKeyFilePath Path where to save the new key
     * @return The new key (base64 encoded)
     * @throws IOException if file operations fail
     */
    public String rotateKey(String oldKeyFilePath, String newKeyFilePath) throws IOException {
        // Load old key to verify it exists and is valid
        loadKeyFromFile(oldKeyFilePath);
        logger.info("Verified old key from {} for rotation", oldKeyFilePath);
        
        // Generate new key
        String newKey = generateSecureKey();
        
        // Save new key
        saveKeyToFile(newKey, newKeyFilePath);
        
        logger.warn("Key rotation completed. Old key: {}, New key: {}. " +
                   "IMPORTANT: Re-encrypt all data encrypted with the old key!",
                   oldKeyFilePath, newKeyFilePath);
        
        return newKey;
    }
    
    /**
     * Generates a printable command for creating a secure key
     * Useful for documentation and setup instructions
     * 
     * @return Shell command to generate a secure key
     */
    public static String getKeyGenerationCommand() {
        return "openssl rand -base64 32";
    }
    
    /**
     * Prints instructions for generating and storing secure keys
     */
    public static void printKeySetupInstructions() {
        System.out.println("=".repeat(80));
        System.out.println("SECURE KEY SETUP INSTRUCTIONS");
        System.out.println("=".repeat(80));
        System.out.println();
        System.out.println("1. Generate a secure encryption key:");
        System.out.println("   " + getKeyGenerationCommand());
        System.out.println();
        System.out.println("2. Set the key as an environment variable:");
        System.out.println("   export ENCRYPTION_KEY=$(openssl rand -base64 32)");
        System.out.println();
        System.out.println("3. Or save to application.yml:");
        System.out.println("   app:");
        System.out.println("     encryption:");
        System.out.println("       key: <paste-generated-key-here>");
        System.out.println();
        System.out.println("4. For production, use AWS Secrets Manager or similar:");
        System.out.println("   - Store key in AWS Secrets Manager");
        System.out.println("   - Reference in application: ${aws.secretsmanager:encryption-key}");
        System.out.println();
        System.out.println("IMPORTANT: Use different keys for development and production!");
        System.out.println("=".repeat(80));
    }
}
