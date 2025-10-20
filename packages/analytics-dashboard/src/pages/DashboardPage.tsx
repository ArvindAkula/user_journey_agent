import React from 'react';
import AnalyticsDashboard from '../components/Dashboard/AnalyticsDashboard';

const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      {/* Overall Analytics Dashboard */}
      <AnalyticsDashboard />
    </div>
  );
};

export default DashboardPage;