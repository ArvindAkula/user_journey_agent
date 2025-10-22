import { analytics } from '../config/firebase';
import { logEvent as firebaseLogEvent, setUserId as firebaseSetUserId, setUserProperties as firebaseSetUserProperties } from 'firebase/analytics';

/**
 * Firebase Analytics Service
 * 
 * Provides a centralized service for tracking user events, page views,
 * calculator interactions, video engagement, and document uploads using
 * Firebase Analytics with automatic BigQuery export for cost optimization.
 */
export class FirebaseAnalyticsService {
  private static instance: FirebaseAnalyticsService;
  private isInitialized = false;
  private isDevelopment = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): FirebaseAnalyticsService {
    if (!FirebaseAnalyticsService.instance) {
      FirebaseAnalyticsService.instance = new FirebaseAnalyticsService();
    }
    return FirebaseAnalyticsService.instance;
  }

  private initialize(): void {
    if (analytics && typeof window !== 'undefined') {
      this.isInitialized = true;
      this.isDevelopment = process.env.NODE_ENV === 'development' || process.env.REACT_APP_ENVIRONMENT === 'development';
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics initialized in DEBUG mode');
      } else {
        console.log('🔥 Firebase Analytics initialized successfully');
      }
    } else {
      console.warn('Firebase Analytics not available');
    }
  }

  /**
   * Check if analytics is available and initialized
   */
  public isAvailable(): boolean {
    return this.isInitialized && analytics !== null;
  }

  /**
   * Set user ID for analytics tracking
   */
  public setUserId(userId: string): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseSetUserId(analytics, userId);
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: User ID set', userId);
      }
    } catch (error) {
      console.error('Error setting user ID:', error);
    }
  }

  /**
   * Set user properties for analytics
   */
  public setUserProperties(properties: Record<string, any>): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseSetUserProperties(analytics, properties);
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: User properties set', properties);
      }
    } catch (error) {
      console.error('Error setting user properties:', error);
    }
  }

  /**
   * Track page view events
   */
  public trackPageView(pageName: string, additionalParams?: Record<string, any>): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'page_view', {
        page_title: pageName,
        page_location: window.location.href,
        page_path: window.location.pathname,
        ...additionalParams,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Page view', pageName, additionalParams);
      }
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }

  /**
   * Track calculator interactions
   * Implements calculator event tracking as per requirements
   */
  public trackCalculatorEvent(action: string, params: {
    loanAmount?: number;
    interestRate?: number;
    termYears?: number;
    monthlyPayment?: number;
    calculationType?: string;
    success?: boolean;
    errorType?: string;
  }): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'calculator_interaction', {
        action,
        loan_amount: params.loanAmount,
        interest_rate: params.interestRate,
        term_years: params.termYears,
        monthly_payment: params.monthlyPayment,
        calculation_type: params.calculationType || 'mortgage',
        success: params.success !== undefined ? params.success : true,
        error_type: params.errorType,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Calculator interaction', action, params);
      }
    } catch (error) {
      console.error('Error tracking calculator event:', error);
    }
  }

  /**
   * Track video engagement events
   * Implements video engagement tracking as per requirements
   */
  public trackVideoEvent(action: 'play' | 'pause' | 'complete' | 'seek' | 'start', videoId: string, params?: {
    duration?: number;
    position?: number;
    completionRate?: number;
    playbackSpeed?: number;
    videoTitle?: string;
  }): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'video_engagement', {
        action,
        video_id: videoId,
        video_title: params?.videoTitle || videoId,
        video_duration: params?.duration,
        video_position: params?.position,
        completion_rate: params?.completionRate,
        playback_speed: params?.playbackSpeed || 1.0,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Video engagement', action, videoId, params);
      }
    } catch (error) {
      console.error('Error tracking video event:', error);
    }
  }

  /**
   * Track document upload events
   */
  public trackDocumentUpload(documentType: string, params?: {
    fileSize?: number;
    fileName?: string;
    success?: boolean;
    errorType?: string;
  }): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'document_upload', {
        document_type: documentType,
        file_size: params?.fileSize,
        file_name: params?.fileName,
        success: params?.success !== undefined ? params?.success : true,
        error_type: params?.errorType,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Document upload', documentType, params);
      }
    } catch (error) {
      console.error('Error tracking document upload:', error);
    }
  }

  /**
   * Track feature interactions
   */
  public trackFeatureInteraction(feature: string, action: string, params?: {
    attemptCount?: number;
    success?: boolean;
    errorType?: string;
    timeSpent?: number;
  }): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'feature_interaction', {
        feature_name: feature,
        interaction_action: action,
        attempt_count: params?.attemptCount || 1,
        interaction_success: params?.success !== undefined ? params?.success : true,
        error_type: params?.errorType,
        time_spent: params?.timeSpent,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Feature interaction', feature, action, params);
      }
    } catch (error) {
      console.error('Error tracking feature interaction:', error);
    }
  }

  /**
   * Track navigation events
   */
  public trackNavigation(from: string, to: string, params?: Record<string, any>): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'navigation', {
        from_page: from,
        to_page: to,
        ...params,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Navigation', from, '->', to);
      }
    } catch (error) {
      console.error('Error tracking navigation:', error);
    }
  }

  /**
   * Track struggle signals
   */
  public trackStruggleSignal(feature: string, params: {
    attemptCount: number;
    timeSpent: number;
    errorType?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'struggle_signal', {
        feature_name: feature,
        attempt_count: params.attemptCount,
        time_spent: params.timeSpent,
        error_type: params.errorType,
        severity: params.severity,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Struggle signal', feature, params);
      }
    } catch (error) {
      console.error('Error tracking struggle signal:', error);
    }
  }

  /**
   * Track custom events
   */
  public trackCustomEvent(eventName: string, parameters?: Record<string, any>): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, eventName, {
        ...parameters,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Custom event', eventName, parameters);
      }
    } catch (error) {
      console.error('Error tracking custom event:', error);
    }
  }

  /**
   * Track search events
   */
  public trackSearch(query: string, resultsCount?: number): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'search', {
        search_term: query,
        results_count: resultsCount,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Search', query, resultsCount);
      }
    } catch (error) {
      console.error('Error tracking search:', error);
    }
  }

  /**
   * Track error events
   */
  public trackError(errorType: string, errorMessage: string, params?: Record<string, any>): void {
    if (!this.isAvailable() || !analytics) return;
    
    try {
      firebaseLogEvent(analytics, 'error', {
        error_type: errorType,
        error_message: errorMessage,
        ...params,
        timestamp: Date.now()
      });
      
      if (this.isDevelopment) {
        console.log('🔥 Firebase Analytics: Error', errorType, errorMessage);
      }
    } catch (error) {
      console.error('Error tracking error event:', error);
    }
  }
}

// Export singleton instance
export const firebaseAnalyticsService = FirebaseAnalyticsService.getInstance();
