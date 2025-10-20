import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { useAnalyticsAuth, useAnalytics, useRealTimeAnalytics } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAnalyticsAuth: jest.fn(),
  useAnalytics: jest.fn(),
  useRealTimeAnalytics: jest.fn(),
  AnalyticsAuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

const mockAnalyticsUser = {
  id: 'analyst-123',
  email: 'analyst@example.com',
  role: 'analytics_team',
  permissions: ['view_analytics', 'export_data', 'manage_filters']
};

const mockAnalyticsData = {
  totalUsers: 1250,
  activeUsers: 89,
  totalSessions: 3420,
  userJourneys: [
    {
      id: 'sarah',
      name: 'Sarah',
      role: 'First-time Homebuyer',
      completionRate: 85,
      journey: [
        { step: 'video_library', duration: 300 },
        { step: 'loan_calculator', duration: 180 }
      ]
    }
  ],
  realTimeData: {
    activeUsers: 89,
    recentEvents: [
      { type: 'video_start', count: 12 },
      { type: 'calculation_complete', count: 8 }
    ]
  }
};

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('Analytics Dashboard Workflows Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalyticsAuth as jest.Mock).mockReturnValue({
      user: mockAnalyticsUser,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false
    });
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockAnalyticsData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: mockAnalyticsData.realTimeData,
      connected: true
    });
    
    // Mock all API calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsData)
    });
  });

  describe('Complete Analytics Team Journey', () => {
    it('allows analytics team member to navigate through all dashboard features', async () => {
      const user = userEvent.setup();
      renderApp();
      
      // Start at main dashboard
      expect(screen.getByText(/analytics dashboard/i)).toBeInTheDocument();
      expect(screen.getByText('1,250')).toBeInTheDocument(); // Total users
      
      // Navigate to User Journey page
      const userJourneyLink = screen.getByRole('link', { name: /user journey/i });
      await user.click(userJourneyLink);
      
      expect(screen.getByText(/user journey analytics/i)).toBeInTheDocument();
      expect(screen.getByText('Sarah')).toBeInTheDocument();
      
      // Navigate to Real-time page
      const realTimeLink = screen.getByRole('link', { name: /real-time/i });
      await user.click(realTimeLink);
      
      expect(screen.getByText(/real-time monitor/i)).toBeInTheDocument();
      expect(screen.getByText('89')).toBeInTheDocument(); // Active users
      
      // Navigate to Exports page
      const exportsLink = screen.getByRole('link', { name: /exports/i });
      await user.click(exportsLink);
      
      expect(screen.getByText(/export analytics data/i)).toBeInTheDocument();
      
      // Navigate to Metrics page
      const metricsLink = screen.getByRole('link', { name: /metrics/i });
      await user.click(metricsLink);
      
      expect(screen.getByText(/detailed metrics/i)).toBeInTheDocument();
    });
  });

  describe('Data Analysis Workflow', () => {
    it('completes comprehensive data analysis session', async () => {
      const user = userEvent.setup();
      renderApp();
      
      // Start with filtering data
      const dateRangeSelect = screen.getByLabelText(/date range/i);
      await user.selectOptions(dateRangeSelect, 'last-7-days');
      
      // Apply user segment filter
      const segmentFilter = screen.getByLabelText(/user segment/i);
      await user.selectOptions(segmentFilter, 'high-engagement');
      
      // View detailed user journey
      const userJourneyLink = screen.getByRole('link', { name: /user journey/i });
      await user.click(userJourneyLink);
      
      // Analyze specific persona
      const sarahCard = screen.getByText('Sarah').closest('.persona-card');
      await user.click(sarahCard!);
      
      // Should show detailed timeline
      expect(screen.getByText(/detailed journey timeline/i)).toBeInTheDocument();
      
      // Export the analysis
      const exportButton = screen.getByRole('button', { name: /export journey data/i });
      await user.click(exportButton);
      
      const csvExport = screen.getByRole('button', { name: /csv/i });
      await user.click(csvExport);
      
      // Verify export was triggered
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/analytics/export'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Real-time Monitoring Workflow', () => {
    it('monitors real-time data and responds to events', async () => {
      const user = userEvent.setup();
      renderApp();
      
      // Navigate to real-time monitor
      const realTimeLink = screen.getByRole('link', { name: /real-time/i });
      await user.click(realTimeLink);
      
      // Verify real-time connection
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
      expect(screen.getByText('89')).toBeInTheDocument(); // Active users
      
      // Filter events by type
      const eventFilter = screen.getByLabelText(/filter events/i);
      await user.selectOptions(eventFilter, 'video_start');
      
      // Should show only video events
      expect(screen.getByText('12 video starts')).toBeInTheDocument();
      
      // Expand event details
      const eventItem = screen.getByText('video_start').closest('.event-item');
      const expandButton = within(eventItem!).getByRole('button', { name: /expand/i });
      await user.click(expandButton);
      
      // Should show detailed event information
      expect(screen.getByText(/event details/i)).toBeInTheDocument();
    });
  });

  describe('Export and Reporting Workflow', () => {
    it('creates comprehensive analytics report', async () => {
      const user = userEvent.setup();
      renderApp();
      
      // Navigate to exports
      const exportsLink = screen.getByRole('link', { name: /exports/i });
      await user.click(exportsLink);
      
      // Select PDF format for comprehensive report
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'pdf');
      
      // Select all data types
      await user.click(screen.getByLabelText(/user metrics/i));
      await user.click(screen.getByLabelText(/event data/i));
      await user.click(screen.getByLabelText(/page views/i));
      await user.click(screen.getByLabelText(/user journeys/i));
      
      // Set date range
      const startDate = screen.getByLabelText(/start date/i);
      const endDate = screen.getByLabelText(/end date/i);
      
      await user.type(startDate, '2024-01-01');
      await user.type(endDate, '2024-01-31');
      
      // Preview data before export
      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);
      
      // Verify preview shows expected data
      expect(screen.getByText(/data preview/i)).toBeInTheDocument();
      expect(screen.getByText(/1,250 total users/i)).toBeInTheDocument();
      
      // Generate report
      const generateButton = screen.getByRole('button', { name: /generate report/i });
      await user.click(generateButton);
      
      // Should show progress and complete
      expect(screen.getByText(/generating report/i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/analytics/export/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('userMetrics')
        });
      });
    });
  });

  describe('Collaborative Analysis Workflow', () => {
    it('shares insights and creates team reports', async () => {
      const user = userEvent.setup();
      renderApp();
      
      // Navigate to user journey analysis
      const userJourneyLink = screen.getByRole('link', { name: /user journey/i });
      await user.click(userJourneyLink);
      
      // Compare multiple personas
      const sarahCheckbox = screen.getByLabelText(/select sarah for comparison/i);
      await user.click(sarahCheckbox);
      
      // Add another persona (assuming Mike exists)
      const mikeCheckbox = screen.getByLabelText(/select mike for comparison/i);
      await user.click(mikeCheckbox);
      
      // Generate comparison
      const compareButton = screen.getByRole('button', { name: /compare selected/i });
      await user.click(compareButton);
      
      // Should show comparison view
      expect(screen.getByText(/persona comparison/i)).toBeInTheDocument();
      
      // Share insights
      const shareButton = screen.getByRole('button', { name: /share insights/i });
      await user.click(shareButton);
      
      // Fill sharing form
      const emailInput = screen.getByLabelText(/email addresses/i);
      await user.type(emailInput, 'team@example.com');
      
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Key insights from user journey analysis');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      expect(screen.getByText(/insights shared successfully/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles API failures gracefully and provides recovery options', async () => {
      const user = userEvent.setup();
      
      // Mock API failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      renderApp();
      
      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument();
      });
      
      // Retry should be available
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      
      // Mock successful retry
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAnalyticsData)
      });
      
      await user.click(retryButton);
      
      // Should recover and show data
      await waitFor(() => {
        expect(screen.getByText('1,250')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Data Synchronization', () => {
    it('handles real-time updates and maintains data consistency', async () => {
      const user = userEvent.setup();
      renderApp();
      
      // Initial state
      expect(screen.getByText('89')).toBeInTheDocument(); // Active users
      
      // Simulate real-time update
      const updatedRealTimeData = {
        activeUsers: 95,
        recentEvents: [
          { type: 'video_start', count: 15 },
          { type: 'calculation_complete', count: 10 }
        ]
      };
      
      (useRealTimeAnalytics as jest.Mock).mockReturnValue({
        data: updatedRealTimeData,
        connected: true
      });
      
      // Trigger re-render (simulating WebSocket update)
      const { rerender } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );
      
      // Should show updated data
      expect(screen.getByText('95')).toBeInTheDocument();
      
      // Navigate to real-time page to see detailed updates
      const realTimeLink = screen.getByRole('link', { name: /real-time/i });
      await user.click(realTimeLink);
      
      expect(screen.getByText('15 video starts')).toBeInTheDocument();
      expect(screen.getByText('10 calculations completed')).toBeInTheDocument();
    });
  });

  describe('Permission-based Access Control', () => {
    it('restricts features based on user permissions', async () => {
      const user = userEvent.setup();
      
      // Mock user with limited permissions
      (useAnalyticsAuth as jest.Mock).mockReturnValue({
        user: {
          ...mockAnalyticsUser,
          permissions: ['view_analytics'] // No export permissions
        },
        login: jest.fn(),
        logout: jest.fn(),
        loading: false
      });
      
      renderApp();
      
      // Navigate to exports page
      const exportsLink = screen.getByRole('link', { name: /exports/i });
      await user.click(exportsLink);
      
      // Should show permission denied message
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /export data/i })).not.toBeInTheDocument();
    });
  });
});