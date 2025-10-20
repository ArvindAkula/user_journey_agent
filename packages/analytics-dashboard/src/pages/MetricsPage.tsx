import React from 'react';
import MetricsOverview from '../components/Dashboard/MetricsOverview';
import VideoEngagementPanel from '../components/Dashboard/VideoEngagementPanel';
import StruggleSignalsPanel from '../components/Dashboard/StruggleSignalsPanel';

const MetricsPage: React.FC = () => {
  const defaultFilters = {
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    userSegments: [],
    platforms: [],
    features: []
  };

  return (
    <div className="metrics-page">
      <div className="page-header">
        <h2>Detailed Metrics</h2>
        <p>Comprehensive analytics and performance metrics</p>
      </div>
      
      <div className="dashboard-grid">
        <div className="grid-item grid-item-12">
          <MetricsOverview filters={defaultFilters} refreshKey={0} />
        </div>
        
        <div className="grid-item grid-item-6">
          <VideoEngagementPanel filters={defaultFilters} refreshKey={0} />
        </div>
        
        <div className="grid-item grid-item-6">
          <StruggleSignalsPanel filters={defaultFilters} refreshKey={0} />
        </div>
      </div>
    </div>
  );
};

export default MetricsPage;