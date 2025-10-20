import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

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