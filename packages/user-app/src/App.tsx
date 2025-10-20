import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@aws-agent/shared';
import ProductionErrorBoundary from './components/ProductionErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
// import { RealTimeProvider } from './contexts/RealTimeContext'; // Disabled for demo
import AuthWrapper from './components/Auth/AuthWrapper';
import UserHeader from './components/UserHeader';
import LoadingSpinner from './components/LoadingSpinner';
import { validateOnStartup } from './config/envValidation';
// import usePerformanceMonitoring from './hooks/usePerformanceMonitoring'; // Disabled for demo
import { cdnManager } from './utils/cdnHelpers';
import './App.css';

// Lazy load pages for code splitting
const HomePage = React.lazy(() => import('./pages/HomePage'));
const DemoPage = React.lazy(() => import('./pages/DemoPage'));
const VideoLibraryPage = React.lazy(() => import('./pages/VideoLibraryPage'));
const CalculatorPage = React.lazy(() => import('./pages/CalculatorPage'));
const DocumentUploadPage = React.lazy(() => import('./pages/DocumentUploadPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));

// Validate environment variables on app startup
validateOnStartup();

function App() {
  // Generate session ID for this app instance
  const sessionId = `user-session-${Date.now()}`;
  const userId = 'demo-user'; // In real app, this would come from auth context

  const isProduction = process.env.REACT_APP_ENVIRONMENT === 'production';
  const ErrorBoundaryComponent = isProduction ? ProductionErrorBoundary : ErrorBoundary;

  // Performance monitoring completely disabled for demo

  // Initialize CDN and preload critical assets
  React.useEffect(() => {
    if (isProduction) {
      cdnManager.preloadCriticalAssets();
      cdnManager.setupLazyLoading();
      
      // Register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered');
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      }
    }
  }, [isProduction]);

  return (
    <ErrorBoundaryComponent level="app">
      <AuthProvider>
        <Router>
            <div className="App">
              <ErrorBoundaryComponent level="page">
                <AuthWrapper requireAuth={false}>
                  <UserHeader />
                  <main className="app-main">
                    <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        <Route path="/" element={
                          <ErrorBoundaryComponent level="component">
                            <HomePage />
                          </ErrorBoundaryComponent>
                        } />
                        <Route path="/demo" element={
                          <ErrorBoundaryComponent level="component">
                            <DemoPage />
                          </ErrorBoundaryComponent>
                        } />
                        <Route path="/videos" element={
                          <ErrorBoundaryComponent level="component">
                            <VideoLibraryPage />
                          </ErrorBoundaryComponent>
                        } />
                        <Route path="/calculator" element={
                          <ErrorBoundaryComponent level="component">
                            <CalculatorPage />
                          </ErrorBoundaryComponent>
                        } />
                        <Route path="/documents" element={
                          <ErrorBoundaryComponent level="component">
                            <DocumentUploadPage />
                          </ErrorBoundaryComponent>
                        } />
                        <Route path="/profile" element={
                          <ErrorBoundaryComponent level="component">
                            <ProfilePage />
                          </ErrorBoundaryComponent>
                        } />
                        
                        {/* Redirect analytics routes to home - prevent access */}
                        <Route path="/analytics/*" element={<Navigate to="/" replace />} />
                        <Route path="/dashboard/*" element={<Navigate to="/" replace />} />
                        <Route path="/admin/*" element={<Navigate to="/" replace />} />
                        
                        {/* Catch all other routes */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </main>
                </AuthWrapper>
              </ErrorBoundaryComponent>
            </div>
          </Router>
      </AuthProvider>
    </ErrorBoundaryComponent>
  );
}

export default App;