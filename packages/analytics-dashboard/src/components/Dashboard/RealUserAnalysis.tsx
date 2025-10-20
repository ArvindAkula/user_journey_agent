import React, { useState, useEffect } from 'react';
import './RealUserAnalysis.css';

interface UserBehaviorData {
  userId: string;
  totalEvents: number;
  videoEngagements: number;
  featureInteractions: number;
  struggles: number;
  sessionDuration: number;
  lastActive: string;
  topFeatures?: string[];
  engagementLevel: 'Low' | 'Medium' | 'High';
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  churnRisk: 'Low' | 'Medium' | 'High';
}

interface RealUserAnalysisProps {
  filters?: any;
  refreshKey?: number;
}

const RealUserAnalysis: React.FC<RealUserAnalysisProps> = ({ filters, refreshKey }) => {
  const [userData, setUserData] = useState<UserBehaviorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserBehavior();
  }, [filters, refreshKey]);

  const fetchUserBehavior = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch real user behavior from backend
      const response = await fetch('http://localhost:8080/api/analytics/user-behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters || {})
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user behavior');
      }
      
      const data = await response.json();
      setUserData(data);
    } catch (err) {
      console.error('Error fetching user behavior:', err);
      setError('Unable to load user behavior data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="real-user-analysis loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Analyzing user behavior...</p>
        </div>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="real-user-analysis error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error || 'No user data available'}</p>
          <button onClick={fetchUserBehavior} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'High': return '#48bb78';
      case 'Medium': return '#ed8936';
      case 'Low': return '#f56565';
      default: return '#718096';
    }
  };

  const getChurnRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return '#48bb78';
      case 'Medium': return '#ed8936';
      case 'High': return '#f56565';
      default: return '#718096';
    }
  };

  return (
    <div className="real-user-analysis">
      <div className="analysis-header">
        <div>
          <h3>Real User Behavior Analysis</h3>
          <p className="subtitle">Based on actual DynamoDB events for {userData.userId}</p>
        </div>
        <button onClick={fetchUserBehavior} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      <div className="user-profile-card">
        <div className="profile-header">
          <div className="avatar">👤</div>
          <div className="profile-info">
            <h4>{userData.userId}</h4>
            <p className="last-active">Last active: {userData.lastActive}</p>
          </div>
        </div>

        <div className="behavior-metrics">
          <div className="metric-row">
            <span className="metric-label">Total Events:</span>
            <span className="metric-value">{userData.totalEvents}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Video Engagements:</span>
            <span className="metric-value">{userData.videoEngagements}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Feature Interactions:</span>
            <span className="metric-value">{userData.featureInteractions}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Struggles Detected:</span>
            <span className="metric-value struggle">{userData.struggles}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Session Duration:</span>
            <span className="metric-value">{userData.sessionDuration}m</span>
          </div>
        </div>

        <div className="classification-grid">
          <div className="classification-item">
            <span className="classification-label">Engagement Level</span>
            <span 
              className="classification-badge"
              style={{ backgroundColor: getEngagementColor(userData.engagementLevel) }}
            >
              {userData.engagementLevel}
            </span>
          </div>
          <div className="classification-item">
            <span className="classification-label">Skill Level</span>
            <span className="classification-badge skill">
              {userData.skillLevel}
            </span>
          </div>
          <div className="classification-item">
            <span className="classification-label">Churn Risk</span>
            <span 
              className="classification-badge"
              style={{ backgroundColor: getChurnRiskColor(userData.churnRisk) }}
            >
              {userData.churnRisk}
            </span>
          </div>
        </div>

        {userData.topFeatures && userData.topFeatures.length > 0 && (
          <div className="top-features">
            <h5>Most Used Features</h5>
            <div className="features-list">
              {userData.topFeatures.map((feature, index) => (
                <span key={index} className="feature-tag">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="insights-section">
          <h5>Behavioral Insights</h5>
          <ul className="insights-list">
            {userData.videoEngagements > 0 && (
              <li>📹 Prefers video content for learning</li>
            )}
            {userData.struggles > 3 && (
              <li>⚠️ Experiencing difficulties - may need assistance</li>
            )}
            {userData.engagementLevel === 'High' && (
              <li>✨ Highly engaged - good candidate for advanced features</li>
            )}
            {userData.churnRisk === 'High' && (
              <li>🚨 At risk of churning - consider intervention</li>
            )}
            {userData.totalEvents === 0 && (
              <li>ℹ️ No activity detected yet</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RealUserAnalysis;
