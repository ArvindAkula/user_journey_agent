import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsService } from '@aws-agent/shared';

interface VideoEngagementMetrics {
  totalViews: number;
  averageWatchTime: number;
  completionRate: number;
  topVideos: Array<{
    videoId: string;
    title: string;
    views: number;
    avgWatchTime: number;
    completionRate: number;
  }>;
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

interface VideoEngagementPanelProps {
  filters: AnalyticsFilter;
  refreshKey: number;
}

const VideoEngagementPanel: React.FC<VideoEngagementPanelProps> = ({ filters, refreshKey }) => {
  const [metrics, setMetrics] = useState<VideoEngagementMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [filters, refreshKey]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const analyticsService = new AnalyticsService({
        baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080'
      });
      const data = await analyticsService.getVideoEngagementMetrics(filters);
      setMetrics(data);
    } catch (err) {
      setError('Failed to load video engagement data');
      console.error('Error loading video engagement:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="video-engagement-panel">
        <div className="panel-header">
          <h2 className="panel-title">Video Engagement</h2>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="video-engagement-panel">
        <div className="panel-header">
          <h2 className="panel-title">Video Engagement</h2>
        </div>
        <div className="error-message">{error || 'No data available'}</div>
      </div>
    );
  }

  return (
    <div className="video-engagement-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Video Engagement</h2>
          <p className="panel-subtitle">Content performance insights</p>
        </div>
      </div>

      <div className="engagement-summary">
        <div className="summary-item">
          <div className="summary-value">{metrics.totalViews.toLocaleString()}</div>
          <div className="summary-label">Total Views</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{metrics.averageWatchTime}m</div>
          <div className="summary-label">Avg Watch Time</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{metrics.completionRate}%</div>
          <div className="summary-label">Completion Rate</div>
        </div>
      </div>

      <div className="chart-section">
        <h3 className="chart-title">Top Performing Videos</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.topVideos} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="title" 
                stroke="#718096"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#718096" fontSize={12} />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'completionRate') return [`${value}%`, 'Completion Rate'];
                  if (name === 'avgWatchTime') return [`${value}m`, 'Avg Watch Time'];
                  return [value.toLocaleString(), 'Views'];
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar dataKey="views" fill="#667eea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <style>{`
        .video-engagement-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .engagement-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-item {
          text-align: center;
          padding: 16px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          border-radius: 8px;
        }

        .summary-value {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .summary-label {
          font-size: 12px;
          opacity: 0.9;
        }

        .chart-section {
          flex: 1;
        }

        .chart-title {
          font-size: 16px;
          font-weight: 600;
          color: #2d3748;
          margin: 0 0 16px 0;
        }

        .chart-container {
          height: 200px;
        }

        @media (max-width: 768px) {
          .engagement-summary {
            grid-template-columns: 1fr;
          }

          .summary-item {
            padding: 12px;
          }

          .summary-value {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default VideoEngagementPanel;