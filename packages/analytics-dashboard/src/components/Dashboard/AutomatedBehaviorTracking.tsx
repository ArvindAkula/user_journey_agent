import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '@aws-agent/shared';
import './AutomatedBehaviorTracking.css';

interface BehaviorEvent {
  id: string;
  timestamp: Date;
  userId: string;
  personaId?: string;
  eventType: 'page_view' | 'feature_interaction' | 'struggle_detected' | 'intervention_triggered' | 'conversion';
  eventData: {
    feature?: string;
    duration?: number;
    success?: boolean;
    strugglesCount?: number;
    interventionType?: string;
    conversionValue?: number;
  };
  userContext: {
    deviceType: string;
    persona?: string;
    sessionStage: string;
  };
}

interface AutomatedBehaviorTrackingProps {
  selectedPersona: string | null;
  filters?: any;
  realTimeData?: any;
  refreshKey?: number;
}

const AutomatedBehaviorTracking: React.FC<AutomatedBehaviorTrackingProps> = ({
  selectedPersona,
  filters,
  realTimeData,
  refreshKey
}) => {
  const [behaviorEvents, setBehaviorEvents] = useState<BehaviorEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);

  const analyticsService = new AnalyticsService({
    baseURL: process.env.REACT_APP_ANALYTICS_API_URL || 'http://localhost:8080',
    timeout: 10000
  });

  useEffect(() => {
    fetchBehaviorEvents();
  }, [selectedPersona, filters, refreshKey]);

  useEffect(() => {
    // Simulate real-time events
    if (isRealTimeActive) {
      const interval = setInterval(() => {
        addSimulatedEvent();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isRealTimeActive, selectedPersona]);

  const fetchBehaviorEvents = async () => {
    try {
      setIsLoading(true);
      
      // Mock behavior events for demo
      const mockEvents: BehaviorEvent[] = generateMockEvents();
      setBehaviorEvents(mockEvents);
    } catch (error) {
      console.error('Failed to fetch behavior events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockEvents = (): BehaviorEvent[] => {
    const events: BehaviorEvent[] = [];
    const now = new Date();
    
    // Generate events for the last 2 hours
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now.getTime() - (i * 6 * 60 * 1000)); // Every 6 minutes
      
      events.push({
        id: `event-${i}`,
        timestamp,
        userId: `user-${Math.floor(Math.random() * 5) + 1}`,
        personaId: selectedPersona || undefined,
        eventType: getRandomEventType(),
        eventData: generateEventData(),
        userContext: {
          deviceType: Math.random() > 0.7 ? 'mobile' : 'desktop',
          persona: selectedPersona || 'unknown',
          sessionStage: Math.random() > 0.5 ? 'active' : 'exploring'
        }
      });
    }
    
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const getRandomEventType = (): BehaviorEvent['eventType'] => {
    const types: BehaviorEvent['eventType'][] = [
      'page_view', 'feature_interaction', 'struggle_detected', 'intervention_triggered', 'conversion'
    ];
    return types[Math.floor(Math.random() * types.length)];
  };

  const generateEventData = () => {
    return {
      feature: ['video-library', 'calculator', 'document-upload', 'profile'][Math.floor(Math.random() * 4)],
      duration: Math.floor(Math.random() * 300) + 30,
      success: Math.random() > 0.3,
      strugglesCount: Math.floor(Math.random() * 3),
      interventionType: ['tooltip', 'modal', 'guided-tour'][Math.floor(Math.random() * 3)],
      conversionValue: Math.random() > 0.8 ? Math.floor(Math.random() * 100) + 10 : undefined
    };
  };

  const addSimulatedEvent = () => {
    const newEvent: BehaviorEvent = {
      id: `live-${Date.now()}`,
      timestamp: new Date(),
      userId: `user-${Math.floor(Math.random() * 5) + 1}`,
      personaId: selectedPersona || undefined,
      eventType: getRandomEventType(),
      eventData: generateEventData(),
      userContext: {
        deviceType: Math.random() > 0.7 ? 'mobile' : 'desktop',
        persona: selectedPersona || 'live-user',
        sessionStage: 'active'
      }
    };

    setBehaviorEvents(prev => [newEvent, ...prev.slice(0, 19)]);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'page_view': return '👁️';
      case 'feature_interaction': return '🖱️';
      case 'struggle_detected': return '⚠️';
      case 'intervention_triggered': return '🤖';
      case 'conversion': return '🎯';
      default: return '📊';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'page_view': return '#2196F3';
      case 'feature_interaction': return '#4CAF50';
      case 'struggle_detected': return '#FF9800';
      case 'intervention_triggered': return '#9C27B0';
      case 'conversion': return '#FF5722';
      default: return '#9E9E9E';
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return timestamp.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="behavior-tracking-loading">
        <div className="loading-spinner"></div>
        <p>Loading behavior tracking data...</p>
      </div>
    );
  }

  return (
    <div className="automated-behavior-tracking">
      <div className="tracking-header">
        <div className="header-controls">
          <h4>Live Behavior Timeline</h4>
          <div className="controls">
            <button
              className={`real-time-toggle ${isRealTimeActive ? 'active' : ''}`}
              onClick={() => setIsRealTimeActive(!isRealTimeActive)}
            >
              {isRealTimeActive ? '⏸️ Pause' : '▶️ Start'} Live Tracking
            </button>
            <button className="refresh-button" onClick={fetchBehaviorEvents}>
              🔄 Refresh
            </button>
          </div>
        </div>
        
        {selectedPersona && (
          <div className="persona-filter">
            <span>Filtering by: {selectedPersona}</span>
          </div>
        )}
      </div>

      <div className="behavior-timeline">
        {behaviorEvents.length === 0 ? (
          <div className="no-events">
            <p>No behavior events found</p>
          </div>
        ) : (
          <div className="timeline-events">
            {behaviorEvents.map((event, index) => (
              <div key={event.id} className="timeline-event">
                <div className="event-indicator">
                  <div 
                    className="event-dot"
                    style={{ backgroundColor: getEventColor(event.eventType) }}
                  >
                    <span className="event-icon">{getEventIcon(event.eventType)}</span>
                  </div>
                  {index < behaviorEvents.length - 1 && <div className="event-line"></div>}
                </div>
                
                <div className="event-content">
                  <div className="event-header">
                    <span className="event-type">{formatEventType(event.eventType)}</span>
                    <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
                  </div>
                  
                  <div className="event-details">
                    <div className="event-user">
                      <span className="user-id">User: {event.userId}</span>
                      {event.userContext.persona && (
                        <span className="user-persona">({event.userContext.persona})</span>
                      )}
                    </div>
                    
                    {event.eventData.feature && (
                      <div className="event-feature">
                        Feature: {event.eventData.feature}
                      </div>
                    )}
                    
                    {event.eventData.duration && (
                      <div className="event-duration">
                        Duration: {event.eventData.duration}s
                      </div>
                    )}
                    
                    {event.eventData.success !== undefined && (
                      <div className={`event-success ${event.eventData.success ? 'success' : 'failure'}`}>
                        {event.eventData.success ? '✅ Success' : '❌ Failed'}
                      </div>
                    )}
                    
                    {event.eventData.strugglesCount !== undefined && event.eventData.strugglesCount > 0 && (
                      <div className="event-struggles">
                        Struggles: {event.eventData.strugglesCount}
                      </div>
                    )}
                    
                    {event.eventData.interventionType && (
                      <div className="event-intervention">
                        Intervention: {event.eventData.interventionType}
                      </div>
                    )}
                    
                    {event.eventData.conversionValue && (
                      <div className="event-conversion">
                        Value: ${event.eventData.conversionValue}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomatedBehaviorTracking;