import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AnalyticsService } from '@aws-agent/shared';

interface UserSegmentData {
  segment: string;
  userCount: number;
  conversionRate: number;
  avgEngagement: number;
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

interface UserSegmentationChartProps {
  filters: AnalyticsFilter;
  refreshKey: number;
}

const UserSegmentationChart: React.FC<UserSegmentationChartProps> = ({ filters, refreshKey }) => {
  const [segments, setSegments] = useState<UserSegmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const COLORS = ['#667eea', '#48bb78', '#ed8936', '#f56565'];

  useEffect(() => {
    loadSegments();
  }, [filters, refreshKey]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      setError(null);
      const analyticsService = new AnalyticsService({
        baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080'
      });
      const data = await analyticsService.getUserSegments(filters);
      setSegments(data);
    } catch (err) {
      setError('Failed to load user segments');
      console.error('Error loading user segments:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalUsers = segments.reduce((sum, segment) => sum + segment.userCount, 0);

  const chartData = segments.map((segment, index) => ({
    ...segment,
    percentage: totalUsers > 0 ? Math.round((segment.userCount / totalUsers) * 100) : 0,
    color: COLORS[index % COLORS.length]
  }));

  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{data.segment}</p>
          <p className="tooltip-value">
            Users: {data.userCount.toLocaleString()} ({data.percentage}%)
          </p>
          <p className="tooltip-conversion">
            Conversion: {data.conversionRate}%
          </p>
          <p className="tooltip-engagement">
            Engagement: {data.avgEngagement}min
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="user-segmentation-chart">
        <div className="panel-header">
          <h2 className="panel-title">User Segments</h2>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-segmentation-chart">
        <div className="panel-header">
          <h2 className="panel-title">User Segments</h2>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="user-segmentation-chart">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">User Segments</h2>
          <p className="panel-subtitle">Distribution and performance</p>
        </div>
        <div className="total-users">
          <div className="total-count">{totalUsers.toLocaleString()}</div>
          <div className="total-label">Total Users</div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="userCount"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={renderCustomTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="legend-container">
          {chartData.map((segment, index) => (
            <div key={segment.segment} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: segment.color }}
              ></div>
              <div className="legend-info">
                <div className="legend-label">{segment.segment}</div>
                <div className="legend-stats">
                  {segment.userCount.toLocaleString()} users ({segment.percentage}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .user-segmentation-chart {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .total-users {
          text-align: right;
        }

        .total-count {
          font-size: 24px;
          font-weight: 700;
          color: #2d3748;
        }

        .total-label {
          font-size: 12px;
          color: #718096;
        }

        .chart-section {
          display: flex;
          gap: 20px;
          flex: 1;
          align-items: center;
        }

        .chart-container {
          width: 200px;
          height: 200px;
        }

        .legend-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .legend-info {
          flex: 1;
        }

        .legend-label {
          font-weight: 500;
          color: #2d3748;
          margin-bottom: 2px;
        }

        .legend-stats {
          font-size: 12px;
          color: #718096;
        }

        .custom-tooltip {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .tooltip-label {
          font-weight: 600;
          color: #2d3748;
          margin: 0 0 8px 0;
        }

        .tooltip-value,
        .tooltip-conversion,
        .tooltip-engagement {
          margin: 4px 0;
          font-size: 12px;
          color: #718096;
        }

        @media (max-width: 768px) {
          .panel-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .chart-section {
            flex-direction: column;
            align-items: center;
          }

          .chart-container {
            width: 250px;
            height: 250px;
          }

          .legend-container {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default UserSegmentationChart;