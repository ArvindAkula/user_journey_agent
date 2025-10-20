import React, { useState, useRef, useEffect } from 'react';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../config';
import './DocumentUpload.css';

interface DocumentUploadProps {
  onDocumentUploaded: () => void;
  onStruggleDetected: () => void;
}

interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  uploadDate: Date;
  status: 'uploading' | 'success' | 'error';
  progress?: number;
  downloadUrl?: string;
  previewUrl?: string;
  description?: string;
  tags?: string[];
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onDocumentUploaded,
  onStruggleDetected
}) => {
  // Create event service instance with enhanced configuration
  const eventService = new EventService({
    baseURL: config.apiBaseUrl,
    timeout: 5000,
    batchSize: 5,
    flushInterval: 3000,
    maxRetries: 3,
    retryDelay: 1000,
    enableOfflineQueue: true,
    maxOfflineEvents: 500
  });

  const { 
    trackFeatureInteraction, 
    trackStruggleSignal, 
    trackUserAction, 
    trackError,
    trackFormInteraction,
    trackButtonClick,
    trackPerformanceMetric,
    getInteractionStats
  } = useEventTracking({
    eventService,
    userId: 'demo-user',
    sessionId: `demo-session-${Date.now()}`,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('income');
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadAttempts, setUploadAttempts] = useState(0);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<UploadedDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'category'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents from localStorage on component mount
  useEffect(() => {
    const savedDocuments = localStorage.getItem('uploadedDocuments');
    if (savedDocuments) {
      try {
        const docs = JSON.parse(savedDocuments).map((doc: any) => ({
          ...doc,
          uploadDate: new Date(doc.uploadDate)
        }));
        setDocuments(docs);
      } catch (error) {
        console.error('Error loading documents:', error);
      }
    }
  }, []);

  // Save documents to localStorage whenever they change
  useEffect(() => {
    if (documents.length > 0) {
      localStorage.setItem('uploadedDocuments', JSON.stringify(documents));
    }
  }, [documents]);

  const DOCUMENT_CATEGORIES = [
    { id: 'income', label: 'Income Documents', required: true },
    { id: 'identity', label: 'Identity Verification', required: true },
    { id: 'assets', label: 'Asset Documentation', required: false },
    { id: 'employment', label: 'Employment Verification', required: true },
    { id: 'other', label: 'Other Documents', required: false },
  ];

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  useEffect(() => {
    // Track when user accesses the document upload
    trackFeatureInteraction('document_upload', true, {
      attemptCount: 1
    });

    // Track document upload page view
    trackUserAction('document_upload_page_view', {
      uploadType: 'document_management',
      timestamp: new Date().toISOString()
    });

    // Set up error boundary for the component
    const handleError = (error: ErrorEvent) => {
      trackError(error.error || error.message, {
        component: 'DocumentUpload',
        url: window.location.href
      });
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [trackFeatureInteraction, trackUserAction, trackError]);

  const createFilePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else {
        // For non-image files, create a placeholder preview
        resolve('');
      }
    });
  };

  const downloadDocument = (doc: UploadedDocument) => {
    // In a real app, this would download from the server
    // For demo purposes, we'll simulate a download
    const link = document.createElement('a');
    link.href = doc.downloadUrl || '#';
    link.download = doc.name;
    link.click();
    
    trackUserAction('document_downloaded', {
      documentId: doc.id,
      documentName: doc.name,
      documentCategory: doc.category,
      documentSize: doc.size
    });
  };

  const getFilteredAndSortedDocuments = () => {
    let filtered = documents;
    
    // Apply search filter
    if (searchQuery) {
      filtered = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return b.uploadDate.getTime() - a.uploadDate.getTime();
        case 'size':
          return b.size - a.size;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  const validateFile = (file: File): string[] => {
    const errors: string[] = [];
    
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File "${file.name}" is too large. Maximum size is 10MB.`);
    }
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`File "${file.name}" has an unsupported format. Please use PDF, JPEG, PNG, GIF, TXT, DOC, or DOCX.`);
    }
    
    if (file.name.length > 100) {
      errors.push(`File "${file.name}" name is too long. Please use a shorter name (max 100 characters).`);
    }
    
    // Check for duplicate files
    const existingDoc = documents.find(doc => doc.name === file.name && doc.category === selectedCategory);
    if (existingDoc) {
      errors.push(`File "${file.name}" already exists in this category.`);
    }
    
    // Enhanced category-specific validation
    const fileName = file.name.toLowerCase();
    switch (selectedCategory) {
      case 'income':
        if (!fileName.includes('income') && !fileName.includes('pay') && !fileName.includes('salary') && !fileName.includes('w2') && !fileName.includes('1099')) {
          errors.push(`File "${file.name}" doesn't appear to be an income document. Consider renaming or selecting a different category.`);
        }
        break;
      case 'identity':
        if (!fileName.includes('id') && !fileName.includes('license') && !fileName.includes('passport') && !fileName.includes('ssn')) {
          errors.push(`File "${file.name}" doesn't appear to be an identity document. Consider renaming or selecting a different category.`);
        }
        break;
    }
    
    return errors;
  };

  const simulateUpload = async (file: File, documentId: string): Promise<boolean> => {
    const uploadTime = Math.random() * 3000 + 2000; // 2-5 seconds
    const progressInterval = 100; // Update progress every 100ms
    const totalSteps = Math.floor(uploadTime / progressInterval);
    
    for (let step = 0; step <= totalSteps; step++) {
      const progress = Math.min((step / totalSteps) * 100, 100);
      
      // Update progress
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === documentId
            ? { ...doc, progress }
            : doc
        )
      );
      
      await new Promise(resolve => setTimeout(resolve, progressInterval));
    }
    
    // Simulate failure for multiple attempts
    if (uploadAttempts > 2) {
      if (Math.random() < 0.3) { // 30% chance of failure
        throw new Error('Upload failed due to server error. Please try again.');
      }
    }
    
    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
      // Track drag enter event
      trackUserAction('file_drag_enter', {
        category: selectedCategory,
        hasAdvancedOptions: showAdvancedOptions
      });
    } else if (e.type === 'dragleave') {
      setDragActive(false);
      // Track drag leave event
      trackUserAction('file_drag_leave', {
        category: selectedCategory
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    setUploadAttempts(prev => prev + 1);
    setIsUploading(true);
    setErrors([]);
    
    const fileArray = Array.from(files);
    const allErrors: string[] = [];
    
    // Validate all files first
    for (const file of fileArray) {
      const fileErrors = validateFile(file);
      allErrors.push(...fileErrors);
    }
    
    if (allErrors.length > 0) {
      setErrors(allErrors);
      setIsUploading(false);
      
      // Track struggle signal for validation errors
      if (uploadAttempts >= 2) {
        trackStruggleSignal('document_upload', {
          attemptCount: uploadAttempts + 1,
          errorType: 'validation_errors',
          userContext: {
            deviceType: 'desktop',
            browserInfo: navigator.userAgent,
            persona: 'demo-user',
            userSegment: 'demo',
            sessionStage: 'active',
            previousActions: []
          },
          deviceInfo: {
            platform: 'Web' as const,
            appVersion: '1.0.0',
            deviceModel: 'Browser'
          }
        });
        onStruggleDetected();
      }
      
      return;
    }
    
    // Process uploads
    for (const file of fileArray) {
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Generate preview for the file
        const previewUrl = await createFilePreview(file);
        
        // Add document with uploading status
        const newDocument: UploadedDocument = {
          id: documentId,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadDate: new Date(),
          status: 'uploading',
          category: selectedCategory,
          progress: 0,
          previewUrl,
          downloadUrl: URL.createObjectURL(file), // For demo purposes
          tags: [selectedCategory, file.type.split('/')[1]]
        };
        
        setDocuments(prev => [...prev, newDocument]);
        
        await simulateUpload(file, documentId);
        
        // Update status to success
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId
              ? { ...doc, status: 'success' as const, progress: 100 }
              : doc
          )
        );
        
        trackFeatureInteraction('document_upload_success', true, {
          attemptCount: uploadAttempts + 1,
          fileType: file.type,
          fileSize: file.size,
          category: selectedCategory,
          userContext: {
            deviceType: 'desktop',
            browserInfo: navigator.userAgent,
            persona: 'demo-user',
            userSegment: 'demo',
            sessionStage: 'active',
            previousActions: []
          },
          deviceInfo: {
            platform: 'Web' as const,
            appVersion: '1.0.0',
            deviceModel: 'Browser'
          }
        });
        
        onDocumentUploaded();
        
      } catch (error) {
        // Update status to error
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId
              ? { ...doc, status: 'error' as const, progress: 0 }
              : doc
          )
        );
        
        setErrors(prev => [...prev, error instanceof Error ? error.message : 'Upload failed']);
        
        trackStruggleSignal('document_upload', {
          attemptCount: uploadAttempts + 1,
          errorType: 'upload_failure',
          fileName: file.name,
          fileSize: file.size,
          category: selectedCategory,
          userContext: {
            deviceType: 'desktop',
            browserInfo: navigator.userAgent,
            persona: 'demo-user',
            userSegment: 'demo',
            sessionStage: 'active',
            previousActions: []
          },
          deviceInfo: {
            platform: 'Web' as const,
            appVersion: '1.0.0',
            deviceModel: 'Browser'
          }
        });
        
        onStruggleDetected();
      }
    }
    
    setIsUploading(false);
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRequiredDocuments = () => {
    return DOCUMENT_CATEGORIES.filter(cat => cat.required);
  };

  const getUploadedByCategory = (categoryId: string) => {
    return documents.filter(doc => doc.category === categoryId && doc.status === 'success');
  };

  const getCompletionStatus = () => {
    const required = getRequiredDocuments();
    const completed = required.filter(cat => getUploadedByCategory(cat.id).length > 0);
    return { completed: completed.length, total: required.length };
  };

  const getCompletionPercentage = () => {
    const status = getCompletionStatus();
    return (status.completed / status.total) * 100;
  };

  return (
    <div className="document-upload">
      <div className="upload-header">
        <h2>Document Management</h2>
        <p>Upload and organize your important documents</p>
      </div>

      <div className="completion-status">
        <div className="status-bar">
          <div 
            className="status-progress" 
            style={{ width: `${getCompletionPercentage()}%` }}
          />
        </div>
        <div className="status-text">
          Required documents: {getCompletionPercentage().toFixed(0)}% complete
        </div>
      </div>

      <div className="upload-section">
        <div className="category-selector">
          <label htmlFor="category">Document Category</label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => {
              const newCategory = e.target.value;
              const previousCategory = selectedCategory;
              setSelectedCategory(newCategory);
              
              // Track form interaction
              trackFormInteraction('document-upload', 'category', 'change', newCategory);
              
              // Track category change with enhanced context
              trackUserAction('category_changed', {
                fromCategory: previousCategory,
                toCategory: newCategory,
                isRequired: DOCUMENT_CATEGORIES.find(cat => cat.id === newCategory)?.required || false,
                documentsInPreviousCategory: documents.filter(doc => doc.category === previousCategory).length,
                totalDocuments: documents.length,
                completionStatus: getCompletionStatus()
              });
            }}
          >
            {DOCUMENT_CATEGORIES.map(category => (
              <option key={category.id} value={category.id}>
                {category.label} {category.required ? '(Required)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="advanced-toggle">
          <button
            type="button"
            onClick={() => {
              const newState = !showAdvancedOptions;
              setShowAdvancedOptions(newState);
              
              // Track button click with enhanced context
              trackButtonClick('advanced-upload-options', 'Advanced Upload Options', {
                expanded: newState,
                category: selectedCategory,
                documentsCount: documents.length,
                uploadAttempts,
                hasErrors: errors.length > 0,
                completionStatus: getCompletionStatus(),
                interactionStats: getInteractionStats('document_upload')
              });
              
              // Track advanced options toggle
              trackUserAction('advanced_options_toggled', {
                enabled: newState,
                category: selectedCategory,
                documentsCount: documents.length
              });
            }}
            className="toggle-button"
          >
            {showAdvancedOptions ? '▼' : '▶'} Advanced Upload Options
          </button>
        </div>

        {showAdvancedOptions && (
          <div className="advanced-options">
            <div className="option-group">
              <label>
                <input type="checkbox" />
                Compress images automatically
              </label>
            </div>
            <div className="option-group">
              <label>
                <input type="checkbox" />
                Convert to PDF after upload
              </label>
            </div>
            <div className="option-group">
              <label>
                <input type="checkbox" />
                Enable OCR text recognition
              </label>
            </div>
          </div>
        )}

        <div
          className={`upload-zone ${dragActive ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            // Track upload zone click
            trackButtonClick('upload-zone', 'Upload Zone Click', {
              category: selectedCategory,
              documentsCount: documents.length,
              uploadAttempts,
              hasErrors: errors.length > 0,
              completionPercentage: getCompletionPercentage(),
              uploadMethod: 'click'
            });
            
            fileInputRef.current?.click();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <div className="upload-content">
            {isUploading ? (
              <>
                <div className="upload-spinner" />
                <p>Uploading files...</p>
              </>
            ) : (
              <>
                <div className="upload-icon">📁</div>
                <p>Drag and drop files here or click to browse</p>
                <p className="upload-hint">Supported formats: PDF, JPEG, PNG, GIF (max 5MB each)</p>
              </>
            )}
          </div>
        </div>

        {errors.length > 0 && (
          <div className="error-section">
            <h4>Upload Errors</h4>
            <ul className="error-list">
              {errors.map((error, index) => (
                <li key={index} className="error-item">{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <div className="documents-list">
          <div className="documents-header">
            <h3>Uploaded Documents ({documents.length})</h3>
            
            <div className="document-controls">
              <div className="search-section">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    trackFormInteraction('document-upload', 'search', 'change', e.target.value);
                  }}
                  className="search-input"
                />
              </div>
              
              <div className="sort-section">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const newSort = e.target.value as typeof sortBy;
                    setSortBy(newSort);
                    trackFormInteraction('document-upload', 'sort', 'change', newSort);
                  }}
                  className="sort-select"
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                  <option value="category">Sort by Category</option>
                </select>
              </div>
              
              <div className="view-toggle">
                <button
                  onClick={() => {
                    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
                    trackButtonClick('view-toggle', 'View Mode Toggle', { newMode: viewMode === 'grid' ? 'list' : 'grid' });
                  }}
                  className="view-toggle-button"
                >
                  {viewMode === 'grid' ? '📋' : '⊞'} {viewMode === 'grid' ? 'List' : 'Grid'}
                </button>
              </div>
            </div>
          </div>
          
          <div className={`documents-container ${viewMode}`}>
            {getFilteredAndSortedDocuments().map(doc => (
              <div key={doc.id} className={`document-card ${doc.status}`}>
                <div className="document-preview">
                  {doc.previewUrl && doc.type.startsWith('image/') ? (
                    <img 
                      src={doc.previewUrl} 
                      alt={doc.name}
                      className="preview-image"
                      onClick={() => setPreviewDocument(doc)}
                    />
                  ) : (
                    <div className="preview-placeholder" onClick={() => setPreviewDocument(doc)}>
                      <div className="file-icon">
                        {doc.type.includes('pdf') ? '📄' : 
                         doc.type.includes('word') ? '📝' : 
                         doc.type.includes('text') ? '📃' : '📁'}
                      </div>
                      <div className="file-extension">
                        {doc.name.split('.').pop()?.toUpperCase()}
                      </div>
                    </div>
                  )}
                  
                  {doc.status === 'uploading' && doc.progress !== undefined && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${doc.progress}%` }}
                        />
                      </div>
                      <span className="progress-text">{Math.round(doc.progress)}%</span>
                    </div>
                  )}
                </div>
                
                <div className="document-info">
                  <div className="document-name" title={doc.name}>{doc.name}</div>
                  <div className="document-meta">
                    <span className="file-size">{formatFileSize(doc.size)}</span>
                    <span className="file-category">{DOCUMENT_CATEGORIES.find(cat => cat.id === doc.category)?.label}</span>
                  </div>
                  <div className="document-date">
                    {doc.uploadDate.toLocaleDateString()}
                  </div>
                  
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="document-tags">
                      {doc.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="tag">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="document-status">
                  {doc.status === 'uploading' && <span className="status-uploading">⏳</span>}
                  {doc.status === 'success' && <span className="status-success">✅</span>}
                  {doc.status === 'error' && <span className="status-error">❌</span>}
                </div>
                
                <div className="document-actions">
                  {doc.status === 'success' && (
                    <>
                      <button
                        className="preview-button"
                        onClick={() => setPreviewDocument(doc)}
                        title="Preview document"
                      >
                        👁️
                      </button>
                      <button
                        className="download-button"
                        onClick={() => downloadDocument(doc)}
                        title="Download document"
                      >
                        💾
                      </button>
                    </>
                  )}
                  <button
                    className="remove-button"
                    onClick={() => {
                      trackButtonClick(`remove-document-${doc.id}`, 'Remove Document', {
                        documentName: doc.name,
                        documentCategory: doc.category,
                        documentStatus: doc.status,
                        documentSize: doc.size,
                        totalDocuments: documents.length,
                        completionStatus: getCompletionStatus()
                      });
                      
                      removeDocument(doc.id);
                    }}
                    title="Remove document"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {getFilteredAndSortedDocuments().length === 0 && searchQuery && (
            <div className="no-results">
              <p>No documents found matching "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')} className="clear-search-button">
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}

      <div className="upload-help">
        <h4>Upload Guidelines:</h4>
        <ul>
          <li>Maximum file size: 10MB per file</li>
          <li>Supported formats: PDF, JPG, PNG, GIF, TXT, DOC, DOCX</li>
          <li>Required categories must have at least one successful upload</li>
          <li>You can upload multiple files at once</li>
          <li>Click on document previews to view them in full size</li>
        </ul>
      </div>

      {previewDocument && (
        <div className="preview-modal">
          <div className="modal-overlay" onClick={() => setPreviewDocument(null)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>{previewDocument.name}</h3>
              <button 
                className="close-button"
                onClick={() => setPreviewDocument(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              {previewDocument.previewUrl && previewDocument.type.startsWith('image/') ? (
                <img 
                  src={previewDocument.previewUrl} 
                  alt={previewDocument.name}
                  className="preview-full-image"
                />
              ) : (
                <div className="preview-placeholder-large">
                  <div className="file-icon-large">
                    {previewDocument.type.includes('pdf') ? '📄' : 
                     previewDocument.type.includes('word') ? '📝' : 
                     previewDocument.type.includes('text') ? '📃' : '📁'}
                  </div>
                  <h4>{previewDocument.name}</h4>
                  <p>Preview not available for this file type</p>
                  <button 
                    onClick={() => downloadDocument(previewDocument)}
                    className="download-preview-button"
                  >
                    Download to View
                  </button>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <div className="document-details">
                <div className="detail-item">
                  <label>Size:</label>
                  <span>{formatFileSize(previewDocument.size)}</span>
                </div>
                <div className="detail-item">
                  <label>Type:</label>
                  <span>{previewDocument.type}</span>
                </div>
                <div className="detail-item">
                  <label>Category:</label>
                  <span>{DOCUMENT_CATEGORIES.find(cat => cat.id === previewDocument.category)?.label}</span>
                </div>
                <div className="detail-item">
                  <label>Uploaded:</label>
                  <span>{previewDocument.uploadDate.toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  onClick={() => downloadDocument(previewDocument)}
                  className="download-modal-button"
                >
                  💾 Download
                </button>
                <button 
                  onClick={() => {
                    removeDocument(previewDocument.id);
                    setPreviewDocument(null);
                  }}
                  className="delete-modal-button"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentUpload;