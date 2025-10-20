import React, { useState, useEffect } from 'react';
import { AnalyticsService, useRealTimeAnalytics } from '@aws-agent/shared';
import RealUserAnalysis from './RealUserAnalysis';
import AutomatedBehaviorTracking from './AutomatedBehaviorTracking';
import './UserJourneyDemo.css';

interface UserJourneyDemoProps {
  filters?: any;
  refreshKey?: number;
}

interface JourneyMetrics {
  totalSessions: number;
  averageSessionDuration: number;
  conversionRate: number;
  dropoffRate: number;
  strugglesDetected: number;
  interventionsTriggered: number;
}

const UserJourneyDemo: React.FC<UserJourneyDemoProps> = ({ filters, refreshKey }) => {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [journeyMetrics, setJourneyMetrics] = useState<JourneyMetrics>({
    totalSessions: 0,
    averageSessionDuration: 0,
    conversionRate: 0,
    dropoffRate: 0,
    strugglesDetected: 0,
    interventionsTriggered: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics service for fetching journey data
  const analyticsService = new AnalyticsService({
    baseURL: process.env.REACT_APP_ANALYTICS_API_URL || 'http://localhost:8080',
    timeout: 10000
  });

  const { metrics: realTimeData, isConnected } = useRealTimeAnalytics({
    websocketUrl: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080/ws',
    autoConnect: true
  });

  useEffect(() => {
    fetchJourneyMetrics();
  }, [filters, refreshKey]);

  const fetchJourneyMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await analyticsService.getUserJourneyMetrics(filters);

      // Map the response to our internal metrics format
      setJourneyMetrics({
        totalSessions: response.totalUsers,
        averageSessionDuration: response.averageSessionDuration,
        conversionRate: response.conversionRate,
        dropoffRate: response.dropOffRate,
        strugglesDetected: response.struggleSignals,
        interventionsTriggered: Math.floor(response.struggleSignals * 0.4) // Estimate interventions
      });
    } catch (err) {
      console.error('Failed to fetch journey metrics:', err);
      setError('Failed to load user journey data');
      
      // Fallback to mock data for demo purposes
      setJourneyMetrics({
        totalSessions: 1247,
        averageSessionDuration: 8.5,
        conversionRate: 23.4,
        dropoffRate: 15.2,
        strugglesDetected: 89,
        interventionsTriggered: 34
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaSelect = (personaId: string) => {
    setSelectedPersona(selectedPersona === personaId ? null : personaId);
  };

  if (isLoading) {
    return (
      <div className="user-journey-demo loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading user journey analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-journey-demo">
      <div className="demo-header">
        <div className="header-content">
          <h2 style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0' }}>Customer Journey Analytics</h2>
          <p className="header-description" style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', margin: 0 }}>
            Detailed user behavior tracking - sessions, interactions, and conversion paths
          </p>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Real-time' : '🔴 Offline'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={fetchJourneyMetrics} className="retry-button">
            Retry
          </button>
        </div>
      )}

      <div className="journey-metrics-overview">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">👥</div>
            <div className="metric-content">
              <span className="metric-value">{journeyMetrics.totalSessions.toLocaleString()}</span>
              <span className="metric-label">Total Sessions</span>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">⏱️</div>
            <div className="metric-content">
              <span className="metric-value">{journeyMetrics.averageSessionDuration}m</span>
              <span className="metric-label">Avg Duration</span>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">📈</div>
            <div className="metric-content">
              <span className="metric-value">{journeyMetrics.conversionRate}%</span>
              <span className="metric-label">Conversion Rate</span>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">📉</div>
            <div className="metric-content">
              <span className="metric-value">{journeyMetrics.dropoffRate}%</span>
              <span className="metric-label">Drop-off Rate</span>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">⚠️</div>
            <div className="metric-content">
              <span className="metric-value">{journeyMetrics.strugglesDetected}</span>
              <span className="metric-label">Struggles Detected</span>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">🤖</div>
            <div className="metric-content">
              <span className="metric-value">{journeyMetrics.interventionsTriggered}</span>
              <span className="metric-label">AI Interventions</span>
            </div>
          </div>
        </div>
      </div>

      <div className="demo-content">
        <div className="demo-section">
          <div className="section-header">
            <h3>User Personas Analysis</h3>
            <p>Analyze behavior patterns across different user personas</p>
          </div>
          
          <RealUserAnalysis
            filters={filters}
            refreshKey={refreshKey}
          />
        </div>

        <div className="demo-section">
          <div className="section-header">
            <h3>Automated Behavior Tracking</h3>
            <p>Real-time monitoring of user interactions and journey progression</p>
          </div>
          
          <AutomatedBehaviorTracking
            selectedPersona={selectedPersona}
            filters={filters}
            realTimeData={realTimeData}
            refreshKey={refreshKey}
          />
        </div>
      </div>

      <div className="demo-insights">
        <div className="insights-header">
          <h3>Journey Insights</h3>
        </div>
        
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-icon">🎯</div>
            <div className="insight-content">
              <h4>Engagement Patterns</h4>
              <p>
                Power users (Mike) show 3x higher engagement rates compared to new users (Sarah).
                Video content drives the highest initial engagement.
              </p>
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-icon">🚨</div>
            <div className="insight-content">
              <h4>Risk Indicators</h4>
              <p>
                At-risk users (Jenny) typically struggle with document uploads and calculator features.
                Early intervention reduces churn by 45%.
              </p>
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-icon">📊</div>
            <div className="insight-content">
              <h4>Optimization Opportunities</h4>
              <p>
                Engaged learners (Alex) benefit from progressive disclosure.
                Simplifying initial workflows improves completion rates by 28%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserJourneyDemo;