import React, { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

export interface LoginPageProps {
  onLoginSuccess?: (returnUrl?: string) => void;
  returnUrl?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * LoginPage component with email/password form.
 * 
 * This component provides a complete login form with error handling and loading states.
 * After successful login, it calls onLoginSuccess callback which should handle navigation.
 * 
 * @example
 * ```tsx
 * import { useNavigate, useLocation } from 'react-router-dom';
 * 
 * const navigate = useNavigate();
 * const location = useLocation();
 * const from = location.state?.from || '/';
 * 
 * <LoginPage
 *   onLoginSuccess={() => navigate(from, { replace: true })}
 *   returnUrl={from}
 * />
 * ```
 */
export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  returnUrl = '/',
  title = 'Login',
  subtitle = 'Enter your credentials to access your account',
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, error: authError } = useAuth();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    // Basic validation
    if (!email || !password) {
      setLocalError('Please enter both email and password');
      setIsSubmitting(false);
      return;
    }

    if (!email.includes('@')) {
      setLocalError('Please enter a valid email address');
      setIsSubmitting(false);
      return;
    }

    try {
      await login({ email, password });
      
      // Call success callback if provided
      if (onLoginSuccess) {
        onLoginSuccess(returnUrl);
      }
    } catch (error: any) {
      setLocalError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className={`login-page ${className}`} style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {displayError && (
            <div style={styles.errorBox} role="alert">
              {displayError}
            </div>
          )}

          <div style={styles.formGroup}>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
              autoComplete="email"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...styles.button,
              ...(isSubmitting ? styles.buttonDisabled : {}),
            }}
          >
            {isSubmitting ? (
              <span style={styles.buttonContent}>
                <LoadingSpinner />
                <span style={styles.buttonText}>Logging in...</span>
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// Basic inline styles - can be overridden with className prop
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  },
  header: {
    marginBottom: '30px',
    textAlign: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: '500',
    color: 'white',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginTop: '10px',
  },
  buttonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  buttonText: {
    marginLeft: '8px',
  },
  errorBox: {
    padding: '12px',
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '4px',
    color: '#c33',
    fontSize: '14px',
  },
};
