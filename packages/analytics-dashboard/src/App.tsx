import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@aws-agent/shared';
import ProductionErrorBoundary from './components/ProductionErrorBoundary';
import { AnalyticsAuthProvider, useAnalyticsAuth } from './contexts/AnalyticsAuthContext';
import { AnalyticsLoginForm } from './components/Auth/AnalyticsLoginForm';
import { UserManagement } from './components/Auth/UserManagement';
import DashboardLayout from './components/Layout/DashboardLayout';
import LoadingSpinner from './components/LoadingSpinner';
import { validateOnStartup } from './config/envValidation';
import usePerformanceMonitoring from './hooks/usePerformanceMonitoring';
import { dashboardCDNManager } from './utils/cdnHelpers';
import './App.css';

// Lazy load pages for code splitting
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const MetricsPage = React.lazy(() => import('./pages/MetricsPage'));
const UserJourneyPage = React.lazy(() => import('./pages/UserJourneyPage'));
const RealTimePage = React.lazy(() => import('./pages/RealTimePage'));
const ExportsPage = React.lazy(() => import('./pages/ExportsPage'));



// Validate environment variables on app startup
validateOnStartup();

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAnalyticsAuth();
  
  // Check for demo mode first - bypass all authentication
  if (localStorage.getItem('analytics_demo_mode') === 'true') {
    console.log('Demo mode detected - bypassing authentication');
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#4a5568'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AnalyticsLoginForm />;
  }

  return <>{children}</>;
};

// Main App Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<AnalyticsLoginForm />} />
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ProductionErrorBoundary level="component">
              <DashboardPage />
            </ProductionErrorBoundary>
          </Suspense>
        } />
        <Route path="metrics" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ProductionErrorBoundary level="component">
              <MetricsPage />
            </ProductionErrorBoundary>
          </Suspense>
        } />
        <Route path="user-journey" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ProductionErrorBoundary level="component">
              <UserJourneyPage />
            </ProductionErrorBoundary>
          </Suspense>
        } />
        <Route path="realtime" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ProductionErrorBoundary level="component">
              <RealTimePage />
            </ProductionErrorBoundary>
          </Suspense>
        } />
        <Route path="exports" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ProductionErrorBoundary level="component">
              <ExportsPage />
            </ProductionErrorBoundary>
          </Suspense>
        } />
        <Route path="users" element={<UserManagement />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

function App() {
  const isProduction = process.env.REACT_APP_ENVIRONMENT === 'production';
  const ErrorBoundaryComponent = isProduction ? ProductionErrorBoundary : ErrorBoundary;

  // Initialize performance monitoring for dashboard
  const { PerformanceMonitor } = usePerformanceMonitoring({
    enableReporting: true,
    apiEndpoint: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/analytics/performance` : undefined,
    sampleRate: isProduction ? 0.2 : 1.0, // 20% sampling in production for dashboard, 100% in dev
  });

  // Initialize CDN and preload dashboard assets
  React.useEffect(() => {
    if (isProduction) {
      dashboardCDNManager.preloadCriticalAssets();
      dashboardCDNManager.preloadChartLibraries();
      dashboardCDNManager.setupResourceHints();
      dashboardCDNManager.optimizeVisualizationAssets();
      
      // Register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('Dashboard Service Worker registered:', registration);
            
            // Set up periodic cache cleanup
            setInterval(() => {
              registration.active?.postMessage({ type: 'CLEANUP_CACHE' });
            }, 60 * 60 * 1000); // Every hour
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      }
    }
  }, [isProduction]);

  return (
    <ErrorBoundaryComponent level="app">
      <AnalyticsAuthProvider>
        <Router>
          <div className="analytics-app">
            <ErrorBoundaryComponent level="page">
              <AppRoutes />
            </ErrorBoundaryComponent>
          </div>
        </Router>
        <PerformanceMonitor />
      </AnalyticsAuthProvider>
    </ErrorBoundaryComponent>
  );
}

export default App;