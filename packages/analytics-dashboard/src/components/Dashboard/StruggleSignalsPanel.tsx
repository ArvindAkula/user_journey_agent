import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '@aws-agent/shared';

interface StruggleSignalData {
  featureId: string;
  featureName: string;
  signalCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'increasing' | 'decreasing' | 'stable';
  detectedAt?: number;
  description?: string;
  recommendedActions?: string[];
  exitRiskScore?: number;
}

interface AnalyticsFilter {
  dateRange: {
    start: Date;
    end: Date;
  };
  userSegments: string[];
  platforms: string[];
  features: string[];
}

interface StruggleSignalsPanelProps {
  filters: AnalyticsFilter;
  refreshKey: number;
}

const StruggleSignalsPanel: React.FC<StruggleSignalsPanelProps> = ({ filters, refreshKey }) => {
  const [signals, setSignals] = useState<StruggleSignalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSignals();
  }, [filters, refreshKey]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const loadSignals = async () => {
    try {
      setLoading(true);
      setError(null);
      const analyticsService = new AnalyticsService({
        baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080'
      });
      const data = await analyticsService.getStruggleSignals(filters);
      setSignals(data);
    } catch (err) {
      setError('Failed to load struggle signals');
      console.error('Error loading struggle signals:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#9b2c2c';
      case 'high': return '#c53030';
      case 'medium': return '#dd6b20';
      case 'low': return '#2f855a';
      default: return '#718096';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '↗️';
      case 'decreasing': return '↘️';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return '#f56565';
      case 'decreasing': return '#48bb78';
      case 'stable': return '#718096';
      default: return '#718096';
    }
  };

  if (loading) {
    return (
      <div className="struggle-signals-panel">
        <div className="panel-header">
          <h2 className="panel-title">Struggle Signals</h2>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="struggle-signals-panel">
        <div className="panel-header">
          <h2 className="panel-title">Struggle Signals</h2>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  const totalSignals = signals.reduce((sum, signal) => sum + signal.signalCount, 0);
  const criticalSignals = signals.filter(s => s.severity === 'critical' || s.severity === 'high').length;

  return (
    <div className="struggle-signals-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Struggle Signals</h2>
          <p className="panel-subtitle">User friction detection</p>
        </div>
        <div className="signal-summary">
          <div className="total-signals">{totalSignals}</div>
          <div className="critical-count">{criticalSignals} critical</div>
        </div>
      </div>

      <div className="signals-list">
        {signals.map((signal, index) => (
          <div key={signal.featureId} className="signal-item">
            <div className="signal-info">
              <div className="signal-header">
                <span className="feature-name">{signal.featureName}</span>
                <span 
                  className="severity-badge"
                  style={{ backgroundColor: getSeverityColor(signal.severity) }}
                >
                  {signal.severity.toUpperCase()}
                </span>
              </div>
              <div className="signal-details">
                <span className="signal-count">{signal.signalCount} signals</span>
                <span 
                  className="trend-indicator"
                  style={{ color: getTrendColor(signal.trend) }}
                >
                  {getTrendIcon(signal.trend)} {signal.trend}
                </span>
              </div>
              {signal.exitRiskScore !== undefined && (
                <div className="exit-risk">
                  <span className="risk-label">Exit Risk:</span>
                  <span className="risk-score">{signal.exitRiskScore}</span>
                </div>
              )}
              {signal.detectedAt && (
                <div className="detected-at">
                  <span className="detected-label">Detected:</span>
                  <span className="detected-time">{formatTimestamp(signal.detectedAt)}</span>
                </div>
              )}
              {signal.description && (
                <div className="signal-description">
                  {signal.description}
                </div>
              )}
              {signal.recommendedActions && signal.recommendedActions.length > 0 && (
                <div className="recommended-actions">
                  <div className="actions-label">Recommended Actions:</div>
                  <ul className="actions-list">
                    {signal.recommendedActions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="signal-actions">
              <button className="action-btn view-btn">
                👁️
              </button>
              <button className="action-btn resolve-btn">
                ✅
              </button>
            </div>
          </div>
        ))}
      </div>

      {signals.length === 0 && (
        <div className="no-signals">
          <div className="no-signals-icon">✅</div>
          <div className="no-signals-text">
            <h3>No Active Struggle Signals</h3>
            <p>All user interactions are flowing smoothly!</p>
          </div>
        </div>
      )}

      <style>{`
        .struggle-signals-panel {
          height: 100%;
          max-height: 600px;
          display: flex;
          flex-direction: column;
        }

        .signal-summary {
          text-align: right;
        }

        .total-signals {
          font-size: 24px;
          font-weight: 700;
          color: #2d3748;
        }

        .critical-count {
          font-size: 12px;
          color: #f56565;
          font-weight: 500;
        }

        .signals-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
          overflow-y: auto;
          max-height: 500px;
          padding-right: 8px;
        }

        .signals-list::-webkit-scrollbar {
          width: 8px;
        }

        .signals-list::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .signals-list::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 4px;
        }

        .signals-list::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }

        .signal-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #ffffff;
          border-radius: 8px;
          border: 2px solid #cbd5e0;
          border-left: 4px solid #4a5568;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.2s;
        }

        .signal-item:hover {
          background: #f7fafc;
          border-color: #718096;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          transform: translateX(4px);
        }

        .signal-info {
          flex: 1;
        }

        .signal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .feature-name {
          font-weight: 500;
          color: #2d3748;
        }

        .severity-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
        }

        .signal-details {
          display: flex;
          gap: 16px;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .signal-count {
          color: #718096;
        }

        .trend-indicator {
          font-weight: 500;
        }

        .exit-risk {
          display: flex;
          gap: 6px;
          align-items: center;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .risk-label {
          color: #718096;
        }

        .risk-score {
          font-weight: 600;
          color: #e53e3e;
          background: #fed7d7;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .detected-at {
          display: flex;
          gap: 6px;
          font-size: 11px;
          color: #a0aec0;
          margin-bottom: 8px;
        }

        .detected-label {
          font-weight: 500;
        }

        .signal-description {
          font-size: 13px;
          color: #4a5568;
          line-height: 1.5;
          margin-top: 8px;
          padding: 8px;
          background: #edf2f7;
          border-radius: 4px;
        }

        .recommended-actions {
          margin-top: 10px;
          padding: 10px;
          background: #e6fffa;
          border-left: 3px solid #38b2ac;
          border-radius: 4px;
        }

        .actions-label {
          font-size: 12px;
          font-weight: 600;
          color: #2c7a7b;
          margin-bottom: 6px;
        }

        .actions-list {
          margin: 0;
          padding-left: 20px;
          font-size: 12px;
          color: #234e52;
        }

        .actions-list li {
          margin-bottom: 4px;
          line-height: 1.4;
        }

        .signal-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .view-btn {
          background: #edf2f7;
          color: #4a5568;
        }

        .view-btn:hover {
          background: #e2e8f0;
        }

        .resolve-btn {
          background: #c6f6d5;
          color: #2f855a;
        }

        .resolve-btn:hover {
          background: #9ae6b4;
        }

        .no-signals {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 20px;
        }

        .no-signals-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .no-signals-text h3 {
          margin: 0 0 8px 0;
          color: #2d3748;
          font-size: 18px;
        }

        .no-signals-text p {
          margin: 0;
          color: #718096;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default StruggleSignalsPanel;