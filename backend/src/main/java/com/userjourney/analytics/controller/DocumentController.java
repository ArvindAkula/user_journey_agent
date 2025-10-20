package com.userjourney.analytics.controller;

import com.userjourney.analytics.model.Document;
import com.userjourney.analytics.dto.DocumentUploadRequest;
import com.userjourney.analytics.service.DocumentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*", maxAge = 3600)
public class DocumentController {
    
    private static final Logger logger = LoggerFactory.getLogger(DocumentController.class);
    
    @Autowired
    private DocumentService documentService;
    
    /**
     * Upload document
     * POST /api/documents/upload
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("userId") String userId,
            @RequestParam(value = "category", required = false, defaultValue = "general") String category,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "tags", required = false) String tags) {
        
        try {
            logger.info("Uploading document for user: {}, fileName: {}", userId, file.getOriginalFilename());
            
            // Create upload request
            DocumentUploadRequest request = new DocumentUploadRequest(
                userId, file.getOriginalFilename(), file.getSize(), file.getContentType()
            );
            request.setCategory(category);
            request.setDescription(description);
            request.setTags(tags);
            
            Document document = documentService.uploadDocument(userId, file, request);
            
            Map<String, Object> response = Map.of(
                "documentId", document.getId(),
                "fileName", document.getOriginalFileName(),
                "fileSize", document.getFileSize(),
                "status", document.getStatus().toString(),
                "uploadDate", document.getUploadDate().toString(),
                "downloadUrl", document.getDownloadUrl(),
                "message", "Document uploaded successfully"
            );
            
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid file upload request: {}", e.getMessage());
            return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage()));
                
        } catch (IOException e) {
            logger.error("Error uploading document for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to upload document: " + e.getMessage()));
                
        } catch (Exception e) {
            logger.error("Unexpected error uploading document for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }
    
    /**
     * Get user documents
     * GET /api/documents/{userId}
     */
    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getUserDocuments(
            @PathVariable String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String category) {
        
        try {
            logger.info("Fetching documents for user: {}", userId);
            
            List<Document> documents = documentService.getUserDocuments(userId, page, size, category);
            
            Map<String, Object> response = Map.of(
                "documents", documents,
                "page", page,
                "size", size,
                "totalElements", documents.size(),
                "hasNext", documents.size() == size // Simple check for demo
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error fetching documents for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to fetch documents: " + e.getMessage()));
        }
    }
    
    /**
     * Get document by ID
     * GET /api/documents/document/{id}
     */
    @GetMapping("/document/{id}")
    public ResponseEntity<Document> getDocumentById(@PathVariable String id) {
        try {
            logger.info("Fetching document by ID: {}", id);
            
            Document document = documentService.getDocumentById(id);
            
            return ResponseEntity.ok(document);
            
        } catch (RuntimeException e) {
            logger.error("Document not found: {}", id);
            return ResponseEntity.notFound().build();
            
        } catch (Exception e) {
            logger.error("Error fetching document {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Download document
     * GET /api/documents/{id}/download
     */
    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable String id) {
        try {
            logger.info("Downloading document: {}", id);
            
            Document document = documentService.getDocumentById(id);
            byte[] fileContent = documentService.getDocumentFile(id);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(document.getFileType()));
            headers.setContentDispositionFormData("attachment", document.getOriginalFileName());
            headers.setContentLength(fileContent.length);
            
            return ResponseEntity.ok()
                .headers(headers)
                .body(fileContent);
                
        } catch (RuntimeException e) {
            logger.error("Document not found for download: {}", id);
            return ResponseEntity.notFound().build();
            
        } catch (IOException e) {
            logger.error("Error reading document file {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            
        } catch (Exception e) {
            logger.error("Error downloading document {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Delete document
     * DELETE /api/documents/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteDocument(
            @PathVariable String id,
            @RequestParam String userId) {
        
        try {
            logger.info("Deleting document: {} for user: {}", id, userId);
            
            documentService.deleteDocument(userId, id);
            
            return ResponseEntity.ok(Map.of(
                "message", "Document deleted successfully",
                "documentId", id
            ));
            
        } catch (RuntimeException e) {
            logger.error("Error deleting document {}: {}", id, e.getMessage());
            return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage()));
                
        } catch (Exception e) {
            logger.error("Error deleting document {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to delete document"));
        }
    }
    
    /**
     * Get document categories
     * GET /api/documents/categories
     */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> getDocumentCategories() {
        try {
            logger.info("Fetching document categories");
            
            List<String> categories = documentService.getDocumentCategories();
            
            return ResponseEntity.ok(categories);
            
        } catch (Exception e) {
            logger.error("Error fetching document categories: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get document statistics
     * GET /api/documents/statistics
     */
    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getDocumentStatistics() {
        try {
            logger.info("Fetching document statistics");
            
            Map<String, Object> statistics = documentService.getDocumentStatistics();
            
            return ResponseEntity.ok(statistics);
            
        } catch (Exception e) {
            logger.error("Error fetching document statistics: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Validate file before upload
     * POST /api/documents/validate
     */
    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateFile(
            @RequestParam("file") MultipartFile file) {
        
        try {
            logger.info("Validating file: {}", file.getOriginalFilename());
            
            // Validate file properties
            if (file.isEmpty()) {
                throw new IllegalArgumentException("File is empty");
            }
            
            if (file.getSize() > 10 * 1024 * 1024) { // 10MB limit
                throw new IllegalArgumentException("File size exceeds 10MB limit");
            }
            
            return ResponseEntity.ok(Map.of(
                "valid", true,
                "message", "File is valid for upload",
                "fileName", file.getOriginalFilename(),
                "fileSize", file.getSize(),
                "fileType", file.getContentType()
            ));
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid file: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "valid", false,
                "error", e.getMessage()
            ));
            
        } catch (Exception e) {
            logger.error("Error validating file: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "valid", false,
                "error", "Validation failed"
            ));
        }
    }
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "timestamp", String.valueOf(System.currentTimeMillis()),
            "service", "document-upload"
        ));
    }
}