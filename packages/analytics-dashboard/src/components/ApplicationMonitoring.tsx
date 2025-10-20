import React, { useState, useEffect } from 'react';

interface ApplicationHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  alerts: Array<{
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

const ApplicationMonitoring: React.FC = () => {
  const [health, setHealth] = useState<ApplicationHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadHealthData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadHealthData, 10000); // Refresh every 10 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadHealthData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/monitoring/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const healthData = await response.json();
      setHealth(healthData);
      setError(null);
    } catch (err) {
      setError('Failed to load application health data');
      console.error('Application monitoring error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#28a745';
      case 'warning': return '#ffc107';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getAlertIcon = (level: string): string => {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '🚨';
      default: return '📋';
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  if (loading && !health) {
    return (
      <div className="app-monitoring">
        <div className="app-monitoring__loading">
          <div className="spinner"></div>
          <p>Loading application health...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-monitoring">
        <div className="app-monitoring__error">
          <p>{error}</p>
          <button onClick={loadHealthData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-monitoring">
      <div className="app-monitoring__header">
        <h2>Application Health</h2>
        <div className="app-monitoring__controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={loadHealthData} className="refresh-button">
            Refresh
          </button>
        </div>
      </div>

      {health && (
        <div className="app-monitoring__content">
          {/* Overall Status */}
          <div className="status-overview">
            <div className="status-indicator">
              <div 
                className="status-circle"
                style={{ backgroundColor: getStatusColor(health.status) }}
              ></div>
              <div className="status-text">
                <h3>System Status</h3>
                <p className="status-label">{health.status.toUpperCase()}</p>
              </div>
            </div>
            
            <div className="status-metrics">
              <div className="status-metric">
                <span className="metric-label">Uptime</span>
                <span className="metric-value">{formatUptime(health.uptime)}</span>
              </div>
              <div className="status-metric">
                <span className="metric-label">Response Time</span>
                <span className="metric-value">{health.responseTime}ms</span>
              </div>
              <div className="status-metric">
                <span className="metric-label">Active Users</span>
                <span className="metric-value">{health.activeUsers}</span>
              </div>
            </div>
          </div>

          {/* System Metrics */}
          <div className="metrics-section">
            <h3>System Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <h4>CPU Usage</h4>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ 
                      width: `${health.systemMetrics.cpuUsage}%`,
                      backgroundColor: health.systemMetrics.cpuUsage > 80 ? '#dc3545' : 
                                     health.systemMetrics.cpuUsage > 60 ? '#ffc107' : '#28a745'
                    }}
                  ></div>
                </div>
                <span className="metric-percentage">
                  {formatPercentage(health.systemMetrics.cpuUsage)}
                </span>
              </div>

              <div className="metric-card">
                <h4>Memory Usage</h4>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ 
                      width: `${health.systemMetrics.memoryUsage}%`,
                      backgroundColor: health.systemMetrics.memoryUsage > 80 ? '#dc3545' : 
                                     health.systemMetrics.memoryUsage > 60 ? '#ffc107' : '#28a745'
                    }}
                  ></div>
                </div>
                <span className="metric-percentage">
                  {formatPercentage(health.systemMetrics.memoryUsage)}
                </span>
              </div>

              <div className="metric-card">
                <h4>Disk Usage</h4>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ 
                      width: `${health.systemMetrics.diskUsage}%`,
                      backgroundColor: health.systemMetrics.diskUsage > 80 ? '#dc3545' : 
                                     health.systemMetrics.diskUsage > 60 ? '#ffc107' : '#28a745'
                    }}
                  ></div>
                </div>
                <span className="metric-percentage">
                  {formatPercentage(health.systemMetrics.diskUsage)}
                </span>
              </div>

              <div className="metric-card">
                <h4>Error Rate</h4>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ 
                      width: `${Math.min(health.errorRate * 10, 100)}%`,
                      backgroundColor: health.errorRate > 5 ? '#dc3545' : 
                                     health.errorRate > 1 ? '#ffc107' : '#28a745'
                    }}
                  ></div>
                </div>
                <span className="metric-percentage">
                  {formatPercentage(health.errorRate)}
                </span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="alerts-section">
            <h3>Active Alerts</h3>
            {health.alerts.length > 0 ? (
              <div className="alerts-list">
                {health.alerts.map((alert) => (
                  <div key={alert.id} className={`alert-item alert-item--${alert.level}`}>
                    <div className="alert-icon">{getAlertIcon(alert.level)}</div>
                    <div className="alert-content">
                      <div className="alert-message">{alert.message}</div>
                      <div className="alert-time">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-alerts">No active alerts</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="actions-section">
            <h3>Quick Actions</h3>
            <div className="actions-grid">
              <button className="action-button" onClick={() => window.open('/api/monitoring/logs')}>
                View Logs
              </button>
              <button className="action-button" onClick={() => window.open('/api/monitoring/metrics')}>
                Detailed Metrics
              </button>
              <button className="action-button" onClick={() => window.open('/api/monitoring/traces')}>
                Request Traces
              </button>
              <button className="action-button action-button--danger" onClick={() => {
                if (confirm('Are you sure you want to restart the application?')) {
                  fetch('/api/monitoring/restart', { method: 'POST' });
                }
              }}>
                Restart App
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .app-monitoring {
          padding: 1rem;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .app-monitoring__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          background: white;
          padding: 1rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .app-monitoring__controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
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

        .app-monitoring__loading,
        .app-monitoring__error {
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

        .status-overview {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .status-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-text h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #212529;
        }

        .status-label {
          margin: 0.25rem 0 0 0;
          font-weight: 600;
          font-size: 0.875rem;
          color: #6c757d;
        }

        .status-metrics {
          display: flex;
          gap: 2rem;
        }

        .status-metric {
          text-align: center;
        }

        .metric-label {
          display: block;
          font-size: 0.875rem;
          color: #6c757d;
          margin-bottom: 0.25rem;
        }

        .metric-value {
          display: block;
          font-size: 1.5rem;
          font-weight: bold;
          color: #212529;
        }

        .metrics-section,
        .alerts-section,
        .actions-section {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 1rem;
        }

        .metrics-section h3,
        .alerts-section h3,
        .actions-section h3 {
          margin: 0 0 1rem 0;
          color: #212529;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .metric-card {
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .metric-card h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          color: #495057;
        }

        .metric-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .metric-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .metric-percentage {
          font-size: 0.875rem;
          font-weight: 600;
          color: #495057;
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .alert-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid;
        }

        .alert-item--info {
          background: #d1ecf1;
          border-left-color: #17a2b8;
        }

        .alert-item--warning {
          background: #fff3cd;
          border-left-color: #ffc107;
        }

        .alert-item--error {
          background: #f8d7da;
          border-left-color: #dc3545;
        }

        .alert-icon {
          font-size: 1.25rem;
        }

        .alert-content {
          flex: 1;
        }

        .alert-message {
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: #212529;
        }

        .alert-time {
          font-size: 0.875rem;
          color: #6c757d;
        }

        .no-alerts {
          text-align: center;
          color: #6c757d;
          font-style: italic;
          margin: 2rem 0;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .action-button {
          padding: 0.75rem 1rem;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: background-color 0.2s ease;
        }

        .action-button:hover {
          background: #0056b3;
        }

        .action-button--danger {
          background: #dc3545;
        }

        .action-button--danger:hover {
          background: #c82333;
        }
      `}</style>
    </div>
  );
};

export default ApplicationMonitoring;