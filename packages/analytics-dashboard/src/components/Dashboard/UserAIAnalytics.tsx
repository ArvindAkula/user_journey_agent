import React, { useState, useEffect } from 'react';
import './UserAIAnalytics.css';

interface AIAnalysis {
  analysisId: string;
  userId: string;
  eventType: string;
  timestamp: string;
  aiInsights: string;
  sentiment?: string;
  riskLevel?: string;
  recommendations?: string[];
  metadata?: any;
}

interface UserAIAnalyticsProps {
  userId: string;
}

const UserAIAnalytics: React.FC<UserAIAnalyticsProps> = ({ userId }) => {
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserAnalytics();
    }
  }, [userId]);

  const fetchUserAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8080/api/analytics/user/${userId}/ai-insights`);
      
      if (response.ok) {
        const data = await response.json();
        setAnalyses(data);
      } else {
        setError('Failed to load AI analytics');
      }
    } catch (err) {
      console.error('Error fetching AI analytics:', err);
      setError('Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(parseInt(timestamp));
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return '#48bb78';
      case 'negative': return '#f56565';
      case 'neutral': return '#4299e1';
      default: return '#718096';
    }
  };

  const getRiskLevelColor = (riskLevel?: string) => {
    switch (riskLevel?.toLowerCase()) {
      case 'high': return '#f56565';
      case 'medium': return '#ed8936';
      case 'low': return '#48bb78';
      default: return '#718096';
    }
  };

  if (isLoading) {
    return (
      <div className="user-ai-analytics">
        <div className="analytics-header">
          <h3>🤖 AI-Powered Analytics</h3>
        </div>
        <div className="loading-state">
          <div className="spinner-large"></div>
          <p>Loading AI insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-ai-analytics">
        <div className="analytics-header">
          <h3>🤖 AI-Powered Analytics</h3>
        </div>
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={fetchUserAnalytics} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="user-ai-analytics">
        <div className="analytics-header">
          <h3>🤖 AI-Powered Analytics</h3>
          <p>Bedrock AI analysis for user behavior and insights</p>
        </div>
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <p>No AI analysis available yet for this user</p>
          <small>AI insights will appear here as the user interacts with the application</small>
        </div>
      </div>
    );
  }

  return (
    <div className="user-ai-analytics">
      <div className="analytics-header">
        <div>
          <h3>🤖 AI-Powered Analytics</h3>
          <p>Bedrock AI analysis • {analyses.length} insight(s) available</p>
        </div>
        <button onClick={fetchUserAnalytics} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      <div className="analytics-grid">
        {analyses.map((analysis, index) => (
          <div key={analysis.analysisId || index} className="analysis-card">
            <div className="card-header-ai">
              <div className="header-left">
                <span className="event-badge">{analysis.eventType}</span>
                <span className="timestamp">{formatTimestamp(analysis.timestamp)}</span>
              </div>
              <div className="header-right">
                {analysis.sentiment && (
                  <span 
                    className="sentiment-badge"
                    style={{ backgroundColor: getSentimentColor(analysis.sentiment) }}
                  >
                    {analysis.sentiment}
                  </span>
                )}
                {analysis.riskLevel && (
                  <span 
                    className="risk-badge"
                    style={{ backgroundColor: getRiskLevelColor(analysis.riskLevel) }}
                  >
                    Risk: {analysis.riskLevel}
                  </span>
                )}
              </div>
            </div>

            <div className="card-body">
              <div className="insights-section">
                <h4>💡 AI Insights</h4>
                <div className="insights-content">
                  {analysis.aiInsights}
                </div>
              </div>

              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div className="recommendations-section">
                  <h4>✨ Recommendations</h4>
                  <ul className="recommendations-list">
                    {analysis.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.metadata && Object.keys(analysis.metadata).length > 0 && (
                <div className="metadata-section">
                  <h4>📋 Additional Data</h4>
                  <div className="metadata-grid">
                    {Object.entries(analysis.metadata).map(([key, value]) => (
                      <div key={key} className="metadata-item">
                        <span className="metadata-key">{key}:</span>
                        <span className="metadata-value">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserAIAnalytics;
