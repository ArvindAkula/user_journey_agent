import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  overlay?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  message = 'Loading...', 
  overlay = false 
}) => {
  const containerClass = `loading-spinner ${overlay ? 'loading-spinner--overlay' : ''}`;
  const spinnerClass = `loading-spinner__spinner loading-spinner__spinner--${size}`;

  return (
    <div className={containerClass}>
      <div className="loading-spinner__content">
        <div className={spinnerClass}>
          <div className="loading-spinner__circle"></div>
        </div>
        {message && (
          <p className="loading-spinner__message">{message}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;