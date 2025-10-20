import React, { useState, useEffect } from 'react';
import { AnalyticsFilter } from '@aws-agent/shared';
import { useProductionEnvironment } from '../../hooks/useProductionAnalytics';
import MetricsOverview from './MetricsOverview';
import UserJourneyChart from './UserJourneyChart';
import VideoEngagementPanel from './VideoEngagementPanel';
import StruggleSignalsPanel from './StruggleSignalsPanel';
import UserSegmentationChart from './UserSegmentationChart';
import UserJourneyDemo from './UserJourneyDemo';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  userId?: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ userId }) => {
  const { isProduction, environment } = useProductionEnvironment();
  
  const [filters, setFilters] = useState<AnalyticsFilter>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    },
    userSegments: [],
    platforms: [],
    features: []
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh dashboard - more frequent in production for real-time data
  useEffect(() => {
    const refreshInterval = isProduction ? 15000 : 30000; // 15s in production, 30s in dev
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isProduction]);

  const handleFilterChange = (newFilters: AnalyticsFilter) => {
    setFilters(newFilters);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="enhanced-analytics-dashboard">
      <div className="dashboard-content">
        <div className="dashboard-grid">
          {/* Enhanced Metrics Overview with Real-time Data */}
          <div className="grid-item grid-item-12">
            <MetricsOverview filters={filters} refreshKey={refreshKey} />
          </div>

          {/* User Journey Demo - Full Width */}
          <div className="grid-item grid-item-12">
            <UserJourneyDemo filters={filters} refreshKey={refreshKey} />
          </div>

          {/* User Journey Chart */}
          <div className="grid-item grid-item-6">
            <UserJourneyChart filters={filters} refreshKey={refreshKey} />
          </div>

          {/* Video Engagement */}
          <div className="grid-item grid-item-6">
            <VideoEngagementPanel filters={filters} refreshKey={refreshKey} />
          </div>

          {/* Struggle Signals */}
          <div className="grid-item grid-item-6">
            <StruggleSignalsPanel filters={filters} refreshKey={refreshKey} />
          </div>

          {/* User Segmentation */}
          <div className="grid-item grid-item-6">
            <UserSegmentationChart filters={filters} refreshKey={refreshKey} />
          </div>
        </div>
      </div>
      
      <style>{`
        .enhanced-analytics-dashboard {
          min-height: 100vh;
          background: #f7fafc;
        }
        
        .dashboard-content {
          padding: 24px;
        }
        
        @media (max-width: 768px) {
          .dashboard-content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default AnalyticsDashboard;