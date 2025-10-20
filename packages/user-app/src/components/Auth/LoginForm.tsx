import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../../config';
import './Auth.css';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onLoginSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onLoginSuccess }) => {
  // Create event service instance
  const eventService = new EventService({
    baseURL: config.apiBaseUrl,
    timeout: 5000,
    batchSize: 5,
    flushInterval: 3000,
    maxRetries: 3,
    retryDelay: 1000,
    enableOfflineQueue: true,
    maxOfflineEvents: 500
  });

  const { 
    trackFeatureInteraction, 
    trackUserAction, 
    trackError,
    trackFormInteraction,
    trackButtonClick
  } = useEventTracking({
    eventService,
    userId: 'anonymous',
    sessionId: `login-session-${Date.now()}`,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  const { login, authState } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);

  React.useEffect(() => {
    // Track login form view
    trackFeatureInteraction('login_form_view', true, {
      attemptCount: 1
    });

    trackUserAction('login_form_opened', {
      timestamp: new Date().toISOString(),
      referrer: document.referrer
    });
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      trackUserAction('login_validation_failed', {
        errors: Object.keys(errors),
        attemptCount: loginAttempts + 1
      });
      return;
    }

    setIsLoading(true);
    setLoginAttempts(prev => prev + 1);

    try {
      const user = await login({
        email: formData.email,
        password: formData.password
      });

      // Track successful login
      trackFeatureInteraction('login_success', true, {
        attemptCount: loginAttempts + 1,
        userContext: {
          deviceType: 'desktop',
          browserInfo: navigator.userAgent,
          persona: 'user',
          userSegment: 'authenticated',
          sessionStage: 'login_success',
          previousActions: []
        },
        deviceInfo: {
          platform: 'Web' as const,
          appVersion: '1.0.0',
          deviceModel: 'Browser'
        }
      });

      trackUserAction('user_logged_in', {
        userId: user.id,
        email: user.email,
        loginMethod: 'email_password',
        attemptCount: loginAttempts + 1,
        rememberMe,
        timestamp: new Date().toISOString()
      });

      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }

      onLoginSuccess?.();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setErrors({ general: errorMessage });
      
      trackError('Login failed', {
        component: 'LoginForm',
        error: errorMessage,
        attemptCount: loginAttempts + 1,
        email: formData.email
      });

      trackUserAction('login_failed', {
        error: errorMessage,
        attemptCount: loginAttempts + 1,
        email: formData.email,
        timestamp: new Date().toISOString()
      });

    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    trackFormInteraction('login-form', field, 'change', value);
  };

  const handleDemoLogin = () => {
    setFormData({
      email: 'demo@example.com',
      password: 'demo123'
    });
    
    trackButtonClick('demo-login', 'Demo Login', {
      attemptCount: loginAttempts
    });
  };

  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Welcome Back</h2>
        <p>Sign in to your account to continue</p>
      </div>

      {errors.general && (
        <div className="error-message">
          {errors.general}
        </div>
      )}

      {loginAttempts >= 2 && (
        <div className="help-message">
          <span>💡</span>
          <div>
            <p>Having trouble signing in?</p>
            <button 
              type="button" 
              onClick={handleDemoLogin}
              className="demo-login-button"
            >
              Try Demo Login
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form-content">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            onFocus={() => trackFormInteraction('login-form', 'email', 'focus')}
            onBlur={() => trackFormInteraction('login-form', 'email', 'blur')}
            className={errors.email ? 'error' : ''}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={isLoading}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              onFocus={() => trackFormInteraction('login-form', 'password', 'focus')}
              onBlur={() => trackFormInteraction('login-form', 'password', 'blur')}
              className={errors.password ? 'error' : ''}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => {
                setShowPassword(!showPassword);
                trackButtonClick('password-toggle', 'Toggle Password Visibility', { visible: !showPassword });
              }}
              disabled={isLoading}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <div className="form-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => {
                setRememberMe(e.target.checked);
                trackFormInteraction('login-form', 'rememberMe', 'change', e.target.checked.toString());
              }}
              disabled={isLoading}
            />
            <span>Remember me</span>
          </label>

          <button
            type="button"
            className="forgot-password-link"
            onClick={() => {
              trackButtonClick('forgot-password', 'Forgot Password');
              alert('Password reset functionality would be implemented here in a real application.');
            }}
            disabled={isLoading}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className="auth-submit-button"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="loading-spinner"></span>
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="demo-access-button"
          onClick={handleDemoLogin}
          disabled={isLoading}
        >
          🚀 Quick Demo Access
        </button>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                trackButtonClick('switch-to-register', 'Switch to Register');
                onSwitchToRegister();
              }}
              disabled={isLoading}
            >
              Sign up
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;