package com.userjourney.analytics.service;

import com.userjourney.analytics.model.Document;
import com.userjourney.analytics.dto.DocumentUploadRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DocumentService {
    
    private static final Logger logger = LoggerFactory.getLogger(DocumentService.class);
    
    // File size limit: 10MB
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;
    
    // Allowed file types
    private static final Set<String> ALLOWED_FILE_TYPES = Set.of(
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    
    // Allowed file extensions
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
        ".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".gif", ".xls", ".xlsx"
    );
    
    // In-memory storage for demo purposes - in production, this would use DynamoDB and S3
    private final Map<String, Document> documentStorage = new HashMap<>();
    private final Map<String, List<String>> userDocuments = new HashMap<>();
    
    // Local file storage directory for demo
    private final String uploadDirectory = "uploads/documents/";
    
    public DocumentService() {
        // Create upload directory if it doesn't exist
        try {
            Path uploadPath = Paths.get(uploadDirectory);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
                logger.info("Created upload directory: {}", uploadDirectory);
            }
        } catch (IOException e) {
            logger.error("Failed to create upload directory: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Upload document
     */
    public Document uploadDocument(String userId, MultipartFile file, DocumentUploadRequest request) throws IOException {
        logger.info("Uploading document for user: {}, fileName: {}, size: {}", 
                   userId, file.getOriginalFilename(), file.getSize());
        
        // Validate file
        validateFile(file);
        
        // Create document record
        String documentId = UUID.randomUUID().toString();
        Document document = new Document(documentId, userId, file.getOriginalFilename(), 
                                       file.getSize(), file.getContentType());
        
        // Set file extension
        String originalFileName = file.getOriginalFilename();
        if (originalFileName != null && originalFileName.contains(".")) {
            String extension = originalFileName.substring(originalFileName.lastIndexOf("."));
            document.setFileExtension(extension.toLowerCase());
        }
        
        // Set additional properties from request
        if (request != null) {
            document.setCategory(request.getCategory());
            document.setDescription(request.getDescription());
            document.setTags(request.getTags());
            document.setIsEncrypted(request.getIsEncrypted());
        }
        
        // Generate unique file name for storage
        String storedFileName = documentId + "_" + System.currentTimeMillis() + 
                               (document.getFileExtension() != null ? document.getFileExtension() : "");
        document.setFileName(storedFileName);
        
        try {
            // Save file to local storage (in production, this would be S3)
            Path filePath = Paths.get(uploadDirectory, storedFileName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            
            // Calculate file checksum
            String checksum = calculateFileChecksum(file.getBytes());
            document.setChecksum(checksum);
            
            // Set storage information
            document.setS3Key(storedFileName);
            document.setS3Bucket("local-storage");
            document.setDownloadUrl("/api/documents/" + documentId + "/download");
            
            // Set metadata
            Document.DocumentMetadata metadata = new Document.DocumentMetadata();
            metadata.setContentType(file.getContentType());
            metadata.setCreatedDate(Instant.now());
            metadata.setVersion("1.0");
            document.setMetadata(metadata);
            
            // Update status to completed
            document.setStatus(Document.DocumentStatus.COMPLETED);
            
            // Store document
            documentStorage.put(documentId, document);
            userDocuments.computeIfAbsent(userId, k -> new ArrayList<>()).add(documentId);
            
            logger.info("Successfully uploaded document: {} for user: {}", documentId, userId);
            return document;
            
        } catch (Exception e) {
            logger.error("Failed to upload document for user {}: {}", userId, e.getMessage(), e);
            document.setStatus(Document.DocumentStatus.FAILED);
            throw new RuntimeException("Failed to upload document: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get user documents
     */
    public List<Document> getUserDocuments(String userId, int page, int size, String category) {
        logger.info("Fetching documents for user: {}, page: {}, size: {}, category: {}", 
                   userId, page, size, category);
        
        List<String> userDocIds = userDocuments.getOrDefault(userId, new ArrayList<>());
        
        List<Document> documents = userDocIds.stream()
            .map(documentStorage::get)
            .filter(Objects::nonNull)
            .filter(doc -> doc.getStatus() != Document.DocumentStatus.DELETED)
            .collect(Collectors.toList());
        
        // Filter by category if specified
        if (category != null && !category.isEmpty()) {
            documents = documents.stream()
                .filter(doc -> category.equals(doc.getCategory()))
                .collect(Collectors.toList());
        }
        
        // Sort by upload date (newest first)
        documents.sort((d1, d2) -> d2.getUploadDate().compareTo(d1.getUploadDate()));
        
        // Apply pagination
        int start = page * size;
        int end = Math.min(start + size, documents.size());
        
        if (start >= documents.size()) {
            return new ArrayList<>();
        }
        
        return documents.subList(start, end);
    }
    
    /**
     * Get document by ID
     */
    public Document getDocumentById(String documentId) {
        logger.info("Fetching document by ID: {}", documentId);
        
        Document document = documentStorage.get(documentId);
        if (document == null) {
            throw new RuntimeException("Document not found with ID: " + documentId);
        }
        
        if (document.getStatus() == Document.DocumentStatus.DELETED) {
            throw new RuntimeException("Document has been deleted: " + documentId);
        }
        
        // Update last accessed date
        document.setLastAccessedDate(Instant.now());
        
        return document;
    }
    
    /**
     * Delete document
     */
    public void deleteDocument(String userId, String documentId) {
        logger.info("Deleting document: {} for user: {}", documentId, userId);
        
        Document document = getDocumentById(documentId);
        
        // Verify user owns the document
        if (!userId.equals(document.getUserId())) {
            throw new RuntimeException("User not authorized to delete this document");
        }
        
        try {
            // Delete physical file
            if (document.getS3Key() != null) {
                Path filePath = Paths.get(uploadDirectory, document.getS3Key());
                if (Files.exists(filePath)) {
                    Files.delete(filePath);
                    logger.info("Deleted physical file: {}", document.getS3Key());
                }
            }
            
            // Mark document as deleted
            document.setStatus(Document.DocumentStatus.DELETED);
            
            // Remove from user's document list
            List<String> userDocIds = userDocuments.get(userId);
            if (userDocIds != null) {
                userDocIds.remove(documentId);
            }
            
            logger.info("Successfully deleted document: {}", documentId);
            
        } catch (IOException e) {
            logger.error("Failed to delete physical file for document {}: {}", documentId, e.getMessage(), e);
            throw new RuntimeException("Failed to delete document file: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get document file for download
     */
    public byte[] getDocumentFile(String documentId) throws IOException {
        logger.info("Retrieving file for document: {}", documentId);
        
        Document document = getDocumentById(documentId);
        
        if (document.getS3Key() == null) {
            throw new RuntimeException("Document file not found");
        }
        
        Path filePath = Paths.get(uploadDirectory, document.getS3Key());
        if (!Files.exists(filePath)) {
            throw new RuntimeException("Document file does not exist on storage");
        }
        
        // Update last accessed date
        document.setLastAccessedDate(Instant.now());
        
        return Files.readAllBytes(filePath);
    }
    
    /**
     * Get document categories
     */
    public List<String> getDocumentCategories() {
        logger.info("Fetching document categories");
        
        return documentStorage.values().stream()
            .filter(doc -> doc.getStatus() != Document.DocumentStatus.DELETED)
            .map(Document::getCategory)
            .filter(Objects::nonNull)
            .distinct()
            .sorted()
            .collect(Collectors.toList());
    }
    
    /**
     * Get document statistics
     */
    public Map<String, Object> getDocumentStatistics() {
        logger.info("Fetching document statistics");
        
        List<Document> allDocuments = documentStorage.values().stream()
            .filter(doc -> doc.getStatus() != Document.DocumentStatus.DELETED)
            .collect(Collectors.toList());
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalDocuments", allDocuments.size());
        stats.put("totalUsers", userDocuments.size());
        
        if (!allDocuments.isEmpty()) {
            // Total storage used
            long totalSize = allDocuments.stream().mapToLong(Document::getFileSize).sum();
            stats.put("totalStorageBytes", totalSize);
            stats.put("totalStorageMB", totalSize / (1024.0 * 1024.0));
            
            // Average file size
            double avgSize = allDocuments.stream().mapToLong(Document::getFileSize).average().orElse(0.0);
            stats.put("averageFileSizeMB", avgSize / (1024.0 * 1024.0));
            
            // File type distribution
            Map<String, Long> fileTypeDistribution = allDocuments.stream()
                .collect(Collectors.groupingBy(
                    doc -> doc.getFileType() != null ? doc.getFileType() : "unknown",
                    Collectors.counting()
                ));
            stats.put("fileTypeDistribution", fileTypeDistribution);
            
            // Category distribution
            Map<String, Long> categoryDistribution = allDocuments.stream()
                .collect(Collectors.groupingBy(
                    doc -> doc.getCategory() != null ? doc.getCategory() : "uncategorized",
                    Collectors.counting()
                ));
            stats.put("categoryDistribution", categoryDistribution);
        }
        
        return stats;
    }
    
    /**
     * Validate uploaded file
     */
    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum limit of " + (MAX_FILE_SIZE / (1024 * 1024)) + "MB");
        }
        
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_FILE_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("File type not allowed: " + contentType);
        }
        
        String originalFileName = file.getOriginalFilename();
        if (originalFileName != null && originalFileName.contains(".")) {
            String extension = originalFileName.substring(originalFileName.lastIndexOf(".")).toLowerCase();
            if (!ALLOWED_EXTENSIONS.contains(extension)) {
                throw new IllegalArgumentException("File extension not allowed: " + extension);
            }
        }
        
        // Additional security checks
        if (originalFileName != null && (originalFileName.contains("..") || originalFileName.contains("/"))) {
            throw new IllegalArgumentException("Invalid file name");
        }
    }
    
    /**
     * Calculate file checksum
     */
    private String calculateFileChecksum(byte[] fileBytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(fileBytes);
            StringBuilder hexString = new StringBuilder();
            
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
            
        } catch (NoSuchAlgorithmException e) {
            logger.error("Failed to calculate file checksum: {}", e.getMessage(), e);
            return null;
        }
    }
}