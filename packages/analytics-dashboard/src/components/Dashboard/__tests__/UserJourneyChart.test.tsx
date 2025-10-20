import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserJourneyChart } from '../UserJourneyChart';
import { useAnalytics } from '@aws-agent/shared';

// Mock Chart.js
jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
    resize: jest.fn()
  }))
}));

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useAnalytics: jest.fn()
}));

describe('UserJourneyChart Component', () => {
  const mockJourneyData = [
    { step: 'Landing Page', users: 1000, dropoffRate: 0.1, conversionRate: 0.9 },
    { step: 'Sign Up', users: 900, dropoffRate: 0.15, conversionRate: 0.85 },
    { step: 'Onboarding', users: 765, dropoffRate: 0.12, conversionRate: 0.88 },
    { step: 'First Feature Use', users: 673, dropoffRate: 0.08, conversionRate: 0.92 },
    { step: 'Active User', users: 619, dropoffRate: 0.05, conversionRate: 0.95 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user journey chart with data', async () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    expect(screen.getByText('User Journey Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('journey-chart-container')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    expect(screen.getByTestId('journey-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading journey data...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to fetch journey data',
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    expect(screen.getByTestId('journey-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch journey data')).toBeInTheDocument();
  });

  it('displays journey steps with metrics', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    // Check journey steps
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('First Feature Use')).toBeInTheDocument();
    expect(screen.getByText('Active User')).toBeInTheDocument();

    // Check metrics
    expect(screen.getByText('1,000 users')).toBeInTheDocument();
    expect(screen.getByText('900 users')).toBeInTheDocument();
    expect(screen.getByText('10.0% dropoff')).toBeInTheDocument();
    expect(screen.getByText('15.0% dropoff')).toBeInTheDocument();
  });

  it('highlights bottlenecks in the journey', () => {
    const dataWithBottleneck = mockJourneyData.map((step, index) => 
      index === 1 ? { ...step, dropoffRate: 0.35 } : step
    );

    (useAnalytics as jest.Mock).mockReturnValue({
      data: dataWithBottleneck,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    expect(screen.getByTestId('bottleneck-indicator')).toBeInTheDocument();
    expect(screen.getByText('High dropoff detected')).toBeInTheDocument();
  });

  it('allows filtering by user segment', async () => {
    const mockFetchJourney = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: mockFetchJourney
    });

    render(<UserJourneyChart />);

    const segmentFilter = screen.getByTestId('segment-filter');
    fireEvent.change(segmentFilter, { target: { value: 'new_users' } });

    await waitFor(() => {
      expect(mockFetchJourney).toHaveBeenCalledWith({
        filters: expect.objectContaining({
          userSegments: ['new_users']
        })
      });
    });
  });

  it('allows filtering by time period', async () => {
    const mockFetchJourney = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: mockFetchJourney
    });

    render(<UserJourneyChart />);

    const timeFilter = screen.getByTestId('time-period-filter');
    fireEvent.change(timeFilter, { target: { value: 'last30days' } });

    await waitFor(() => {
      expect(mockFetchJourney).toHaveBeenCalledWith({
        filters: expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date)
          })
        })
      });
    });
  });

  it('shows detailed metrics on step hover', async () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    const firstStep = screen.getByTestId('journey-step-0');
    fireEvent.mouseEnter(firstStep);

    await waitFor(() => {
      expect(screen.getByTestId('step-tooltip')).toBeInTheDocument();
      expect(screen.getByText('Conversion Rate: 90.0%')).toBeInTheDocument();
      expect(screen.getByText('Users: 1,000')).toBeInTheDocument();
    });
  });

  it('allows comparison between time periods', async () => {
    const mockFetchJourney = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: mockFetchJourney
    });

    render(<UserJourneyChart />);

    const compareToggle = screen.getByTestId('compare-periods-toggle');
    fireEvent.click(compareToggle);

    expect(screen.getByTestId('comparison-period-selector')).toBeInTheDocument();

    const comparisonPeriod = screen.getByTestId('comparison-period-selector');
    fireEvent.change(comparisonPeriod, { target: { value: 'previous_month' } });

    await waitFor(() => {
      expect(mockFetchJourney).toHaveBeenCalledWith({
        comparison: {
          enabled: true,
          period: 'previous_month'
        }
      });
    });
  });

  it('exports journey data', async () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn(),
      exportData: jest.fn().mockResolvedValue(new Blob(['csv data']))
    });

    render(<UserJourneyChart />);

    const exportButton = screen.getByTestId('export-journey-data');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Export successful')).toBeInTheDocument();
    });
  });

  it('renders with accessibility attributes', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    const chart = screen.getByTestId('journey-chart-container');
    expect(chart).toHaveAttribute('role', 'img');
    expect(chart).toHaveAttribute('aria-label', 'User Journey Chart');

    const steps = screen.getAllByTestId(/journey-step-/);
    steps.forEach((step, index) => {
      expect(step).toHaveAttribute('role', 'button');
      expect(step).toHaveAttribute('aria-label', expect.stringContaining('Step'));
    });
  });

  it('handles empty data gracefully', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    expect(screen.getByTestId('no-journey-data')).toBeInTheDocument();
    expect(screen.getByText('No journey data available')).toBeInTheDocument();
  });

  it('updates chart when data changes', () => {
    const { rerender } = render(<UserJourneyChart />);

    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    rerender(<UserJourneyChart />);

    // Updated data
    const updatedData = [...mockJourneyData];
    updatedData[0].users = 1200;

    (useAnalytics as jest.Mock).mockReturnValue({
      data: updatedData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    rerender(<UserJourneyChart />);

    expect(screen.getByText('1,200 users')).toBeInTheDocument();
  });

  it('shows funnel visualization mode', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockJourneyData,
      loading: false,
      error: null,
      fetchUserJourneyData: jest.fn()
    });

    render(<UserJourneyChart />);

    const viewModeToggle = screen.getByTestId('view-mode-toggle');
    fireEvent.click(viewModeToggle);

    const funnelMode = screen.getByText('Funnel View');
    fireEvent.click(funnelMode);

    expect(screen.getByTestId('funnel-chart')).toBeInTheDocument();
  });
});