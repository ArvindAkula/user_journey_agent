import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsDashboard from '../AnalyticsDashboard';
import { useAnalytics, useRealTimeAnalytics } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAnalytics: jest.fn(),
  useRealTimeAnalytics: jest.fn(),
  useAnalyticsAuth: jest.fn()
}));

const mockAnalyticsData = {
  totalUsers: 1250,
  activeUsers: 89,
  totalSessions: 3420,
  averageSessionDuration: 285,
  conversionRate: 12.5,
  topPages: [
    { page: '/calculator', views: 1200, uniqueUsers: 800 },
    { page: '/videos', views: 980, uniqueUsers: 650 },
    { page: '/documents', views: 750, uniqueUsers: 500 }
  ],
  userJourneyMetrics: {
    completionRate: 68.5,
    dropoffPoints: [
      { step: 'calculator', dropoffRate: 15.2 },
      { step: 'documents', dropoffRate: 8.7 }
    ]
  }
};

const mockRealTimeData = {
  activeUsers: 89,
  currentSessions: 45,
  recentEvents: [
    { type: 'video_start', count: 12, timestamp: new Date() },
    { type: 'calculation_complete', count: 8, timestamp: new Date() }
  ]
};

describe('AnalyticsDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockAnalyticsData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: mockRealTimeData,
      connected: true
    });
  });

  it('renders dashboard with key metrics', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText(/analytics dashboard/i)).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument(); // Total users
    expect(screen.getByText('89')).toBeInTheDocument(); // Active users
    expect(screen.getByText('3,420')).toBeInTheDocument(); // Total sessions
    expect(screen.getByText('4:45')).toBeInTheDocument(); // Average session duration
  });

  it('displays conversion rate and user journey metrics', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText('12.5%')).toBeInTheDocument(); // Conversion rate
    expect(screen.getByText('68.5%')).toBeInTheDocument(); // Journey completion rate
  });

  it('shows top pages with metrics', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText('/calculator')).toBeInTheDocument();
    expect(screen.getByText('1,200 views')).toBeInTheDocument();
    expect(screen.getByText('800 unique users')).toBeInTheDocument();
    
    expect(screen.getByText('/videos')).toBeInTheDocument();
    expect(screen.getByText('/documents')).toBeInTheDocument();
  });

  it('displays real-time data when connected', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText(/real-time/i)).toBeInTheDocument();
    expect(screen.getByText('45 active sessions')).toBeInTheDocument();
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('handles date range filtering', async () => {
    const user = userEvent.setup();
    const mockRefetch = jest.fn();
    
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockAnalyticsData,
      loading: false,
      error: null,
      refetch: mockRefetch
    });
    
    render(<AnalyticsDashboard />);
    
    const dateRangeSelect = screen.getByLabelText(/date range/i);
    await user.selectOptions(dateRangeSelect, 'last-7-days');
    
    expect(mockRefetch).toHaveBeenCalledWith({
      dateRange: 'last-7-days'
    });
  });

  it('displays loading state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn()
    });
    
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Failed to load analytics'),
      refetch: jest.fn()
    });
    
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows dropoff analysis', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText(/dropoff analysis/i)).toBeInTheDocument();
    expect(screen.getByText('calculator: 15.2% dropoff')).toBeInTheDocument();
    expect(screen.getByText('documents: 8.7% dropoff')).toBeInTheDocument();
  });

  it('displays recent events from real-time data', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    expect(screen.getByText('12 video starts')).toBeInTheDocument();
    expect(screen.getByText('8 calculations completed')).toBeInTheDocument();
  });

  it('handles real-time connection status', () => {
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: mockRealTimeData,
      connected: false
    });
    
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const mockRefetch = jest.fn();
    
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockAnalyticsData,
      loading: false,
      error: null,
      refetch: mockRefetch
    });
    
    render(<AnalyticsDashboard />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);
    
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('displays time-based metrics correctly', () => {
    render(<AnalyticsDashboard />);
    
    // Check that session duration is formatted correctly (285 seconds = 4:45)
    expect(screen.getByText('4:45')).toBeInTheDocument();
  });

  it('shows percentage changes for metrics', () => {
    const dataWithChanges = {
      ...mockAnalyticsData,
      totalUsersChange: 15.2,
      activeUsersChange: -5.1,
      sessionsChange: 8.7
    };
    
    (useAnalytics as jest.Mock).mockReturnValue({
      data: dataWithChanges,
      loading: false,
      error: null,
      refetch: jest.fn()
    });
    
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText('+15.2%')).toBeInTheDocument();
    expect(screen.getByText('-5.1%')).toBeInTheDocument();
    expect(screen.getByText('+8.7%')).toBeInTheDocument();
  });
});