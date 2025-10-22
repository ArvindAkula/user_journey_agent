import React, { useState, useEffect } from 'react';
import VideoLibrary from '../components/VideoLibrary';
import { useProductionEventTracking } from '../hooks/useProductionEventTracking';
import { firebaseAnalyticsService } from '../services/FirebaseAnalyticsService';

const VideoLibraryPage: React.FC = () => {
  const [videosCompleted, setVideosCompleted] = useState(0);
  const { trackPageView, trackVideoEngagement } = useProductionEventTracking();

  useEffect(() => {
    // Track page view when component mounts (AWS)
    trackPageView('video_library');
    console.log('📊 Tracked page view: video_library');
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackPageView('Video Library', { page_name: 'video_library' });
  }, [trackPageView]);

  const handleVideoComplete = () => {
    setVideosCompleted(prev => prev + 1);
    
    // Track in AWS
    trackVideoEngagement('video_completed', 'complete', 100);
    console.log('📊 Tracked video completion in AWS');
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackVideoEvent('complete', 'tutorial_video', {
      completionRate: 100
    });
    console.log('🔥 Tracked video completion in Firebase');
  };

  return (
    <div className="video-library-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <VideoLibrary onVideoComplete={handleVideoComplete} />
    </div>
  );
};

export default VideoLibraryPage;