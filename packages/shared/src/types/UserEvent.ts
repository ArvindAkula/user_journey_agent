export interface TimeRange {
  start: number;
  end: number;
}

export interface UserEvent {
  eventId: string;
  userId: string;
  sessionId: string;
  eventType: 'page_view' | 'feature_interaction' | 'video_engagement' | 'struggle_signal' | 'user_action' | 'error_event' | 'pricing_page_view' | 'checkout_abandon' | 'form_error' | 'video_complete';
  timestamp: Date;
  eventData: {
    feature?: string;
    videoId?: string;
    attemptCount?: number;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
    completionRate?: number;
    watchDuration?: number;
    pausePoints?: number[];
    skipSegments?: TimeRange[];
    playbackSpeed?: number;
    // New fields for enhanced tracking
    action?: string;
    category?: string;
    difficulty?: string;
    errorType?: string;
    errorStack?: string;
    autoDetected?: boolean;
    errorCount?: number;
    hasAdvancedFields?: boolean;
    fromCategory?: string;
    toCategory?: string;
    isRequired?: boolean;
    enabled?: boolean;
    documentsCount?: number;
    calculatorType?: string;
    uploadType?: string;
    sessionType?: string;
    entryPoint?: string;
    sessionDuration?: number;
    videoTitle?: string;
    errors?: string[];
    [key: string]: any; // Allow additional dynamic properties
  };
  userContext: {
    deviceType: string;
    browserInfo: string;
    location?: string;
    persona?: string;
    userSegment: string;
    sessionStage: string;
    previousActions: string[];
  };
  deviceInfo: {
    platform: 'iOS' | 'Android' | 'Web';
    appVersion: string;
    deviceModel: string;
  };
}