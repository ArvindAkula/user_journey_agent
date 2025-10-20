import React, { useState, useEffect } from 'react';
import DocumentUpload from '../components/DocumentUpload';
import { useProductionEventTracking } from '../hooks/useProductionEventTracking';
import { logPageView, logDocumentUpload, logAnalyticsEvent } from '../config/firebase';

const DocumentUploadPage: React.FC = () => {
  const [documentsUploaded, setDocumentsUploaded] = useState(0);
  const [strugglesDetected, setStrugglesDetected] = useState(0);
  const { trackPageView, trackFeatureInteraction, trackStruggleSignal } = useProductionEventTracking();

  useEffect(() => {
    // Track page view when component mounts (AWS)
    trackPageView('documents');
    console.log('📊 Tracked page view: documents');
    
    // Also track in Firebase Analytics
    logPageView('documents', 'Document Upload');
  }, [trackPageView]);

  const handleDocumentUploaded = () => {
    setDocumentsUploaded(prev => prev + 1);
    
    // Track in AWS
    trackFeatureInteraction('document_upload', 'upload_complete', true);
    console.log('📊 Tracked document upload');
    
    // Also track in Firebase Analytics
    logDocumentUpload('document', true);
  };

  const handleStruggleDetected = () => {
    setStrugglesDetected(prev => prev + 1);
    
    // Track in AWS
    trackStruggleSignal('document_upload_struggle', { feature: 'document_upload' });
    console.log('📊 Tracked struggle signal');
    
    // Also track in Firebase Analytics
    logAnalyticsEvent('struggle_detected', {
      feature: 'document_upload',
      struggle_type: 'upload_difficulty',
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