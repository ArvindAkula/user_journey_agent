import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { LoadingSpinner } from '@aws-agent/shared';
import './Auth.css';

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children, requireAuth = true }) => {
  const { authState } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Show loading spinner while checking authentication
  if (authState.isLoading) {
    return (
      <div className="auth-loading">
        <LoadingSpinner size="large" />
        <p>Loading...</p>
      </div>
    );
  }

  // If authentication is not required, always show children
  if (!requireAuth) {
    return <>{children}</>;
  }

  // If user is authenticated, show the protected content
  if (authState.isAuthenticated && authState.user) {
    return <>{children}</>;
  }

  // If authentication is required but user is not authenticated, show auth forms
  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="brand-logo">
            <span className="logo-icon">💰</span>
            <span className="logo-text">FinanceApp</span>
          </div>
          <p className="brand-tagline">
            Your personal finance companion for smarter financial decisions
          </p>
        </div>

        <div className="auth-content">
          {authMode === 'login' ? (
            <LoginForm
              onSwitchToRegister={() => setAuthMode('register')}
              onLoginSuccess={() => {
                // Authentication state will be updated by the AuthContext
                // The component will re-render and show children
              }}
            />
          ) : (
            <RegisterForm
              onSwitchToLogin={() => setAuthMode('login')}
              onRegisterSuccess={() => {
                // Authentication state will be updated by the AuthContext
                // The component will re-render and show children
              }}
            />
          )}
        </div>

        <div className="auth-features">
          <h3>Why choose FinanceApp?</h3>
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon">🎬</div>
              <div className="feature-content">
                <h4>Interactive Learning</h4>
                <p>Watch educational videos and track your progress</p>
              </div>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">🧮</div>
              <div className="feature-content">
                <h4>Smart Calculators</h4>
                <p>Calculate loan payments and plan your finances</p>
              </div>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">📄</div>
              <div className="feature-content">
                <h4>Secure Documents</h4>
                <p>Upload and manage your financial documents safely</p>
              </div>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div className="feature-content">
                <h4>Personal Insights</h4>
                <p>Get personalized recommendations and analytics</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-footer-info">
          <div className="security-badges">
            <div className="security-badge">
              <span className="badge-icon">🔒</span>
              <span className="badge-text">Bank-level Security</span>
            </div>
            <div className="security-badge">
              <span className="badge-icon">🛡️</span>
              <span className="badge-text">Privacy Protected</span>
            </div>
            <div className="security-badge">
              <span className="badge-icon">✅</span>
              <span className="badge-text">GDPR Compliant</span>
            </div>
          </div>
          
          <div className="demo-info">
            <p>
              <strong>Demo Mode:</strong> This is a demonstration application. 
              No real financial data is processed or stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthWrapper;