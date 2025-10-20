import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { validateOnStartup } from '@aws-agent/shared/config/envValidation';

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

// Set up demo mode detection as early as possible
if (localStorage.getItem('analytics_demo_mode') === 'true') {
  console.log('Demo mode detected in index.tsx - setting up global overrides');
  
  // Override fetch globally to prevent any API calls
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = input.url;
    }
    
    if (url.includes('/api/') || url.includes('localhost:8080')) {
      console.log('Demo mode: blocking API call to', url);
      return Promise.resolve(new Response('{"success": true}', { 
        status: 200, 
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    return originalFetch.call(this, input, init);
  };
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);