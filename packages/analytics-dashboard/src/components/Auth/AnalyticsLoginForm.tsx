import React, { useState } from 'react';
import { useAnalyticsAuth } from '../../contexts/AnalyticsAuthContext';
import { AnalyticsLoginCredentials } from '@aws-agent/shared';
import './AnalyticsAuth.css';

interface AnalyticsLoginFormProps {
  onLoginSuccess?: () => void;
}

export const AnalyticsLoginForm: React.FC<AnalyticsLoginFormProps> = ({ onLoginSuccess }) => {
  const { login, isLoading, error } = useAnalyticsAuth();
  const [credentials, setCredentials] = useState<AnalyticsLoginCredentials>({
    email: '',
    password: '',
    mfaCode: ''
  });
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (loginError) {
      setLoginError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!credentials.email || !credentials.password) {
      setLoginError('Email and password are required');
      return;
    }

    // Check if using demo credentials
    if (credentials.email === 'analytics@example.com' && credentials.password === 'demo123') {
      // Trigger demo login instead
      await handleDemoLogin();
      return;
    }

    try {
      await login(credentials);
      onLoginSuccess?.();
    } catch (error: any) {
      // Check if MFA is required
      if (error.message.includes('MFA') || error.message.includes('multi-factor')) {
        setShowMfaInput(true);
        setLoginError('Please enter your multi-factor authentication code');
      } else {
        setLoginError(error.message || 'Login failed');
      }
    }
  };

  const handleDemoLogin = async () => {
    setLoginError(null);

    console.log('Demo Login clicked - bypassing auth and using REAL data from backend');

    try {
      // Set demo mode to bypass authentication
      localStorage.setItem('analytics_demo_mode', 'true');
      // But also set a flag to use real data instead of mock
      localStorage.setItem('use_real_data', 'true');

      // Force page refresh to trigger the ProtectedRoute bypass
      window.location.reload();

    } catch (error: any) {
      console.error('Demo login error:', error);
      setLoginError('Demo login setup failed');
    }
  };

  return (
    <div className="analytics-login-container">
      <div className="analytics-login-card">
        <div className="analytics-login-header">
          <h2>Analytics Dashboard</h2>
          <p>Sign in to access analytics insights</p>
        </div>

        <form onSubmit={handleSubmit} className="analytics-login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={credentials.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {showMfaInput && (
            <div className="form-group">
              <label htmlFor="mfaCode">Multi-Factor Authentication Code</label>
              <input
                type="text"
                id="mfaCode"
                name="mfaCode"
                value={credentials.mfaCode || ''}
                onChange={handleInputChange}
                placeholder="Enter 6-digit code"
                maxLength={6}
                disabled={isLoading}
                autoComplete="one-time-code"
              />
            </div>
          )}

          {(loginError || error) && (
            <div className="error-message">
              {loginError || error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="login-button primary"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <button
              type="button"
              className="login-button demo"
              onClick={handleDemoLogin}
              disabled={isLoading}
            >
              Demo Login
            </button>
          </div>
        </form>

        <div className="analytics-login-footer">
          <p>
            <small>
              Analytics Dashboard - Authorized Personnel Only
              <br />
              Contact your administrator for access
            </small>
          </p>
        </div>
      </div>
    </div>
  );
};