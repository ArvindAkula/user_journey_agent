import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@aws-agent/shared';
import { validateOnStartup } from '@aws-agent/shared/config/envValidation';
import './index.css';

// Validate environment variables on startup
try {
  validateOnStartup();
} catch (error) {
  console.error('Environment validation failed:', error);
  // Display error to user
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: monospace; background: #fee; color: #c00;">
      <h1>Configuration Error</h1>
      <p><strong>The application cannot start due to missing environment variables.</strong></p>
      <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p>Please check the console for more details.</p>
    </div>
  `;
  throw error;
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found!');
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement as HTMLElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);