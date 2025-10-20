import React, { Suspense, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  ErrorBoundary, 
  AuthProvider, 
  LoginPage, 
  ProtectedRoute,
  AuthService,
  UserRole
} from '@aws-agent/shared';
import ProductionErrorBoundary from './components/ProductionErrorBoundary';
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
const UnauthorizedPage = React.lazy(() => import('./pages/UnauthorizedPage'));



// Validate environment variables on app startup
validateOnStartup();

// Create auth service instance
const createAuthService = () => {
  const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
  const environment = process.env.REACT_APP_ENVIRONMENT || 'development';

  return new AuthService({
    baseURL,
    timeout: environment === 'production' ? 30000 : 15000,
    headers: {
      'X-Client-Type': 'analytics-dashboard',
      'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0',
      'X-Environment': environment
    },
    tokenStorageKey: `analytics_access_token_${environment}`,
    refreshTokenKey: `analytics_refresh_token_${environment}`
  });
};

// Login Page Wrapper with navigation
const LoginPageWrapper: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/dashboard';

  return (
    <LoginPage
      title="Analytics Dashboard Login"
      subtitle="Enter your credentials to access the analytics dashboard"
      onLoginSuccess={() => navigate(from, { replace: true })}
      returnUrl={from}
    />
  );
};

// Main App Routes Component
const AppRoutes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/login" element={<LoginPageWrapper />} />
      <Route path="/unauthorized" element={
        <Suspense fallback={<LoadingSpinner />}>
          <UnauthorizedPage />
        </Suspense>
      } />
      
      <Route path="/" element={
        <ProtectedRoute
          requiredRole={UserRole.ANALYST}
          onUnauthenticated={(returnUrl) => (
            <Navigate to="/login" state={{ from: returnUrl }} replace />
          )}
          onUnauthorized={() => <Navigate to="/unauthorized" replace />}
        >
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
        
        {/* Admin-only route */}
        <Route path="users" element={
          <ProtectedRoute
            requiredRole={UserRole.ADMIN}
            onUnauthorized={() => <Navigate to="/unauthorized" replace />}
          >
            <Suspense fallback={<LoadingSpinner />}>
              <ProductionErrorBoundary level="component">
                <UserManagement />
              </ProductionErrorBoundary>
            </Suspense>
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

function App() {
  const isProduction = process.env.REACT_APP_ENVIRONMENT === 'production';
  const ErrorBoundaryComponent = isProduction ? ProductionErrorBoundary : ErrorBoundary;

  // Create auth service instance (memoized to prevent recreation)
  const authService = useMemo(() => createAuthService(), []);

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
      <AuthProvider authService={authService}>
        <Router>
          <div className="analytics-app">
            <ErrorBoundaryComponent level="page">
              <AppRoutes />
            </ErrorBoundaryComponent>
          </div>
        </Router>
        <PerformanceMonitor />
      </AuthProvider>
    </ErrorBoundaryComponent>
  );
}

export default App;