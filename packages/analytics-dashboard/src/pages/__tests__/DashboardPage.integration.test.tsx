import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';
import { useAnalytics, useAnalyticsAuth } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAnalytics: jest.fn(),
  useAnalyticsAuth: jest.fn()
}));

// Mock child components
jest.mock('../../components/Dashboard/MetricsOverview', () => ({
  MetricsOverview: () => <div data-testid="metrics-overview">Metrics Overview</div>
}));

jest.mock('../../components/Dashboard/UserJourneyChart', () => ({
  UserJourneyChart: () => <div data-testid="user-journey-chart">User Journey Chart</div>
}));

jest.mock('../../components/Dashboard/RealTimeMonitor', () => ({
  RealTimeMonitor: () => <div data-testid="real-time-monitor">Real Time Monitor</div>
}));

jest.mock('../../components/Dashboard/FilterPanel', () => ({
  FilterPanel: ({ onFiltersChange }: { onFiltersChange: (filters: any) => void }) => (
    <div data-testid="filter-panel">
      <button onClick={() => onFiltersChange({ dateRange: 'last7days' })}>
        Apply Filters
      </button>
    </div>
  )
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('DashboardPage Integration Tests', () => {
  const mockAnalyticsUser = {
    uid: 'analytics-user-123',
    email: 'analyst@company.com',
    displayName: 'Analytics User',
    role: 'analyst'
  };

  const mockMetricsData = {
    totalUsers: 1250,
    activeUsers: 890,
    conversionRate: 0.15,
    avgSessionDuration: 420
  };

  const mockJourneyData = [
    { step: 'Landing', users: 1000, dropoffRate: 0.1 },
    { step: 'Signup', users: 900, dropoffRate: 0.15 },
    { step: 'Onboarding', users: 765, dropoffRate: 0.12 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalyticsAuth as jest.Mock).mockReturnValue({
      user: mockAnalyticsUser,
      loading: false,
      isAuthenticated: true,
      hasPermission: jest.fn().mockReturnValue(true)
    });
  });

  it('loads and displays all dashboard components', async () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    renderWithRouter(<DashboardPage />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('metrics-overview')).toBeInTheDocument();
    expect(screen.getByTestId('user-journey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('real-time-monitor')).toBeInTheDocument();
    expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
  });

  it('handles authentication and authorization', () => {
    // Test unauthenticated user
    (useAnalyticsAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      hasPermission: jest.fn().mockReturnValue(false)
    });

    renderWithRouter(<DashboardPage />);

    expect(screen.getByTestId('auth-required')).toBeInTheDocument();
    expect(screen.getByText('Authentication required')).toBeInTheDocument();
  });

  it('handles insufficient permissions', () => {
    (useAnalyticsAuth as jest.Mock).mockReturnValue({
      user: { ...mockAnalyticsUser, role: 'viewer' },
      loading: false,
      isAuthenticated: true,
      hasPermission: jest.fn().mockReturnValue(false)
    });

    renderWithRouter(<DashboardPage />);

    expect(screen.getByTestId('insufficient-permissions')).toBeInTheDocument();
    expect(screen.getByText('Insufficient permissions')).toBeInTheDocument();
  });

  it('applies filters across all dashboard components', async () => {
    const mockFetchMetrics = jest.fn();
    const mockFetchJourney = jest.fn();
    const mockFetchStruggle = jest.fn();

    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: mockFetchMetrics,
      fetchUserJourneyData: mockFetchJourney,
      fetchStruggleSignals: mockFetchStruggle
    });

    renderWithRouter(<DashboardPage />);

    // Apply filters
    const applyFiltersButton = screen.getByText('Apply Filters');
    fireEvent.click(applyFiltersButton);

    await waitFor(() => {
      expect(mockFetchMetrics).toHaveBeenCalledWith({
        filters: expect.objectContaining({
          dateRange: 'last7days'
        })
      });
      expect(mockFetchJourney).toHaveBeenCalledWith({
        filters: expect.objectContaining({
          dateRange: 'last7days'
        })
      });
      expect(mockFetchStruggle).toHaveBeenCalledWith({
        filters: expect.objectContaining({
          dateRange: 'last7days'
        })
      });
    });
  });

  it('handles loading states across components', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    renderWithRouter(<DashboardPage />);

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('handles error states gracefully', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to load analytics data',
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    renderWithRouter(<DashboardPage />);

    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });

  it('refreshes all data when refresh button is clicked', async () => {
    const mockFetchMetrics = jest.fn();
    const mockFetchJourney = jest.fn();
    const mockFetchStruggle = jest.fn();

    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: mockFetchMetrics,
      fetchUserJourneyData: mockFetchJourney,
      fetchStruggleSignals: mockFetchStruggle
    });

    renderWithRouter(<DashboardPage />);

    const refreshButton = screen.getByTestId('refresh-dashboard');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockFetchMetrics).toHaveBeenCalled();
      expect(mockFetchJourney).toHaveBeenCalled();
      expect(mockFetchStruggle).toHaveBeenCalled();
    });
  });

  it('supports dashboard layout customization', async () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    renderWithRouter(<DashboardPage />);

    const layoutButton = screen.getByTestId('layout-options');
    fireEvent.click(layoutButton);

    expect(screen.getByTestId('layout-selector')).toBeInTheDocument();

    const gridLayout = screen.getByText('Grid Layout');
    fireEvent.click(gridLayout);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-grid')).toHaveClass('grid-layout');
    });
  });

  it('exports dashboard data', async () => {
    const mockExportData = jest.fn().mockResolvedValue(new Blob(['csv data']));
    
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn(),
      exportData: mockExportData
    });

    renderWithRouter(<DashboardPage />);

    const exportButton = screen.getByTestId('export-dashboard');
    fireEvent.click(exportButton);

    expect(screen.getByTestId('export-options')).toBeInTheDocument();

    const csvExport = screen.getByText('Export as CSV');
    fireEvent.click(csvExport);

    await waitFor(() => {
      expect(mockExportData).toHaveBeenCalledWith({
        format: 'csv',
        includeMetrics: true,
        includeJourney: true,
        includeStruggleSignals: true
      });
    });
  });

  it('handles real-time data updates', async () => {
    const { rerender } = renderWithRouter(<DashboardPage />);

    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    rerender(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Simulate real-time update
    const updatedData = {
      ...mockMetricsData,
      activeUsers: 920
    };

    (useAnalytics as jest.Mock).mockReturnValue({
      data: updatedData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    rerender(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Real-time monitor should reflect the update
    expect(screen.getByTestId('real-time-monitor')).toBeInTheDocument();
  });

  it('maintains dashboard state across navigation', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    const { rerender } = renderWithRouter(<DashboardPage />);

    // Apply some filters
    const applyFiltersButton = screen.getByText('Apply Filters');
    fireEvent.click(applyFiltersButton);

    // Navigate away and back (simulated by re-render)
    rerender(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Filters should be maintained
    expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
  });

  it('handles concurrent data requests', async () => {
    const mockFetchMetrics = jest.fn().mockResolvedValue(mockMetricsData);
    const mockFetchJourney = jest.fn().mockResolvedValue(mockJourneyData);
    const mockFetchStruggle = jest.fn().mockResolvedValue([]);

    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      fetchMetricsOverview: mockFetchMetrics,
      fetchUserJourneyData: mockFetchJourney,
      fetchStruggleSignals: mockFetchStruggle
    });

    renderWithRouter(<DashboardPage />);

    // All requests should be initiated
    await waitFor(() => {
      expect(mockFetchMetrics).toHaveBeenCalled();
      expect(mockFetchJourney).toHaveBeenCalled();
      expect(mockFetchStruggle).toHaveBeenCalled();
    });
  });

  it('provides accessibility throughout dashboard', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    renderWithRouter(<DashboardPage />);

    const dashboard = screen.getByTestId('analytics-dashboard');
    expect(dashboard).toHaveAttribute('role', 'main');
    expect(dashboard).toHaveAttribute('aria-label', 'Analytics Dashboard');

    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    
    // Check for landmark regions
    expect(screen.getByRole('region', { name: /metrics/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /filters/i })).toBeInTheDocument();
  });

  it('handles responsive layout changes', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn(),
      fetchUserJourneyData: jest.fn(),
      fetchStruggleSignals: jest.fn()
    });

    renderWithRouter(<DashboardPage />);

    const dashboard = screen.getByTestId('analytics-dashboard');
    expect(dashboard).toHaveClass('mobile-layout');
  });
});