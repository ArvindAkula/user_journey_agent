import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginPage as SharedLoginPage } from '@aws-agent/shared';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the return URL from location state, or default to home
  const from = (location.state as any)?.from || '/';

  const handleLoginSuccess = () => {
    navigate(from, { replace: true });
  };

  return (
    <div className="user-app-login-page">
      <SharedLoginPage
        onLoginSuccess={handleLoginSuccess}
        returnUrl={from}
        title="Welcome to Mortgage Agent"
        subtitle="Sign in to access your account"
      />
    </div>
  );
};

export default LoginPage;
