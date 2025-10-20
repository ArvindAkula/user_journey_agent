import React from 'react';
import UserJourneyChart from '../components/Dashboard/UserJourneyChart';
import UserSegmentationChart from '../components/Dashboard/UserSegmentationChart';
import UserJourneyDemo from '../components/Dashboard/UserJourneyDemo';

const UserJourneyPage: React.FC = () => {
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
    <div className="user-journey-page">
      <div className="page-header">
        <h2>User Journey Analysis</h2>
        <p>Interactive user journey demo with persona analysis and behavior tracking</p>
      </div>
      
      <div className="dashboard-grid">
        {/* User Journey Demo - Full Width */}
        <div className="grid-item grid-item-12">
          <UserJourneyDemo filters={defaultFilters} refreshKey={0} />
        </div>
        
        <div className="grid-item grid-item-8">
          <UserJourneyChart filters={defaultFilters} refreshKey={0} />
        </div>
        
        <div className="grid-item grid-item-4">
          <UserSegmentationChart filters={defaultFilters} refreshKey={0} />
        </div>
      </div>
    </div>
  );
};

export default UserJourneyPage;