package com.userjourney.analytics.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class DataEncryptionServiceTest {

    private DataEncryptionService dataEncryptionService;

    @BeforeEach
    public void setUp() {
        dataEncryptionService = new DataEncryptionService();
        // Set a test encryption key
        ReflectionTestUtils.setField(dataEncryptionService, "encryptionKey", 
            "dGVzdEVuY3J5cHRpb25LZXlGb3JUZXN0aW5nUHVycG9zZXM=");
    }

    @Test
    public void testEncryptAndDecryptSensitiveData() {
        String originalData = "sensitive-user-data@example.com";
        
        // Encrypt the data
        String encryptedData = dataEncryptionService.encryptSensitiveData(originalData);
        
        // Verify encryption worked
        assertNotNull(encryptedData);
        assertNotEquals(originalData, encryptedData);
        
        // Decrypt the data
        String decryptedData = dataEncryptionService.decryptSensitiveData(encryptedData);
        
        // Verify decryption worked
        assertEquals(originalData, decryptedData);
    }

    @Test
    public void testEncryptNullAndEmptyData() {
        // Test null data
        String encryptedNull = dataEncryptionService.encryptSensitiveData(null);
        assertNull(encryptedNull);
        
        // Test empty data
        String encryptedEmpty = dataEncryptionService.encryptSensitiveData("");
        assertEquals("", encryptedEmpty);
    }

    @Test
    public void testAnonymizeData() {
        String originalData = "user123@example.com";
        
        // Anonymize the data
        String anonymizedData = dataEncryptionService.anonymizeData(originalData);
        
        // Verify anonymization worked
        assertNotNull(anonymizedData);
        assertNotEquals(originalData, anonymizedData);
        
        // Verify same input produces same anonymized output (deterministic)
        String anonymizedData2 = dataEncryptionService.anonymizeData(originalData);
        assertEquals(anonymizedData, anonymizedData2);
    }

    @Test
    public void testEncryptPII() {
        String piiData = "john.doe@example.com";
        
        String encryptedPII = dataEncryptionService.encryptPII(piiData);
        String decryptedPII = dataEncryptionService.decryptPII(encryptedPII);
        
        assertNotEquals(piiData, encryptedPII);
        assertEquals(piiData, decryptedPII);
    }

    @Test
    public void testGenerateNewEncryptionKey() {
        String newKey = dataEncryptionService.generateNewEncryptionKey();
        
        assertNotNull(newKey);
        assertTrue(newKey.length() > 0);
        
        // Verify it's a valid base64 encoded key
        assertDoesNotThrow(() -> java.util.Base64.getDecoder().decode(newKey));
    }

    @Test
    public void testEncryptionIsSecure() {
        String data = "test-data";
        
        // Encrypt the same data multiple times
        String encrypted1 = dataEncryptionService.encryptSensitiveData(data);
        String encrypted2 = dataEncryptionService.encryptSensitiveData(data);
        
        // Each encryption should produce different ciphertext (due to random IV)
        assertNotEquals(encrypted1, encrypted2);
        
        // But both should decrypt to the same original data
        assertEquals(data, dataEncryptionService.decryptSensitiveData(encrypted1));
        assertEquals(data, dataEncryptionService.decryptSensitiveData(encrypted2));
    }
}