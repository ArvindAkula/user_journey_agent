import React from 'react';
import { useNavigate } from 'react-router-dom';
import './UnauthorizedPage.css';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-content">
        <div className="unauthorized-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        
        <div className="unauthorized-actions">
          <button onClick={() => navigate('/')} className="btn-primary">
            Go to Home
          </button>
          <button onClick={() => navigate(-1)} className="btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
