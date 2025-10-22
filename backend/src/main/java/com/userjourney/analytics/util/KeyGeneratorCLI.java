package com.userjourney.analytics.util;

import java.io.IOException;
import java.util.Scanner;

/**
 * Command-line utility for generating secure encryption keys and JWT secrets.
 * 
 * Usage:
 *   mvn exec:java -Dexec.mainClass="com.userjourney.analytics.util.KeyGeneratorCLI"
 * 
 * Or compile and run:
 *   javac KeyGeneratorCLI.java
 *   java com.userjourney.analytics.util.KeyGeneratorCLI
 */
public class KeyGeneratorCLI {
    
    public static void main(String[] args) {
        SecureKeyStorage keyStorage = new SecureKeyStorage();
        Scanner scanner = new Scanner(System.in);
        
        System.out.println("=".repeat(80));
        System.out.println("SECURE KEY GENERATOR");
        System.out.println("User Journey Analytics - Encryption Key Management");
        System.out.println("=".repeat(80));
        System.out.println();
        
        while (true) {
            System.out.println("Select an option:");
            System.out.println("  1. Generate Encryption Key");
            System.out.println("  2. Generate JWT Secret");
            System.out.println("  3. Generate Both (Encryption Key + JWT Secret)");
            System.out.println("  4. Save Key to File");
            System.out.println("  5. Load Key from File");
            System.out.println("  6. Validate Key");
            System.out.println("  7. Show Setup Instructions");
            System.out.println("  8. Exit");
            System.out.println();
            System.out.print("Enter choice (1-8): ");
            
            String choice = scanner.nextLine().trim();
            System.out.println();
            
            try {
                switch (choice) {
                    case "1":
                        generateEncryptionKey(keyStorage);
                        break;
                    case "2":
                        generateJwtSecret(keyStorage);
                        break;
                    case "3":
                        generateBoth(keyStorage);
                        break;
                    case "4":
                        saveKeyToFile(keyStorage, scanner);
                        break;
                    case "5":
                        loadKeyFromFile(keyStorage, scanner);
                        break;
                    case "6":
                        validateKey(keyStorage, scanner);
                        break;
                    case "7":
                        SecureKeyStorage.printKeySetupInstructions();
                        break;
                    case "8":
                        System.out.println("Exiting...");
                        scanner.close();
                        return;
                    default:
                        System.out.println("Invalid choice. Please enter 1-8.");
                }
            } catch (Exception e) {
                System.err.println("Error: " + e.getMessage());
            }
            
            System.out.println();
        }
    }
    
    private static void generateEncryptionKey(SecureKeyStorage keyStorage) {
        String key = keyStorage.generateSecureKey();
        System.out.println("Generated Encryption Key (256-bit AES):");
        System.out.println("-".repeat(80));
        System.out.println(key);
        System.out.println("-".repeat(80));
        System.out.println();
        System.out.println("Add to your environment:");
        System.out.println("  export ENCRYPTION_KEY=\"" + key + "\"");
        System.out.println();
        System.out.println("Or add to application.yml:");
        System.out.println("  app:");
        System.out.println("    encryption:");
        System.out.println("      key: " + key);
    }
    
    private static void generateJwtSecret(SecureKeyStorage keyStorage) {
        String secret = keyStorage.generateJwtSecret();
        System.out.println("Generated JWT Secret (256-bit):");
        System.out.println("-".repeat(80));
        System.out.println(secret);
        System.out.println("-".repeat(80));
        System.out.println();
        System.out.println("Add to your environment:");
        System.out.println("  export JWT_SECRET=\"" + secret + "\"");
        System.out.println();
        System.out.println("Or add to application.yml:");
        System.out.println("  app:");
        System.out.println("    jwt:");
        System.out.println("      secret: " + secret);
    }
    
    private static void generateBoth(SecureKeyStorage keyStorage) {
        String encryptionKey = keyStorage.generateSecureKey();
        String jwtSecret = keyStorage.generateJwtSecret();
        
        System.out.println("Generated Keys:");
        System.out.println("=".repeat(80));
        System.out.println();
        System.out.println("Encryption Key:");
        System.out.println(encryptionKey);
        System.out.println();
        System.out.println("JWT Secret:");
        System.out.println(jwtSecret);
        System.out.println();
        System.out.println("=".repeat(80));
        System.out.println();
        System.out.println("Add to your environment:");
        System.out.println("  export ENCRYPTION_KEY=\"" + encryptionKey + "\"");
        System.out.println("  export JWT_SECRET=\"" + jwtSecret + "\"");
        System.out.println();
        System.out.println("Or add to application.yml:");
        System.out.println("  app:");
        System.out.println("    encryption:");
        System.out.println("      key: " + encryptionKey);
        System.out.println("    jwt:");
        System.out.println("      secret: " + jwtSecret);
    }
    
    private static void saveKeyToFile(SecureKeyStorage keyStorage, Scanner scanner) throws IOException {
        System.out.print("Enter the key to save: ");
        String key = scanner.nextLine().trim();
        
        System.out.print("Enter file path (e.g., /secure/path/encryption.key): ");
        String filePath = scanner.nextLine().trim();
        
        keyStorage.validateKey(key);
        keyStorage.saveKeyToFile(key, filePath);
        
        System.out.println("Key saved successfully to: " + filePath);
        System.out.println("File permissions set to 0600 (owner read/write only)");
    }
    
    private static void loadKeyFromFile(SecureKeyStorage keyStorage, Scanner scanner) throws IOException {
        System.out.print("Enter file path: ");
        String filePath = scanner.nextLine().trim();
        
        String key = keyStorage.loadKeyFromFile(filePath);
        
        System.out.println("Key loaded successfully:");
        System.out.println("-".repeat(80));
        System.out.println(key);
        System.out.println("-".repeat(80));
    }
    
    private static void validateKey(SecureKeyStorage keyStorage, Scanner scanner) {
        System.out.print("Enter key to validate: ");
        String key = scanner.nextLine().trim();
        
        try {
            keyStorage.validateKey(key);
            System.out.println("✓ Key is valid and meets security requirements (256-bit)");
        } catch (IllegalArgumentException e) {
            System.err.println("✗ Key validation failed: " + e.getMessage());
        }
    }
}
