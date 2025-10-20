import React, { useState, useEffect } from 'react';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../config';
import { useRealTimeTracking } from '../contexts/RealTimeContext';
import { useInterventionListener } from '../hooks/useInterventionListener';
import VideoLibrary from './VideoLibrary';
import InteractiveCalculator from './InteractiveCalculator';
import DocumentUpload from './DocumentUpload';
import UserProgress from './UserProgress';
import LiveChatPopup from './LiveChatPopup';
import './DemoApp.css';

interface TabContent {
  id: string;
  title: string;
  component: React.ReactNode;
  description: string;
}

const DemoApp: React.FC = () => {
  const sessionId = `demo-session-${Date.now()}`;
  
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
    trackPageView, 
    trackFeatureInteraction, 
    trackUserAction, 
    trackError,
    trackButtonClick,
    trackSessionEvent,
    trackPerformanceMetric,
    getSessionStats,
    isRateLimited
  } = useEventTracking({
    eventService,
    userId: 'demo-user',
    sessionId,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  // Intervention listener for critical interventions (live chat popup)
  // Using 'anonymous' for testing - change back to 'demo-user' or actual user ID in production
  const { showLiveChatPopup, interventionData, dismissIntervention } = useInterventionListener('anonymous');

  // Real-time analytics tracking (optional - gracefully handle if not available)
  let trackRealTimePageView: any = null;
  let trackRealTimeFeatureInteraction: any = null;
  let isRealTimeConnected = false;
  
  try {
    const realTimeTracking = useRealTimeTracking();
    trackRealTimePageView = realTimeTracking.trackRealTimePageView;
    trackRealTimeFeatureInteraction = realTimeTracking.trackRealTimeFeatureInteraction;
    isRealTimeConnected = realTimeTracking.isConnected;
  } catch (error) {
    // RealTimeProvider not available - continue without real-time tracking
    console.log('Real-time tracking not available, using traditional analytics only');
  }

  const [activeTab, setActiveTab] = useState('videos');
  const [userProgress, setUserProgress] = useState({
    videosWatched: 0,
    calculationsCompleted: 0,
    documentsUploaded: 0,
    strugglesEncountered: 0,
  });

  useEffect(() => {
    const startTime = performance.now();
    
    const contextData = {
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
    };
    
    // Track page view when component mounts (traditional)
    trackPageView('demo_app', contextData);
    
    // Also send to real-time analytics (if available)
    if (trackRealTimePageView) {
      trackRealTimePageView('demo_app', {
        userId: 'demo-user',
        sessionId,
        ...contextData
      });
    }

    // Track session start with enhanced data
    trackSessionEvent('session_start', {
      sessionType: 'demo',
      entryPoint: 'demo_app',
      userAgent: navigator.userAgent,
      screenResolution: typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : 'unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    // Track page load performance
    const endTime = performance.now();
    trackPerformanceMetric('page_load_time', endTime - startTime, 'ms');

    // Set up error boundary for the component
    const handleError = (error: ErrorEvent) => {
      trackError(error.error || error.message, {
        component: 'DemoApp',
        url: window.location.href,
        stack: error.error?.stack
      });
    };

    // Track unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackError(`Unhandled Promise Rejection: ${event.reason}`, {
        component: 'DemoApp',
        type: 'promise_rejection',
        url: window.location.href
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Track visibility changes
    const handleVisibilityChange = () => {
      trackUserAction(document.hidden ? 'page_hidden' : 'page_visible', {
        timestamp: Date.now(),
        sessionStats: getSessionStats()
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Track session end with comprehensive stats
      const finalStats = getSessionStats();
      trackSessionEvent('session_end', {
        ...finalStats,
        finalProgress: userProgress
      });
    };
  }, [trackPageView, trackUserAction, trackError, trackSessionEvent, trackPerformanceMetric, getSessionStats]);

  const handleTabChange = (tabId: string) => {
    const previousTab = activeTab;
    setActiveTab(tabId);
    
    const contextData = {
      targetTab: tabId,
      previousTab,
      attemptCount: 1,
      userContext: {
        deviceType: 'desktop',
        browserInfo: navigator.userAgent,
        persona: 'demo-user',
        userSegment: 'demo',
        sessionStage: 'active',
        previousActions: [previousTab]
      }
    };
    
    // Track tab navigation with enhanced context (traditional)
    trackButtonClick(`tab_${tabId}`, tabs.find(t => t.id === tabId)?.title, {
      previousTab,
      tabIndex: tabs.findIndex(t => t.id === tabId),
      navigationPattern: `${previousTab}_to_${tabId}`,
      sessionProgress: userProgress
    });
    
    trackFeatureInteraction(`tab_navigation`, true, contextData);
    
    // Also send to real-time analytics (if available)
    if (trackRealTimeFeatureInteraction) {
      trackRealTimeFeatureInteraction(
        'demo-user',
        sessionId,
        'tab_navigation',
        true,
        contextData
      );
    }
  };

  const updateProgress = (type: keyof typeof userProgress, increment: number = 1) => {
    setUserProgress(prev => ({
      ...prev,
      [type]: prev[type] + increment,
    }));
  };

  const tabs: TabContent[] = [
    {
      id: 'videos',
      title: 'Video Library',
      description: 'Educational and tutorial videos',
      component: <VideoLibrary onVideoComplete={() => updateProgress('videosWatched')} />,
    },
    {
      id: 'calculator',
      title: 'Interactive Tools',
      description: 'Calculators and interactive forms',
      component: (
        <InteractiveCalculator
          onCalculationComplete={() => updateProgress('calculationsCompleted')}
          onStruggleDetected={() => updateProgress('strugglesEncountered')}
        />
      ),
    },
    {
      id: 'documents',
      title: 'Document Center',
      description: 'Upload and manage your documents',
      component: (
        <DocumentUpload
          onDocumentUploaded={() => updateProgress('documentsUploaded')}
          onStruggleDetected={() => updateProgress('strugglesEncountered')}
        />
      ),
    },
    {
      id: 'profile',
      title: 'User Profile',
      description: 'Manage your account and preferences',
      component: <UserProgress progress={userProgress} />,
    },
  ];

  return (
    <div className="demo-app">
      <header className="demo-header">
        <div className="header-content">
          <h1>Mortgage Agent Demo Platform</h1>
          <div className="header-actions">
            <div className="user-info">
              <span>Welcome, Demo User</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="demo-nav">
        <div className="nav-content">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="tab-title">{tab.title}</span>
              <span className="tab-description">{tab.description}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="demo-content">
        <div className="content-container">
          {tabs.find(tab => tab.id === activeTab)?.component}
        </div>
      </main>

      <div className="demo-info-panel">
        <h3>Platform Features</h3>
        <p>
          Explore our interactive tools and resources designed to help you learn and grow.
          Your progress is automatically tracked to provide personalized recommendations.
        </p>
        <div className="progress-summary">
          <h4>Your Activity</h4>
          <ul>
            <li>Videos watched: {userProgress.videosWatched}</li>
            <li>Calculations completed: {userProgress.calculationsCompleted}</li>
            <li>Documents uploaded: {userProgress.documentsUploaded}</li>
            <li>Challenges overcome: {userProgress.strugglesEncountered}</li>
          </ul>
        </div>
      </div>

      {/* Live Chat Popup - Shows when critical intervention is triggered (exitRiskScore > 70) */}
      {showLiveChatPopup && interventionData && (
        <LiveChatPopup
          userId="demo-user"
          riskScore={interventionData.payload.riskScore}
          context={interventionData.payload.context}
          onClose={dismissIntervention}
          onAccept={() => {
            console.log('User accepted live chat offer');
            trackUserAction('live_chat_accepted', {
              riskScore: interventionData.payload.riskScore,
              interventionType: interventionData.payload.interventionType
            });
            // In production, this would open the actual chat interface
            alert('Connecting you to a support specialist...');
            dismissIntervention();
          }}
        />
      )}
    </div>
  );
};

export default DemoApp;