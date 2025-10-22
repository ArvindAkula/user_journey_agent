import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@aws-agent/shared';
import ProductionErrorBoundary from './components/ProductionErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
// import { RealTimeProvider } from './contexts/RealTimeContext'; // Disabled for demo
import AuthWrapper from './components/Auth/AuthWrapper';
import ProtectedRoute from './components/ProtectedRoute';
import UserHeader from './components/UserHeader';
import LoadingSpinner from './components/LoadingSpinner';
import NavigationTracker from './components/NavigationTracker';
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
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const UnauthorizedPage = React.lazy(() => import('./pages/UnauthorizedPage'));

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
            <NavigationTracker />
            <div className="App">
              <ErrorBoundaryComponent level="page">
                <AuthWrapper requireAuth={false}>
                  <UserHeader />
                  <main className="app-main">
                    <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={
                          <ErrorBoundaryComponent level="component">
                            <LoginPage />
                          </ErrorBoundaryComponent>
                        } />
                        <Route path="/unauthorized" element={
                          <ErrorBoundaryComponent level="component">
                            <UnauthorizedPage />
                          </ErrorBoundaryComponent>
                        } />
                        
                        {/* Protected routes - require authentication */}
                        <Route path="/" element={
                          <ProtectedRoute>
                            <ErrorBoundaryComponent level="component">
                              <HomePage />
                            </ErrorBoundaryComponent>
                          </ProtectedRoute>
                        } />
                        <Route path="/demo" element={
                          <ProtectedRoute>
                            <ErrorBoundaryComponent level="component">
                              <DemoPage />
                            </ErrorBoundaryComponent>
                          </ProtectedRoute>
                        } />
                        <Route path="/videos" element={
                          <ProtectedRoute>
                            <ErrorBoundaryComponent level="component">
                              <VideoLibraryPage />
                            </ErrorBoundaryComponent>
                          </ProtectedRoute>
                        } />
                        <Route path="/calculator" element={
                          <ProtectedRoute>
                            <ErrorBoundaryComponent level="component">
                              <CalculatorPage />
                            </ErrorBoundaryComponent>
                          </ProtectedRoute>
                        } />
                        <Route path="/documents" element={
                          <ProtectedRoute>
                            <ErrorBoundaryComponent level="component">
                              <DocumentUploadPage />
                            </ErrorBoundaryComponent>
                          </ProtectedRoute>
                        } />
                        <Route path="/profile" element={
                          <ProtectedRoute>
                            <ErrorBoundaryComponent level="component">
                              <ProfilePage />
                            </ErrorBoundaryComponent>
                          </ProtectedRoute>
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