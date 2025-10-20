package com.userjourney.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class DocumentUploadRequest {
    
    @NotBlank(message = "User ID is required")
    @JsonProperty("userId")
    private String userId;
    
    @NotBlank(message = "File name is required")
    @Size(max = 255, message = "File name cannot exceed 255 characters")
    @JsonProperty("fileName")
    private String fileName;
    
    @NotNull(message = "File size is required")
    @JsonProperty("fileSize")
    private Long fileSize;
    
    @NotBlank(message = "File type is required")
    @JsonProperty("fileType")
    private String fileType;
    
    @JsonProperty("category")
    private String category = "general";
    
    @JsonProperty("description")
    @Size(max = 500, message = "Description cannot exceed 500 characters")
    private String description;
    
    @JsonProperty("tags")
    @Size(max = 200, message = "Tags cannot exceed 200 characters")
    private String tags;
    
    @JsonProperty("isEncrypted")
    private Boolean isEncrypted = false;
    
    @JsonProperty("checksum")
    private String checksum; // Client-side file checksum for validation
    
    // Constructors
    public DocumentUploadRequest() {}
    
    public DocumentUploadRequest(String userId, String fileName, Long fileSize, String fileType) {
        this.userId = userId;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.fileType = fileType;
        this.category = "general";
        this.isEncrypted = false;
    }
    
    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    
    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }
    
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    
    public Boolean getIsEncrypted() { return isEncrypted; }
    public void setIsEncrypted(Boolean isEncrypted) { this.isEncrypted = isEncrypted; }
    
    public String getChecksum() { return checksum; }
    public void setChecksum(String checksum) { this.checksum = checksum; }
}