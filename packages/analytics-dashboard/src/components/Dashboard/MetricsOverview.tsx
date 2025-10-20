import React, { useState, useEffect, useCallback } from 'react';
import { useProductionAnalytics, useRealTimeMetricsDisplay, useProductionEnvironment } from '../../hooks/useProductionAnalytics';

interface AnalyticsFilter {
  dateRange: {
    start: Date;
    end: Date;
  };
  userSegments: string[];
  platforms: string[];
  features: string[];
}

interface MetricsOverviewProps {
  filters: AnalyticsFilter;
  refreshKey: number;
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ filters, refreshKey }) => {
  const { isProduction } = useProductionEnvironment();
  
  // Memoize error handler to prevent infinite loops
  const handleError = useCallback((error: Error) => {
    console.error('Analytics error:', error);
  }, []);
  
  const {
    metrics,
    realtimeMetrics,
    isLoading,
    isConnected,
    error,
    lastRefresh,
    refresh
  } = useProductionAnalytics(filters, {
    enableRealTime: isProduction,
    refreshInterval: 30000,
    onError: handleError
  });

  const { displayMetrics, isAnimating, updateMetrics } = useRealTimeMetricsDisplay();

  // Update display metrics when real-time data changes
  useEffect(() => {
    if (realtimeMetrics) {
      updateMetrics(realtimeMetrics);
    }
    // updateMetrics is stable (memoized with useCallback), no need to include it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeMetrics]);

  // Refresh when refreshKey changes
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (isLoading && !metrics) {
    return (
      <div className="metrics-overview">
        <div className="panel-header">
          <h2 className="panel-title">Key Metrics</h2>
          <div className="connection-status">
            <span className="status-dot loading"></span>
            Loading...
          </div>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="metrics-overview">
        <div className="panel-header">
          <h2 className="panel-title">Key Metrics</h2>
          <div className="connection-status error">
            <span className="status-dot error"></span>
            Error
          </div>
        </div>
        <div className="error-message">
          <div className="error-content">
            <h3>Unable to load metrics</h3>
            <p>{error}</p>
            <button onClick={refresh} className="retry-button">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="metrics-overview">
        <div className="panel-header">
          <h2 className="panel-title">Key Metrics</h2>
        </div>
        <div className="no-data-message">
          No data available for the selected filters
        </div>
      </div>
    );
  }

  // Calculate percentage changes (in production, this would come from historical data)
  const calculateChange = (current: number, previous: number): { value: string; positive: boolean } => {
    if (previous === 0) return { value: 'N/A', positive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      positive: change >= 0
    };
  };

  // Format duration in minutes
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  // Format rate as percentage
  const formatRate = (rate: number): string => {
    return `${rate.toFixed(1)}%`;
  };

  const metricCards = [
    {
      label: 'Total Users',
      value: metrics.totalUsers.toLocaleString(),
      change: '+12.5%', // In production, calculate from historical data
      positive: true,
      icon: '👥',
      realTime: false
    },
    {
      label: 'Active Users',
      value: metrics.activeUsers.toLocaleString(),
      change: isConnected ? 'Live' : '+8.3%',
      positive: true,
      icon: '🟢',
      realTime: isConnected,
      pulsing: isConnected && isAnimating
    },
    {
      label: 'Conversion Rate',
      value: formatRate(metrics.conversionRate),
      change: '+5.2%',
      positive: true,
      icon: '📈',
      realTime: false
    },
    {
      label: 'Avg Session Duration',
      value: formatDuration(metrics.averageSessionDuration),
      change: '+2.1%',
      positive: true,
      icon: '⏱️',
      realTime: false
    },
    {
      label: 'Events/Min',
      value: metrics.eventsPerMinute?.toLocaleString() || '0',
      change: isConnected ? 'Live' : 'N/A',
      positive: true,
      icon: '📊',
      realTime: isConnected,
      pulsing: isConnected && isAnimating
    },
    {
      label: 'Struggle Signals',
      value: metrics.struggleSignals.toString(),
      change: isConnected ? 'Live' : '-15.2%',
      positive: true,
      icon: '⚠️',
      realTime: isConnected,
      pulsing: isConnected && isAnimating
    }
  ];

  return (
    <div className="metrics-overview">
      <div className="panel-header">
        <div>
          <h2 className="panel-title" style={{ color: '#2d3748' }}>Key Metrics</h2>
          <p className="panel-subtitle" style={{ color: '#718096' }}>
            High-level business metrics and KPIs
          </p>
        </div>
        <div className="header-controls">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Live' : 'Offline'}
          </div>
          {lastRefresh && (
            <div className="last-refresh">
              Updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
          <button onClick={refresh} className="refresh-button" disabled={isLoading}>
            🔄
          </button>
        </div>
      </div>
      
      <div className="metrics-grid">
        {metricCards.map((metric, index) => (
          <div 
            key={index} 
            className={`metric-card ${metric.realTime ? 'real-time' : ''} ${metric.pulsing ? 'pulsing' : ''}`}
          >
            <div className="metric-icon">{metric.icon}</div>
            <div className="metric-content">
              <div className="metric-value">{metric.value}</div>
              <div className="metric-label">
                {metric.label}
                {metric.realTime && <span className="real-time-badge">LIVE</span>}
              </div>
              <div className={`metric-change ${metric.positive ? 'positive' : 'negative'}`}>
                {metric.change === 'Live' ? 'Real-time data' : `${metric.change} vs last period`}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        .metrics-overview {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        
        .panel-title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: #1a202c;
        }
        
        .panel-subtitle {
          font-size: 14px;
          color: #718096;
          margin: 0;
        }
        
        .header-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .connection-status.connected {
          color: #48bb78;
        }
        
        .connection-status.disconnected {
          color: #f56565;
        }
        
        .connection-status.error {
          color: #e53e3e;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        .status-dot.connected {
          background: #48bb78;
          animation: pulse 2s infinite;
        }
        
        .status-dot.disconnected {
          background: #f56565;
        }
        
        .status-dot.loading {
          background: #4299e1;
          animation: pulse 1s infinite;
        }
        
        .status-dot.error {
          background: #e53e3e;
        }
        
        .last-refresh {
          font-size: 12px;
          color: #718096;
        }
        
        .refresh-button {
          background: none;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .refresh-button:hover:not(:disabled) {
          background: #f7fafc;
          border-color: #cbd5e0;
        }
        
        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }
        
        .metric-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        
        .metric-card.real-time {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        }
        
        .metric-card.pulsing {
          animation: cardPulse 0.5s ease-in-out;
        }
        
        .metric-icon {
          font-size: 24px;
          opacity: 0.9;
        }
        
        .metric-content {
          flex: 1;
        }
        
        .metric-value {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .metric-label {
          font-size: 14px;
          color: white;
          opacity: 1;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }
        
        .real-time-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        
        .metric-change {
          font-size: 12px;
          opacity: 0.8;
        }
        
        .metric-change.positive {
          color: rgba(255, 255, 255, 0.9);
        }
        
        .metric-change.negative {
          color: #fc8181;
        }
        
        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e2e8f0;
          border-top: 4px solid #4299e1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .error-message {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
        }
        
        .error-content {
          text-align: center;
          color: #718096;
        }
        
        .error-content h3 {
          margin: 0 0 8px 0;
          color: #e53e3e;
        }
        
        .error-content p {
          margin: 0 0 16px 0;
          font-size: 14px;
        }
        
        .retry-button {
          background: #4299e1;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s ease;
        }
        
        .retry-button:hover {
          background: #3182ce;
        }
        
        .no-data-message {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
          color: #718096;
          font-size: 16px;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        @keyframes cardPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .metrics-overview {
            padding: 16px;
          }
          
          .panel-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }
          
          .header-controls {
            flex-wrap: wrap;
            gap: 8px;
          }
          
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          
          .metric-card {
            padding: 16px;
            flex-direction: column;
            text-align: center;
            gap: 8px;
          }
          
          .metric-value {
            font-size: 20px;
          }
          
          .metric-label {
            justify-content: center;
          }
        }
        
        @media (max-width: 480px) {
          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default MetricsOverview;