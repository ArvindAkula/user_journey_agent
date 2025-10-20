import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../../config';
import './Auth.css';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onRegisterSuccess?: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin, onRegisterSuccess }) => {
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
    sessionId: `register-session-${Date.now()}`,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  const { register } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [registerAttempts, setRegisterAttempts] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState(0);

  React.useEffect(() => {
    // Track register form view
    trackFeatureInteraction('register_form_view', true, {
      attemptCount: 1
    });

    trackUserAction('register_form_opened', {
      timestamp: new Date().toISOString(),
      referrer: document.referrer
    });
  }, []);

  const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    
    return Math.min(strength, 100);
  };

  const getPasswordStrengthLabel = (strength: number): string => {
    if (strength < 25) return 'Very Weak';
    if (strength < 50) return 'Weak';
    if (strength < 75) return 'Good';
    return 'Strong';
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 25) return '#dc3545';
    if (strength < 50) return '#fd7e14';
    if (strength < 75) return '#ffc107';
    return '#28a745';
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (passwordStrength < 50) {
      newErrors.password = 'Please choose a stronger password';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.terms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      trackUserAction('register_validation_failed', {
        errors: Object.keys(errors),
        attemptCount: registerAttempts + 1,
        passwordStrength
      });
      return;
    }

    setIsLoading(true);
    setRegisterAttempts(prev => prev + 1);

    try {
      const user = await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`
      });

      // Track successful registration
      trackFeatureInteraction('register_success', true, {
        attemptCount: registerAttempts + 1,
        passwordStrength,
        userContext: {
          deviceType: 'desktop',
          browserInfo: navigator.userAgent,
          persona: 'new_user',
          userSegment: 'registered',
          sessionStage: 'registration_success',
          previousActions: []
        },
        deviceInfo: {
          platform: 'Web' as const,
          appVersion: '1.0.0',
          deviceModel: 'Browser'
        }
      });

      trackUserAction('user_registered', {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        registrationMethod: 'email_password',
        attemptCount: registerAttempts + 1,
        passwordStrength,
        timestamp: new Date().toISOString()
      });

      onRegisterSuccess?.();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setErrors({ general: errorMessage });
      
      trackError('Registration failed', {
        component: 'RegisterForm',
        error: errorMessage,
        attemptCount: registerAttempts + 1,
        email: formData.email,
        passwordStrength
      });

      trackUserAction('register_failed', {
        error: errorMessage,
        attemptCount: registerAttempts + 1,
        email: formData.email,
        passwordStrength,
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

    // Update password strength for password field
    if (field === 'password') {
      const strength = calculatePasswordStrength(value);
      setPasswordStrength(strength);
    }

    trackFormInteraction('register-form', field, 'change', value);
  };

  const handleDemoRegister = () => {
    setFormData({
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@example.com',
      password: 'demo123',
      confirmPassword: 'demo123'
    });
    setAcceptTerms(true);
    
    trackButtonClick('demo-register', 'Demo Register', {
      attemptCount: registerAttempts
    });
  };

  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Create Account</h2>
        <p>Join us to get started with your financial journey</p>
      </div>

      {errors.general && (
        <div className="error-message">
          {errors.general}
        </div>
      )}

      {registerAttempts >= 2 && (
        <div className="help-message">
          <span>💡</span>
          <div>
            <p>Need help getting started?</p>
            <button 
              type="button" 
              onClick={handleDemoRegister}
              className="demo-register-button"
            >
              Fill Demo Data
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form-content">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              onFocus={() => trackFormInteraction('register-form', 'firstName', 'focus')}
              onBlur={() => trackFormInteraction('register-form', 'firstName', 'blur')}
              className={errors.firstName ? 'error' : ''}
              placeholder="Enter your first name"
              autoComplete="given-name"
              disabled={isLoading}
            />
            {errors.firstName && <span className="error-text">{errors.firstName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              onFocus={() => trackFormInteraction('register-form', 'lastName', 'focus')}
              onBlur={() => trackFormInteraction('register-form', 'lastName', 'blur')}
              className={errors.lastName ? 'error' : ''}
              placeholder="Enter your last name"
              autoComplete="family-name"
              disabled={isLoading}
            />
            {errors.lastName && <span className="error-text">{errors.lastName}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            onFocus={() => trackFormInteraction('register-form', 'email', 'focus')}
            onBlur={() => trackFormInteraction('register-form', 'email', 'blur')}
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
              onFocus={() => trackFormInteraction('register-form', 'password', 'focus')}
              onBlur={() => trackFormInteraction('register-form', 'password', 'blur')}
              className={errors.password ? 'error' : ''}
              placeholder="Create a password"
              autoComplete="new-password"
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
          
          {formData.password && (
            <div className="password-strength">
              <div className="strength-bar">
                <div 
                  className="strength-fill" 
                  style={{ 
                    width: `${passwordStrength}%`,
                    backgroundColor: getPasswordStrengthColor(passwordStrength)
                  }}
                />
              </div>
              <span 
                className="strength-label"
                style={{ color: getPasswordStrengthColor(passwordStrength) }}
              >
                {getPasswordStrengthLabel(passwordStrength)}
              </span>
            </div>
          )}
          
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-input-container">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              onFocus={() => trackFormInteraction('register-form', 'confirmPassword', 'focus')}
              onBlur={() => trackFormInteraction('register-form', 'confirmPassword', 'blur')}
              className={errors.confirmPassword ? 'error' : ''}
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => {
                setShowConfirmPassword(!showConfirmPassword);
                trackButtonClick('confirm-password-toggle', 'Toggle Confirm Password Visibility', { visible: !showConfirmPassword });
              }}
              disabled={isLoading}
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (errors.terms) {
                  setErrors(prev => ({ ...prev, terms: '' }));
                }
                trackFormInteraction('register-form', 'acceptTerms', 'change', e.target.checked.toString());
              }}
              disabled={isLoading}
            />
            <span>
              I agree to the{' '}
              <button
                type="button"
                className="terms-link"
                onClick={() => {
                  trackButtonClick('terms-link', 'Terms and Conditions');
                  alert('Terms and Conditions would be displayed here in a real application.');
                }}
                disabled={isLoading}
              >
                Terms and Conditions
              </button>
              {' '}and{' '}
              <button
                type="button"
                className="terms-link"
                onClick={() => {
                  trackButtonClick('privacy-link', 'Privacy Policy');
                  alert('Privacy Policy would be displayed here in a real application.');
                }}
                disabled={isLoading}
              >
                Privacy Policy
              </button>
            </span>
          </label>
          {errors.terms && <span className="error-text">{errors.terms}</span>}
        </div>

        <button
          type="submit"
          className="auth-submit-button"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="loading-spinner"></span>
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="demo-access-button"
          onClick={handleDemoRegister}
          disabled={isLoading}
        >
          🚀 Quick Demo Setup
        </button>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                trackButtonClick('switch-to-login', 'Switch to Login');
                onSwitchToLogin();
              }}
              disabled={isLoading}
            >
              Sign in
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;