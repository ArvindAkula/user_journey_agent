import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MetricsOverview } from '../MetricsOverview';
import { useAnalytics } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useAnalytics: jest.fn()
}));

describe('MetricsOverview Component', () => {
  const mockMetricsData = {
    totalUsers: 1250,
    activeUsers: 890,
    conversionRate: 0.15,
    avgSessionDuration: 420,
    bounceRate: 0.35,
    pageViews: 15600,
    uniquePageViews: 12400,
    newUsers: 340
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders metrics overview with data', async () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    expect(screen.getByText('Metrics Overview')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument(); // Total users
    expect(screen.getByText('890')).toBeInTheDocument(); // Active users
    expect(screen.getByText('15.0%')).toBeInTheDocument(); // Conversion rate
    expect(screen.getByText('7m 0s')).toBeInTheDocument(); // Avg session duration
  });

  it('shows loading state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    expect(screen.getByTestId('metrics-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to fetch metrics',
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    expect(screen.getByTestId('metrics-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch metrics')).toBeInTheDocument();
  });

  it('displays metric cards with proper formatting', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    // Check metric cards
    expect(screen.getByTestId('total-users-card')).toBeInTheDocument();
    expect(screen.getByTestId('active-users-card')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-rate-card')).toBeInTheDocument();
    expect(screen.getByTestId('session-duration-card')).toBeInTheDocument();

    // Check formatting
    expect(screen.getByText('35.0%')).toBeInTheDocument(); // Bounce rate
    expect(screen.getByText('15,600')).toBeInTheDocument(); // Page views
  });

  it('shows trend indicators', () => {
    const dataWithTrends = {
      ...mockMetricsData,
      trends: {
        totalUsers: { change: 12.5, direction: 'up' },
        activeUsers: { change: -5.2, direction: 'down' },
        conversionRate: { change: 8.1, direction: 'up' }
      }
    };

    (useAnalytics as jest.Mock).mockReturnValue({
      data: dataWithTrends,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
    expect(screen.getByTestId('trend-down')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
    expect(screen.getByText('-5.2%')).toBeInTheDocument();
  });

  it('refreshes data when refresh button is clicked', async () => {
    const mockFetchMetrics = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: mockFetchMetrics
    });

    render(<MetricsOverview />);

    const refreshButton = screen.getByTestId('refresh-metrics');
    refreshButton.click();

    expect(mockFetchMetrics).toHaveBeenCalled();
  });

  it('displays time range selector', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('updates metrics when time range changes', async () => {
    const mockFetchMetrics = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: mockFetchMetrics
    });

    render(<MetricsOverview />);

    const timeRangeSelector = screen.getByTestId('time-range-selector');
    fireEvent.change(timeRangeSelector, { target: { value: 'last30days' } });

    await waitFor(() => {
      expect(mockFetchMetrics).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date)
        })
      });
    });
  });

  it('renders with accessibility attributes', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockMetricsData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    const overview = screen.getByTestId('metrics-overview');
    expect(overview).toHaveAttribute('role', 'region');
    expect(overview).toHaveAttribute('aria-label', 'Metrics Overview');

    const metricCards = screen.getAllByTestId(/.*-card$/);
    metricCards.forEach(card => {
      expect(card).toHaveAttribute('role', 'article');
    });
  });

  it('handles large numbers formatting', () => {
    const largeNumbersData = {
      ...mockMetricsData,
      totalUsers: 1250000,
      pageViews: 15600000
    };

    (useAnalytics as jest.Mock).mockReturnValue({
      data: largeNumbersData,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    expect(screen.getByText('1.25M')).toBeInTheDocument(); // Total users
    expect(screen.getByText('15.6M')).toBeInTheDocument(); // Page views
  });

  it('shows comparison with previous period', () => {
    const dataWithComparison = {
      ...mockMetricsData,
      previousPeriod: {
        totalUsers: 1100,
        activeUsers: 820,
        conversionRate: 0.13
      }
    };

    (useAnalytics as jest.Mock).mockReturnValue({
      data: dataWithComparison,
      loading: false,
      error: null,
      fetchMetricsOverview: jest.fn()
    });

    render(<MetricsOverview />);

    expect(screen.getByText('vs previous period')).toBeInTheDocument();
    expect(screen.getByText('+13.6%')).toBeInTheDocument(); // Total users change
    expect(screen.getByText('+8.5%')).toBeInTheDocument(); // Active users change
  });
});