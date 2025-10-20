import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsService } from '@aws-agent/shared';

interface TimeSeriesData {
  timestamp: string;
  value: number;
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

interface UserJourneyChartProps {
  filters: AnalyticsFilter;
  refreshKey: number;
}

const UserJourneyChart: React.FC<UserJourneyChartProps> = ({ filters, refreshKey }) => {
  const [data, setData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState('activeUsers');

  const metrics = [
    { key: 'activeUsers', label: 'Active Users', color: '#667eea' },
    { key: 'conversionRate', label: 'Conversion Rate', color: '#48bb78' },
    { key: 'dropOffRate', label: 'Drop-off Rate', color: '#f56565' },
    { key: 'sessionDuration', label: 'Session Duration', color: '#ed8936' }
  ];

  useEffect(() => {
    loadData();
  }, [filters, refreshKey, selectedMetric]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const analyticsService = new AnalyticsService({
        baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080'
      });
      const timeSeriesData = await analyticsService.getTimeSeriesData(selectedMetric, filters);
      setData(timeSeriesData);
    } catch (err) {
      setError('Failed to load chart data');
      console.error('Error loading chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTooltipValue = (value: number, name: string) => {
    switch (selectedMetric) {
      case 'conversionRate':
      case 'dropOffRate':
        return [`${value}%`, name];
      case 'sessionDuration':
        return [`${value}m`, name];
      default:
        return [value.toLocaleString(), name];
    }
  };

  const currentMetric = metrics.find(m => m.key === selectedMetric);

  if (loading) {
    return (
      <div className="user-journey-chart">
        <div className="panel-header">
          <h2 className="panel-title">User Journey Trends</h2>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-journey-chart">
        <div className="panel-header">
          <h2 className="panel-title">User Journey Trends</h2>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="user-journey-chart">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">User Journey Trends</h2>
          <p className="panel-subtitle">30-day performance overview</p>
        </div>
        <select 
          value={selectedMetric} 
          onChange={(e) => setSelectedMetric(e.target.value)}
          className="metric-selector"
        >
          {metrics.map(metric => (
            <option key={metric.key} value={metric.key}>
              {metric.label}
            </option>
          ))}
        </select>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#718096"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis 
              stroke="#718096"
              fontSize={12}
              tickFormatter={(value) => {
                switch (selectedMetric) {
                  case 'conversionRate':
                  case 'dropOffRate':
                    return `${value}%`;
                  case 'sessionDuration':
                    return `${value}m`;
                  default:
                    return value.toLocaleString();
                }
              }}
            />
            <Tooltip 
              formatter={formatTooltipValue}
              labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={currentMetric?.color || '#667eea'}
              strokeWidth={3}
              dot={{ fill: currentMetric?.color || '#667eea', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: currentMetric?.color || '#667eea', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-insights">
        <div className="insight-item">
          <span className="insight-label">Trend:</span>
          <span className="insight-value positive">↗ +5.2% vs last period</span>
        </div>
        <div className="insight-item">
          <span className="insight-label">Peak:</span>
          <span className="insight-value">
            {data.length > 0 && Math.max(...data.map(d => d.value)).toLocaleString()}
          </span>
        </div>
        <div className="insight-item">
          <span className="insight-label">Average:</span>
          <span className="insight-value">
            {data.length > 0 && Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length).toLocaleString()}
          </span>
        </div>
      </div>

      <style>{`
        .user-journey-chart {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .chart-container {
          flex: 1;
          min-height: 250px;
        }

        .metric-selector {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          font-size: 14px;
          cursor: pointer;
        }

        .metric-selector:focus {
          outline: none;
          border-color: #667eea;
        }

        .chart-insights {
          display: flex;
          justify-content: space-around;
          padding: 16px 0 0 0;
          border-top: 1px solid #e2e8f0;
          margin-top: 16px;
        }

        .insight-item {
          text-align: center;
        }

        .insight-label {
          display: block;
          font-size: 12px;
          color: #718096;
          margin-bottom: 4px;
        }

        .insight-value {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
        }

        .insight-value.positive {
          color: #48bb78;
        }

        .insight-value.negative {
          color: #f56565;
        }

        @media (max-width: 768px) {
          .panel-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .chart-insights {
            flex-direction: column;
            gap: 8px;
          }

          .insight-item {
            display: flex;
            justify-content: space-between;
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default UserJourneyChart;