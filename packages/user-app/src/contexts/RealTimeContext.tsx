import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRealTimeAnalytics } from '@aws-agent/shared';
import { useEventTracking } from '@aws-agent/shared';
import { EventService } from '@aws-agent/shared';
import { UserEvent } from '@aws-agent/shared';
import { config } from '../config';

interface RealTimeContextType {
  sendRealTimeEvent: (event: Omit<UserEvent, 'eventId' | 'timestamp'>) => Promise<void>;
  isConnected: boolean;
  connectionStatus: {
    reconnectAttempts: number;
    bufferedEvents: number;
    activeCorrelations: number;
  };
}

const RealTimeContext = createContext<RealTimeContextType | undefined>(undefined);

interface RealTimeProviderProps {
  children: ReactNode;
  userId: string;
  sessionId: string;
}

export const RealTimeProvider: React.FC<RealTimeProviderProps> = ({ 
  children, 
  userId, 
  sessionId 
}) => {
  // Get WebSocket URL from environment
  const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080/ws';
  
  // Set up real-time analytics with error handling
  let isConnected = false;
  let connectionStatus = {
    reconnectAttempts: 0,
    bufferedEvents: 0,
    activeCorrelations: 0
  };
  let sendEvent: ((event: any) => Promise<void>) | null = null;
  let service: any = null;

  try {
    const realTimeAnalytics = useRealTimeAnalytics({
      websocketUrl,
      autoConnect: true,
      enableEventCorrelation: true,
      onConnectionChange: (connected) => {
        console.log(`🔗 Real-time analytics ${connected ? 'connected' : 'disconnected'}`);
      },
      onError: (error) => {
        console.error('❌ Real-time analytics error:', error);
      }
    });
    
    isConnected = realTimeAnalytics.isConnected;
    connectionStatus = realTimeAnalytics.connectionStatus;
    sendEvent = realTimeAnalytics.sendEvent;
    service = realTimeAnalytics.service;
  } catch (error) {
    console.warn('⚠️ Real-time analytics disabled due to connection issues:', error);
  }

  // Set up traditional event tracking
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

  const { trackEvent } = useEventTracking({
    eventService,
    userId,
    sessionId,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  // Enhanced event sending that uses both traditional and real-time analytics
  const sendRealTimeEvent = async (eventData: Omit<UserEvent, 'eventId' | 'timestamp'>) => {
    const fullEvent: UserEvent = {
      ...eventData,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    try {
      // Send to traditional analytics (batch processing)
      await trackEvent(eventData);
      
      // Send to real-time analytics (immediate processing)
      if (isConnected && service && sendEvent) {
        try {
          await sendEvent(fullEvent);
          console.log('📡 Event sent to real-time analytics:', fullEvent.eventType);
        } catch (error) {
          console.log('📦 Event failed to send to real-time analytics:', error);
        }
      } else {
        console.log('📦 Real-time analytics not available (using traditional analytics only)');
      }
    } catch (error) {
      console.error('Error sending real-time event:', error);
    }
  };

  // Log connection status changes
  useEffect(() => {
    console.log('🔄 Real-time analytics connection status:', {
      isConnected,
      ...connectionStatus
    });
  }, [isConnected, connectionStatus]);

  const value: RealTimeContextType = {
    sendRealTimeEvent,
    isConnected,
    connectionStatus,
  };

  return (
    <RealTimeContext.Provider value={value}>
      {children}
    </RealTimeContext.Provider>
  );
};

export const useRealTime = (): RealTimeContextType => {
  const context = useContext(RealTimeContext);
  if (context === undefined) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
};

// Hook for easy real-time event tracking
export const useRealTimeTracking = () => {
  const { sendRealTimeEvent, isConnected } = useRealTime();

  const trackRealTimePageView = async (page: string, context?: any) => {
    await sendRealTimeEvent({
      userId: context?.userId || 'anonymous',
      sessionId: context?.sessionId || 'unknown',
      eventType: 'page_view',
      eventData: {
        feature: page,
        ...context?.eventData,
      },
      userContext: context?.userContext || {},
      deviceInfo: context?.deviceInfo || {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: navigator.userAgent,
      },
    });
  };

  const trackRealTimeFeatureInteraction = async (
    userId: string,
    sessionId: string,
    feature: string,
    success: boolean,
    context?: any
  ) => {
    await sendRealTimeEvent({
      userId,
      sessionId,
      eventType: 'feature_interaction',
      eventData: {
        feature,
        success,
        attemptCount: context?.attemptCount || 1,
        duration: context?.duration,
        errorMessage: context?.errorMessage,
      },
      userContext: context?.userContext || {},
      deviceInfo: context?.deviceInfo || {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: navigator.userAgent,
      },
    });
  };

  const trackRealTimeVideoEngagement = async (
    userId: string,
    sessionId: string,
    videoId: string,
    engagementData: any
  ) => {
    await sendRealTimeEvent({
      userId,
      sessionId,
      eventType: 'video_engagement',
      eventData: {
        videoId,
        ...engagementData,
      },
      userContext: engagementData.userContext || {},
      deviceInfo: engagementData.deviceInfo || {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: navigator.userAgent,
      },
    });
  };

  const trackRealTimeStruggleSignal = async (
    userId: string,
    sessionId: string,
    feature: string,
    signalData: any
  ) => {
    await sendRealTimeEvent({
      userId,
      sessionId,
      eventType: 'struggle_signal',
      eventData: {
        feature,
        attemptCount: signalData.attemptCount,
        duration: signalData.duration,
        errorMessage: signalData.errorMessage,
      },
      userContext: signalData.userContext || {},
      deviceInfo: signalData.deviceInfo || {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: navigator.userAgent,
      },
    });
  };

  return {
    trackRealTimePageView,
    trackRealTimeFeatureInteraction,
    trackRealTimeVideoEngagement,
    trackRealTimeStruggleSignal,
    isConnected,
  };
};