import React from 'react';
import { useNavigate } from 'react-router-dom';
import './UnauthorizedPage.css';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-content">
        <div className="unauthorized-icon">🚫</div>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        <p className="unauthorized-hint">
          This page requires ANALYST or ADMIN role. Please contact your administrator if you believe this is an error.
        </p>
        <div className="unauthorized-actions">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
          <button 
            onClick={() => navigate('/login')}
            className="btn-secondary"
          >
            Login with Different Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
