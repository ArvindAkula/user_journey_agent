import React from 'react';
import { LoadingSpinner } from '@aws-agent/shared';

const ProfilePage: React.FC = () => {
  return (
    <div className="profile-page">
      <h1>User Profile</h1>
      <p>This page will contain user profile and authentication functionality.</p>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
        <LoadingSpinner size="large" />
      </div>
      <p style={{ textAlign: 'center', color: '#666' }}>
        Profile and authentication components will be implemented in task 3.4.
      </p>
    </div>
  );
};

export default ProfilePage;