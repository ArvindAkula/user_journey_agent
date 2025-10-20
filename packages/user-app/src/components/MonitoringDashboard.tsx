import React, { useState, useEffect } from 'react';
import { ErrorReportingService } from '@aws-agent/shared';

interface MonitoringStats {
  errorCount: number;
  errorRate: number;
  performanceMetrics: {
    averageLoadTime: number;
    averageRenderTime: number;
    memoryUsage: number;
  };
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: string;
  }>;
  recentEvents: Array<{
    type: string;
    timestamp: string;
    data: any;
  }>;
}

const MonitoringDashboard: React.FC = () => {
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1h');

  useEffect(() => {
    loadMonitoringStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(loadMonitoringStats, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadMonitoringStats = async () => {
    try {
      setLoading(true);
      const errorReportingService = new ErrorReportingService();
      
      // Fetch error metrics
      const errorMetrics = await errorReportingService.getErrorMetrics(timeRange);
      
      // Fetch performance metrics
      const performanceResponse = await fetch(`/api/monitoring/performance?timeRange=${timeRange}`);
      const performanceData = await performanceResponse.json();
      
      // Fetch recent events
      const eventsResponse = await fetch(`/api/monitoring/events?timeRange=${timeRange}&limit=10`);
      const eventsData = await eventsResponse.json();

      setStats({
        errorCount: errorMetrics.errorCount,
        errorRate: errorMetrics.errorRate,
        performanceMetrics: {
          averageLoadTime: performanceData.averageLoadTime || 0,
          averageRenderTime: performanceData.averageRenderTime || 0,
          memoryUsage: performanceData.memoryUsage || 0
        },
        topErrors: errorMetrics.topErrors,
        recentEvents: eventsData.events || []
      });
      
      setError(null);
    } catch (err) {
      setError('Failed to load monitoring data');
      console.error('Monitoring dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }): string => {
    if (value <= thresholds.good) return '#28a745';
    if (value <= thresholds.warning) return '#ffc107';
    return '#dc3545';
  };

  if (loading && !stats) {
    return (
      <div className="monitoring-dashboard">
        <div className="monitoring-dashboard__loading">
          <div className="spinner"></div>
          <p>Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitoring-dashboard">
        <div className="monitoring-dashboard__error">
          <p>{error}</p>
          <button onClick={loadMonitoringStats}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="monitoring-dashboard">
      <div className="monitoring-dashboard__header">
        <h2>Application Monitoring</h2>
        <div className="monitoring-dashboard__controls">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button onClick={loadMonitoringStats} className="refresh-button">
            Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="monitoring-dashboard__content">
          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>Error Rate</h3>
              <div 
                className="metric-value"
                style={{ color: getStatusColor(stats.errorRate, { good: 1, warning: 5 }) }}
              >
                {stats.errorRate.toFixed(2)}%
              </div>
              <div className="metric-subtitle">
                {stats.errorCount} errors
              </div>
            </div>

            <div className="metric-card">
              <h3>Load Time</h3>
              <div 
                className="metric-value"
                style={{ color: getStatusColor(stats.performanceMetrics.averageLoadTime, { good: 2000, warning: 5000 }) }}
              >
                {formatDuration(stats.performanceMetrics.averageLoadTime)}
              </div>
              <div className="metric-subtitle">Average</div>
            </div>

            <div className="metric-card">
              <h3>Render Time</h3>
              <div 
                className="metric-value"
                style={{ color: getStatusColor(stats.performanceMetrics.averageRenderTime, { good: 100, warning: 500 }) }}
              >
                {formatDuration(stats.performanceMetrics.averageRenderTime)}
              </div>
              <div className="metric-subtitle">Average</div>
            </div>

            <div className="metric-card">
              <h3>Memory Usage</h3>
              <div 
                className="metric-value"
                style={{ color: getStatusColor(stats.performanceMetrics.memoryUsage, { good: 50 * 1024 * 1024, warning: 100 * 1024 * 1024 }) }}
              >
                {formatMemory(stats.performanceMetrics.memoryUsage)}
              </div>
              <div className="metric-subtitle">Current</div>
            </div>
          </div>

          {/* Top Errors */}
          <div className="monitoring-section">
            <h3>Top Errors</h3>
            {stats.topErrors.length > 0 ? (
              <div className="errors-list">
                {stats.topErrors.map((error, index) => (
                  <div key={index} className="error-item">
                    <div className="error-message">{error.message}</div>
                    <div className="error-meta">
                      <span className="error-count">{error.count} occurrences</span>
                      <span className="error-time">
                        Last: {new Date(error.lastOccurred).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No errors in the selected time range</p>
            )}
          </div>

          {/* Recent Events */}
          <div className="monitoring-section">
            <h3>Recent Events</h3>
            {stats.recentEvents.length > 0 ? (
              <div className="events-list">
                {stats.recentEvents.map((event, index) => (
                  <div key={index} className="event-item">
                    <div className="event-type">{event.type}</div>
                    <div className="event-time">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                    <div className="event-data">
                      {JSON.stringify(event.data, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No recent events</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        .monitoring-dashboard {
          padding: 1rem;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .monitoring-dashboard__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          background: white;
          padding: 1rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .monitoring-dashboard__controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .time-range-select {
          padding: 0.5rem;
          border: 1px solid #ced4da;
          border-radius: 4px;
          background: white;
        }

        .refresh-button {
          padding: 0.5rem 1rem;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .refresh-button:hover {
          background: #0056b3;
        }

        .monitoring-dashboard__loading,
        .monitoring-dashboard__error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .metric-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .metric-card h3 {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          color: #6c757d;
          text-transform: uppercase;
          font-weight: 600;
        }

        .metric-value {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 0.25rem;
        }

        .metric-subtitle {
          font-size: 0.75rem;
          color: #6c757d;
        }

        .monitoring-section {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 1rem;
        }

        .monitoring-section h3 {
          margin: 0 0 1rem 0;
          color: #212529;
        }

        .errors-list,
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .error-item,
        .event-item {
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 4px solid #dc3545;
        }

        .event-item {
          border-left-color: #17a2b8;
        }

        .error-message,
        .event-type {
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #212529;
        }

        .error-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: #6c757d;
        }

        .event-time {
          font-size: 0.875rem;
          color: #6c757d;
          margin-bottom: 0.5rem;
        }

        .event-data {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.75rem;
          background: white;
          padding: 0.5rem;
          border-radius: 4px;
          white-space: pre-wrap;
          overflow-x: auto;
        }

        .no-data {
          text-align: center;
          color: #6c757d;
          font-style: italic;
          margin: 2rem 0;
        }
      `}</style>
    </div>
  );
};

export default MonitoringDashboard;