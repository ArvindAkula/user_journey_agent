package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

public class Document {
    
    @NotBlank(message = "Document ID is required")
    @JsonProperty("id")
    private String id;
    
    @NotBlank(message = "User ID is required")
    @JsonProperty("userId")
    private String userId;
    
    @NotBlank(message = "File name is required")
    @JsonProperty("fileName")
    private String fileName;
    
    @JsonProperty("originalFileName")
    private String originalFileName;
    
    @NotNull(message = "File size is required")
    @JsonProperty("fileSize")
    private Long fileSize; // Size in bytes
    
    @NotBlank(message = "File type is required")
    @JsonProperty("fileType")
    private String fileType; // MIME type
    
    @JsonProperty("fileExtension")
    private String fileExtension;
    
    @NotNull(message = "Upload date is required")
    @JsonProperty("uploadDate")
    private Instant uploadDate;
    
    @JsonProperty("lastAccessedDate")
    private Instant lastAccessedDate;
    
    @JsonProperty("status")
    private DocumentStatus status = DocumentStatus.UPLOADING;
    
    @JsonProperty("downloadUrl")
    private String downloadUrl;
    
    @JsonProperty("s3Key")
    private String s3Key; // S3 object key for storage
    
    @JsonProperty("s3Bucket")
    private String s3Bucket;
    
    @JsonProperty("checksum")
    private String checksum; // File checksum for integrity
    
    @JsonProperty("isEncrypted")
    private Boolean isEncrypted = false;
    
    @JsonProperty("tags")
    private String tags; // User-defined tags
    
    @JsonProperty("description")
    private String description;
    
    @JsonProperty("category")
    private String category; // "financial", "personal", "tax", "insurance", etc.
    
    @JsonProperty("metadata")
    private DocumentMetadata metadata;
    
    // Constructors
    public Document() {}
    
    public Document(String id, String userId, String fileName, Long fileSize, String fileType) {
        this.id = id;
        this.userId = userId;
        this.fileName = fileName;
        this.originalFileName = fileName;
        this.fileSize = fileSize;
        this.fileType = fileType;
        this.uploadDate = Instant.now();
        this.status = DocumentStatus.UPLOADING;
        this.isEncrypted = false;
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    
    public String getOriginalFileName() { return originalFileName; }
    public void setOriginalFileName(String originalFileName) { this.originalFileName = originalFileName; }
    
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    
    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }
    
    public String getFileExtension() { return fileExtension; }
    public void setFileExtension(String fileExtension) { this.fileExtension = fileExtension; }
    
    public Instant getUploadDate() { return uploadDate; }
    public void setUploadDate(Instant uploadDate) { this.uploadDate = uploadDate; }
    
    public Instant getLastAccessedDate() { return lastAccessedDate; }
    public void setLastAccessedDate(Instant lastAccessedDate) { this.lastAccessedDate = lastAccessedDate; }
    
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus status) { this.status = status; }
    
    public String getDownloadUrl() { return downloadUrl; }
    public void setDownloadUrl(String downloadUrl) { this.downloadUrl = downloadUrl; }
    
    public String getS3Key() { return s3Key; }
    public void setS3Key(String s3Key) { this.s3Key = s3Key; }
    
    public String getS3Bucket() { return s3Bucket; }
    public void setS3Bucket(String s3Bucket) { this.s3Bucket = s3Bucket; }
    
    public String getChecksum() { return checksum; }
    public void setChecksum(String checksum) { this.checksum = checksum; }
    
    public Boolean getIsEncrypted() { return isEncrypted; }
    public void setIsEncrypted(Boolean isEncrypted) { this.isEncrypted = isEncrypted; }
    
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    
    public DocumentMetadata getMetadata() { return metadata; }
    public void setMetadata(DocumentMetadata metadata) { this.metadata = metadata; }
    
    // Enums
    public enum DocumentStatus {
        UPLOADING,
        COMPLETED,
        FAILED,
        PROCESSING,
        DELETED
    }
    
    // Inner class for document metadata
    public static class DocumentMetadata {
        private Integer pageCount;
        private String language;
        private Boolean hasPassword;
        private String createdBy;
        private Instant createdDate;
        private String version;
        private String contentType;
        private Boolean isScanned;
        private Double confidenceScore; // OCR confidence if applicable
        
        public DocumentMetadata() {}
        
        public Integer getPageCount() { return pageCount; }
        public void setPageCount(Integer pageCount) { this.pageCount = pageCount; }
        
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
        
        public Boolean getHasPassword() { return hasPassword; }
        public void setHasPassword(Boolean hasPassword) { this.hasPassword = hasPassword; }
        
        public String getCreatedBy() { return createdBy; }
        public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
        
        public Instant getCreatedDate() { return createdDate; }
        public void setCreatedDate(Instant createdDate) { this.createdDate = createdDate; }
        
        public String getVersion() { return version; }
        public void setVersion(String version) { this.version = version; }
        
        public String getContentType() { return contentType; }
        public void setContentType(String contentType) { this.contentType = contentType; }
        
        public Boolean getIsScanned() { return isScanned; }
        public void setIsScanned(Boolean isScanned) { this.isScanned = isScanned; }
        
        public Double getConfidenceScore() { return confidenceScore; }
        public void setConfidenceScore(Double confidenceScore) { this.confidenceScore = confidenceScore; }
    }
}