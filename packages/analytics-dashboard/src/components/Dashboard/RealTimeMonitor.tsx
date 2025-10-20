import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useRealTimeAnalytics, useRealTimeSubscription } from '@aws-agent/shared';
import { RealTimeMetrics as SharedRealTimeMetrics, EventCorrelation, RealTimeUpdate } from '@aws-agent/shared';
import { UserEvent } from '@aws-agent/shared';

interface RealTimeData {
  timestamp: string;
  activeUsers: number;
  eventsPerSecond: number;
  responseTime: number;
}

interface LocalRealTimeMetrics {
  currentUsers: number;
  eventsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  topPages: Array<{
    page: string;
    users: number;
    change: number;
  }>;
  recentEvents: Array<{
    id: string;
    type: string;
    user: string;
    timestamp: Date;
    details: string;
  }>;
}

interface RealTimeMonitorProps {
  onClose: () => void;
}

const RealTimeMonitor: React.FC<RealTimeMonitorProps> = ({ onClose }) => {
  const [realTimeData, setRealTimeData] = useState<RealTimeData[]>([]);
  const [localMetrics, setLocalMetrics] = useState<LocalRealTimeMetrics>({
    currentUsers: 0,
    eventsPerMinute: 0,
    averageResponseTime: 0,
    errorRate: 0,
    topPages: [],
    recentEvents: []
  });

  // Get WebSocket URL from environment or use default
  const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080/ws';
  
  // Use real-time analytics service
  const {
    isConnected,
    isConnecting,
    metrics: sharedMetrics,
    recentEvents,
    correlations,
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
      console.log(`Real-time analytics ${connected ? 'connected' : 'disconnected'}`);
    },
    onError: (error) => {
      console.error('Real-time analytics error:', error);
    }
  });

  // Subscribe to real-time updates
  useRealTimeSubscription(
    service,
    'metrics_updated',
    (update: RealTimeUpdate) => {
      if (update.metrics) {
        updateLocalMetricsFromShared(update.metrics);
      }
    }
  );

  useRealTimeSubscription(
    service,
    'event_processed',
    (update: RealTimeUpdate) => {
      if (update.event) {
        addRecentEvent(update.event);
      }
      if (update.metrics) {
        updateLocalMetricsFromShared(update.metrics);
      }
    }
  );

  useRealTimeSubscription(
    service,
    'struggle_detected',
    (update: RealTimeUpdate) => {
      console.log('🚨 Struggle detected:', update);
    }
  );

  // Initialize data and set up real-time chart updates
  useEffect(() => {
    // Initialize with some data for the chart
    const initialData = generateInitialData();
    setRealTimeData(initialData);
    
    // Initialize local metrics
    if (sharedMetrics) {
      updateLocalMetricsFromShared(sharedMetrics);
    } else {
      setLocalMetrics(generateInitialMetrics());
    }

    // Update chart data every 2 seconds
    const interval = setInterval(() => {
      updateRealTimeData();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [sharedMetrics]);

  const generateInitialData = (): RealTimeData[] => {
    const data: RealTimeData[] = [];
    const now = Date.now();
    
    for (let i = 29; i >= 0; i--) {
      const timestamp = new Date(now - i * 2000).toISOString();
      data.push({
        timestamp,
        activeUsers: Math.floor(Math.random() * 50) + 800,
        eventsPerSecond: Math.floor(Math.random() * 20) + 10,
        responseTime: Math.floor(Math.random() * 100) + 150
      });
    }
    
    return data;
  };

  const generateInitialMetrics = (): LocalRealTimeMetrics => {
    return {
      currentUsers: 847,
      eventsPerMinute: 1240,
      averageResponseTime: 185,
      errorRate: 0.8,
      topPages: [
        { page: '/dashboard', users: 234, change: 12 },
        { page: '/calculator', users: 189, change: -5 },
        { page: '/video-library', users: 156, change: 8 },
        { page: '/document-upload', users: 98, change: 15 },
        { page: '/profile', users: 67, change: -2 }
      ],
      recentEvents: [
        {
          id: '1',
          type: 'page_view',
          user: 'user_8472',
          timestamp: new Date(Date.now() - 5000),
          details: 'Viewed calculator page'
        },
        {
          id: '2',
          type: 'feature_interaction',
          user: 'user_9183',
          timestamp: new Date(Date.now() - 8000),
          details: 'Completed loan calculation'
        },
        {
          id: '3',
          type: 'struggle_signal',
          user: 'user_7291',
          timestamp: new Date(Date.now() - 12000),
          details: 'Multiple failed upload attempts'
        },
        {
          id: '4',
          type: 'video_engagement',
          user: 'user_5647',
          timestamp: new Date(Date.now() - 15000),
          details: 'Watched tutorial video to completion'
        }
      ]
    };
  };

  const updateRealTimeData = () => {
    setRealTimeData(prev => {
      const newData = [...prev.slice(1)];
      newData.push({
        timestamp: new Date().toISOString(),
        activeUsers: Math.floor(Math.random() * 50) + 800,
        eventsPerSecond: Math.floor(Math.random() * 20) + 10,
        responseTime: Math.floor(Math.random() * 100) + 150
      });
      return newData;
    });
  };

  // Convert shared metrics to local metrics format
  const updateLocalMetricsFromShared = (sharedMetrics: SharedRealTimeMetrics) => {
    setLocalMetrics(prev => ({
      ...prev,
      currentUsers: sharedMetrics.activeUsers,
      eventsPerMinute: sharedMetrics.eventsPerMinute,
      averageResponseTime: sharedMetrics.averageResponseTime,
      errorRate: sharedMetrics.errorRate,
    }));
  };

  // Add recent event from real-time updates
  const addRecentEvent = (event: UserEvent) => {
    const eventDetails = getEventDetails(event);
    
    setLocalMetrics(prev => ({
      ...prev,
      recentEvents: [
        {
          id: event.eventId,
          type: event.eventType,
          user: event.userId,
          timestamp: event.timestamp,
          details: eventDetails
        },
        ...prev.recentEvents.slice(0, 9) // Keep last 10 events
      ]
    }));
  };

  // Get human-readable event details
  const getEventDetails = (event: UserEvent): string => {
    switch (event.eventType) {
      case 'page_view':
        return `Viewed ${event.eventData.feature || 'page'}`;
      case 'feature_interaction':
        return event.eventData.success 
          ? `Completed ${event.eventData.feature}` 
          : `Failed ${event.eventData.feature}`;
      case 'video_engagement':
        return `Watched video ${event.eventData.videoId || 'content'}`;
      case 'struggle_signal':
        return `Struggling with ${event.eventData.feature} (${event.eventData.attemptCount} attempts)`;
      default:
        return `${event.eventType} event`;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'page_view': return '👁️';
      case 'feature_interaction': return '🎯';
      case 'video_engagement': return '🎥';
      case 'struggle_signal': return '⚠️';
      default: return '📊';
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'page_view': return '#667eea';
      case 'feature_interaction': return '#48bb78';
      case 'video_engagement': return '#ed8936';
      case 'struggle_signal': return '#f56565';
      default: return '#718096';
    }
  };

  return (
    <div className="realtime-monitor-overlay">
      <div className="realtime-monitor">
        <div className="monitor-header">
          <div className="header-title">
            <h2>Real-Time Analytics Monitor</h2>
            <div className="connection-status">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span>{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
          </div>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="monitor-content">
          {/* Real-time Metrics */}
          <div className="metrics-section">
            <div className="metric-card">
              <div className="metric-value">{localMetrics.currentUsers.toLocaleString()}</div>
              <div className="metric-label">Active Users</div>
              <div className="metric-trend positive">↗ Live</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{localMetrics.eventsPerMinute.toLocaleString()}</div>
              <div className="metric-label">Events/Min</div>
              <div className="metric-trend positive">↗ +5.2%</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{localMetrics.averageResponseTime}ms</div>
              <div className="metric-label">Avg Response</div>
              <div className="metric-trend negative">↗ +12ms</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{localMetrics.errorRate.toFixed(1)}%</div>
              <div className="metric-label">Error Rate</div>
              <div className="metric-trend positive">↘ -0.3%</div>
            </div>
          </div>

          {/* Real-time Chart */}
          <div className="chart-section">
            <h3>Active Users (Last 60 seconds)</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={realTimeData}>
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString().slice(-8, -3)}
                    stroke="#718096"
                    fontSize={12}
                  />
                  <YAxis stroke="#718096" fontSize={12} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    formatter={(value) => [value, 'Active Users']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="activeUsers" 
                    stroke="#667eea" 
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bottom-section">
            {/* Top Pages */}
            <div className="top-pages">
              <h3>Top Pages (Live)</h3>
              <div className="pages-list">
                {localMetrics.topPages.map((page, index) => (
                  <div key={page.page} className="page-item">
                    <div className="page-rank">#{index + 1}</div>
                    <div className="page-info">
                      <div className="page-name">{page.page}</div>
                      <div className="page-users">{page.users} users</div>
                    </div>
                    <div className={`page-change ${page.change >= 0 ? 'positive' : 'negative'}`}>
                      {page.change >= 0 ? '+' : ''}{page.change}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Events */}
            <div className="recent-events">
              <h3>Live Event Stream</h3>
              <div className="events-list">
                {localMetrics.recentEvents.map((event) => (
                  <div key={event.id} className="event-item">
                    <div 
                      className="event-icon"
                      style={{ color: getEventTypeColor(event.type) }}
                    >
                      {getEventTypeIcon(event.type)}
                    </div>
                    <div className="event-info">
                      <div className="event-details">{event.details}</div>
                      <div className="event-meta">
                        {event.user} • {event.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .realtime-monitor-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .realtime-monitor {
          background: white;
          border-radius: 16px;
          width: 95%;
          max-width: 1200px;
          height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-title h2 {
          margin: 0;
          font-size: 20px;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-dot.connected {
          background: #48bb78;
        }

        .status-dot.disconnected {
          background: #f56565;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .close-button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
          font-size: 18px;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .monitor-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .metrics-section {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .metric-card {
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          text-align: center;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .metric-label {
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .metric-trend {
          font-size: 12px;
          font-weight: 500;
        }

        .metric-trend.positive {
          color: #48bb78;
        }

        .metric-trend.negative {
          color: #f56565;
        }

        .chart-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }

        .chart-section h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #2d3748;
        }

        .chart-container {
          height: 200px;
        }

        .bottom-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .top-pages,
        .recent-events {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }

        .top-pages h3,
        .recent-events h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #2d3748;
        }

        .pages-list,
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 200px;
          overflow-y: auto;
        }

        .page-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          border-radius: 6px;
          transition: background-color 0.2s;
        }

        .page-item:hover {
          background: #f7fafc;
        }

        .page-rank {
          width: 24px;
          height: 24px;
          background: #667eea;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .page-info {
          flex: 1;
        }

        .page-name {
          font-weight: 500;
          color: #2d3748;
          font-size: 14px;
        }

        .page-users {
          font-size: 12px;
          color: #718096;
        }

        .page-change {
          font-size: 12px;
          font-weight: 500;
        }

        .page-change.positive {
          color: #48bb78;
        }

        .page-change.negative {
          color: #f56565;
        }

        .event-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 8px;
          border-radius: 6px;
          transition: background-color 0.2s;
        }

        .event-item:hover {
          background: #f7fafc;
        }

        .event-icon {
          font-size: 16px;
          margin-top: 2px;
        }

        .event-info {
          flex: 1;
        }

        .event-details {
          font-size: 14px;
          color: #2d3748;
          margin-bottom: 2px;
        }

        .event-meta {
          font-size: 12px;
          color: #718096;
        }

        @media (max-width: 768px) {
          .realtime-monitor {
            width: 95%;
            height: 90vh;
          }

          .metrics-section {
            grid-template-columns: repeat(2, 1fr);
          }

          .bottom-section {
            grid-template-columns: 1fr;
          }

          .monitor-content {
            padding: 15px;
          }
        }
      `}</style>
    </div>
  );
};

export default RealTimeMonitor;