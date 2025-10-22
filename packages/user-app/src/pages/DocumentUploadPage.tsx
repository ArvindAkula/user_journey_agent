import React, { useState, useEffect } from 'react';
import DocumentUpload from '../components/DocumentUpload';
import { useProductionEventTracking } from '../hooks/useProductionEventTracking';
import { firebaseAnalyticsService } from '../services/FirebaseAnalyticsService';

const DocumentUploadPage: React.FC = () => {
  const [documentsUploaded, setDocumentsUploaded] = useState(0);
  const [strugglesDetected, setStrugglesDetected] = useState(0);
  const { trackPageView, trackFeatureInteraction, trackStruggleSignal } = useProductionEventTracking();

  useEffect(() => {
    // Track page view when component mounts (AWS)
    trackPageView('documents');
    console.log('📊 Tracked page view: documents');
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackPageView('Document Upload', { page_name: 'documents' });
  }, [trackPageView]);

  const handleDocumentUploaded = () => {
    setDocumentsUploaded(prev => prev + 1);
    
    // Track in AWS
    trackFeatureInteraction('document_upload', 'upload_complete', true);
    console.log('📊 Tracked document upload');
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackDocumentUpload('document', { success: true });
  };

  const handleStruggleDetected = () => {
    setStrugglesDetected(prev => prev + 1);
    
    // Track in AWS
    trackStruggleSignal('document_upload_struggle', { feature: 'document_upload' });
    console.log('📊 Tracked struggle signal');
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackStruggleSignal('document_upload', {
      attemptCount: strugglesDetected + 1,
      timeSpent: 0,
      severity: 'medium'
    });
  };

  return (
    <div className="document-upload-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <DocumentUpload
        onDocumentUploaded={handleDocumentUploaded}
        onStruggleDetected={handleStruggleDetected}
      />
    </div>
  );
};

export default DocumentUploadPage;