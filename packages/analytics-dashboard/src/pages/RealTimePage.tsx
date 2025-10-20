import React, { useState } from 'react';
import { useRealTimeAnalytics, useRealTimeSubscription } from '@aws-agent/shared';
import { RealTimeUpdate } from '@aws-agent/shared';
import RealTimeMonitor from '../components/Dashboard/RealTimeMonitor';

const RealTimePage: React.FC = () => {
  const [showMonitor, setShowMonitor] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  // Get WebSocket URL from environment
  const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080/ws';
  
  // Set up real-time analytics
  const {
    isConnected,
    isConnecting,
    metrics,
    correlations,
    recentEvents,
    connectionStatus,
    error,
    connect,
    disconnect,
    service
  } = useRealTimeAnalytics({
    websocketUrl,
    autoConnect: true,
    enableEventCorrelation: true,
    onConnectionChange: (connected) => {
      console.log(`Real-time analytics dashboard ${connected ? 'connected' : 'disconnected'}`);
    },
    onError: (error) => {
      console.error('Real-time analytics dashboard error:', error);
    }
  });

  // Subscribe to struggle signals for alerts
  useRealTimeSubscription(
    service,
    'struggle_detected',
    (update: RealTimeUpdate) => {
      setAlertsCount(prev => prev + 1);
      setRecentAlerts(prev => [
        {
          id: Date.now(),
          type: 'struggle',
          message: `User ${update.event?.userId} struggling with ${update.event?.eventData.feature}`,
          timestamp: new Date(),
          severity: update.insights?.severity || 'medium',
          data: update
        },
        ...prev.slice(0, 9) // Keep last 10 alerts
      ]);
    }
  );

  // Subscribe to high-value events
  useRealTimeSubscription(
    service,
    'event_processed',
    (update: RealTimeUpdate) => {
      if (update.event?.eventType === 'feature_interaction' && update.event.eventData.success) {
        // Track successful interactions
        console.log('✅ Successful interaction:', update.event);
      }
    }
  );

  const getConnectionStatusColor = () => {
    if (isConnecting) return '#f59e0b'; // amber
    return isConnected ? '#10b981' : '#ef4444'; // green or red
  };

  const getConnectionStatusText = () => {
    if (isConnecting) return 'Connecting...';
    return isConnected ? 'Connected' : 'Disconnected';
  };

  return (
    <div className="realtime-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Real-Time Analytics</h1>
          <div className="header-actions">
            <div className="connection-indicator">
              <div 
                className="status-dot"
                style={{ backgroundColor: getConnectionStatusColor() }}
              />
              <span>{getConnectionStatusText()}</span>
            </div>
            <button 
              className="monitor-button"
              onClick={() => setShowMonitor(true)}
              disabled={!isConnected}
            >
              Open Live Monitor
            </button>
          </div>
        </div>
      </div>

      <div className="realtime-content">
        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-card">
            <div className="stat-value">{metrics?.activeUsers || 0}</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{metrics?.eventsPerMinute || 0}</div>
            <div className="stat-label">Events/Min</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{correlations.length}</div>
            <div className="stat-label">Active Sessions</div>
          </div>
          <div className="stat-card alert-card">
            <div className="stat-value">{alertsCount}</div>
            <div className="stat-label">Alerts Today</div>
          </div>
        </div>

        {/* Connection Status */}
        {error && (
          <div className="error-banner">
            <h3>Connection Error</h3>
            <p>{error.message}</p>
            <button onClick={connect}>Retry Connection</button>
          </div>
        )}

        <div className="realtime-grid">
          {/* Recent Events */}
          <div className="realtime-section">
            <h2>Live Event Stream</h2>
            <div className="events-stream">
              {recentEvents.slice(0, 10).map((event, index) => (
                <div key={`${event.eventId}-${index}`} className="event-item">
                  <div className="event-icon">
                    {event.eventType === 'page_view' && '👁️'}
                    {event.eventType === 'feature_interaction' && '🎯'}
                    {event.eventType === 'video_engagement' && '🎥'}
                    {event.eventType === 'struggle_signal' && '⚠️'}
                  </div>
                  <div className="event-details">
                    <div className="event-type">{event.eventType}</div>
                    <div className="event-user">User: {event.userId}</div>
                    <div className="event-time">
                      {event.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <div className="no-events">
                  <p>No recent events. Waiting for user activity...</p>
                </div>
              )}
            </div>
          </div>

          {/* User Correlations */}
          <div className="realtime-section">
            <h2>Active User Sessions</h2>
            <div className="correlations-list">
              {correlations.slice(0, 5).map((correlation) => (
                <div key={correlation.userId} className="correlation-item">
                  <div className="correlation-header">
                    <span className="user-id">{correlation.userId}</span>
                    <span className="session-time">
                      {new Date(correlation.lastActivity).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="correlation-stats">
                    <span>Events: {correlation.eventSequence.length}</span>
                    <span>Struggles: {correlation.strugglesDetected}</span>
                    <span>Completed: {correlation.completedActions}</span>
                  </div>
                  {correlation.strugglesDetected > 0 && (
                    <div className="struggle-indicator">
                      ⚠️ User may need assistance
                    </div>
                  )}
                </div>
              ))}
              {correlations.length === 0 && (
                <div className="no-correlations">
                  <p>No active user sessions.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="realtime-section">
            <h2>Recent Alerts</h2>
            <div className="alerts-list">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className={`alert-item ${alert.severity}`}>
                  <div className="alert-icon">
                    {alert.type === 'struggle' && '🚨'}
                  </div>
                  <div className="alert-content">
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-time">
                      {alert.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {recentAlerts.length === 0 && (
                <div className="no-alerts">
                  <p>No recent alerts.</p>
                </div>
              )}
            </div>
          </div>

          {/* Connection Status Details */}
          <div className="realtime-section">
            <h2>Connection Status</h2>
            <div className="connection-details">
              <div className="detail-item">
                <span>Status:</span>
                <span className={isConnected ? 'connected' : 'disconnected'}>
                  {getConnectionStatusText()}
                </span>
              </div>
              <div className="detail-item">
                <span>Reconnect Attempts:</span>
                <span>{connectionStatus.reconnectAttempts}</span>
              </div>
              <div className="detail-item">
                <span>Buffered Events:</span>
                <span>{connectionStatus.bufferedEvents}</span>
              </div>
              <div className="detail-item">
                <span>Active Correlations:</span>
                <span>{connectionStatus.activeCorrelations}</span>
              </div>
            </div>
            <div className="connection-actions">
              {isConnected ? (
                <button onClick={disconnect} className="disconnect-btn">
                  Disconnect
                </button>
              ) : (
                <button onClick={connect} className="connect-btn">
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Monitor Modal */}
      {showMonitor && (
        <RealTimeMonitor onClose={() => setShowMonitor(false)} />
      )}

      <style>{`
        .realtime-page {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 30px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-content h1 {
          margin: 0;
          color: #1a202c;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .connection-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f7fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .monitor-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: transform 0.2s;
        }

        .monitor-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .monitor-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quick-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          text-align: center;
        }

        .stat-card.alert-card {
          background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          color: #718096;
          text-transform: uppercase;
          font-weight: 500;
        }

        .error-banner {
          background: #fed7d7;
          border: 1px solid #fc8181;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .error-banner h3 {
          margin: 0 0 8px 0;
          color: #c53030;
        }

        .error-banner p {
          margin: 0 0 12px 0;
          color: #742a2a;
        }

        .error-banner button {
          background: #c53030;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .realtime-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .realtime-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }

        .realtime-section h2 {
          margin: 0 0 16px 0;
          font-size: 18px;
          color: #1a202c;
        }

        .events-stream,
        .correlations-list,
        .alerts-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .event-item,
        .correlation-item,
        .alert-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
          transition: background-color 0.2s;
        }

        .event-item:hover,
        .correlation-item:hover {
          background: #f7fafc;
        }

        .event-icon {
          font-size: 16px;
        }

        .event-details {
          flex: 1;
        }

        .event-type {
          font-weight: 500;
          color: #2d3748;
        }

        .event-user,
        .event-time {
          font-size: 12px;
          color: #718096;
        }

        .correlation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          margin-bottom: 4px;
        }

        .user-id {
          font-weight: 500;
          color: #2d3748;
        }

        .session-time {
          font-size: 12px;
          color: #718096;
        }

        .correlation-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #718096;
        }

        .struggle-indicator {
          font-size: 12px;
          color: #c53030;
          font-weight: 500;
          margin-top: 4px;
        }

        .alert-item {
          border-left: 4px solid #f56565;
        }

        .alert-item.high {
          border-left-color: #e53e3e;
          background: #fed7d7;
        }

        .alert-item.medium {
          border-left-color: #f56565;
          background: #fef5e7;
        }

        .alert-item.low {
          border-left-color: #f6ad55;
          background: #f0fff4;
        }

        .alert-content {
          flex: 1;
        }

        .alert-message {
          font-weight: 500;
          color: #2d3748;
        }

        .alert-time {
          font-size: 12px;
          color: #718096;
        }

        .connection-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .detail-item:last-child {
          border-bottom: none;
        }

        .connected {
          color: #38a169;
          font-weight: 500;
        }

        .disconnected {
          color: #e53e3e;
          font-weight: 500;
        }

        .connection-actions {
          margin-top: 16px;
        }

        .connect-btn,
        .disconnect-btn {
          width: 100%;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .connect-btn {
          background: #38a169;
          color: white;
        }

        .disconnect-btn {
          background: #e53e3e;
          color: white;
        }

        .no-events,
        .no-correlations,
        .no-alerts {
          text-align: center;
          color: #718096;
          padding: 40px 20px;
        }

        @media (max-width: 768px) {
          .quick-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .realtime-grid {
            grid-template-columns: 1fr;
          }

          .header-content {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default RealTimePage;