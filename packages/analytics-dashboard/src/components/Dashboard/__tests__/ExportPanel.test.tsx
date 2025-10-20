import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportPanel from '../ExportPanel';
import { useAnalytics } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useAnalytics: jest.fn()
}));

// Mock file download
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock link click
const mockClick = jest.fn();
HTMLAnchorElement.prototype.click = mockClick;

const mockAnalyticsData = {
  userMetrics: [
    { userId: 'user-1', sessions: 5, totalTime: 1200, lastActive: '2024-01-01' },
    { userId: 'user-2', sessions: 3, totalTime: 800, lastActive: '2024-01-02' }
  ],
  eventData: [
    { eventType: 'video_start', count: 150, date: '2024-01-01' },
    { eventType: 'calculation_complete', count: 89, date: '2024-01-01' }
  ],
  pageViews: [
    { page: '/calculator', views: 1200, uniqueUsers: 800 },
    { page: '/videos', views: 980, uniqueUsers: 650 }
  ]
};

describe('ExportPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockAnalyticsData,
      loading: false,
      error: null
    });
    
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
    
    // Mock fetch for export API
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['export data']))
    });
  });

  it('renders export panel with available formats', () => {
    render(<ExportPanel />);
    
    expect(screen.getByText(/export analytics data/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/export format/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /csv/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /json/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /excel/i })).toBeInTheDocument();
  });

  it('displays data type selection options', () => {
    render(<ExportPanel />);
    
    expect(screen.getByText(/select data to export/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user metrics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/event data/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/page views/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user journeys/i)).toBeInTheDocument();
  });

  it('shows date range selector', () => {
    render(<ExportPanel />);
    
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /last 7 days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /last 30 days/i })).toBeInTheDocument();
  });

  it('exports CSV data when CSV format is selected', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    // Select CSV format
    const formatSelect = screen.getByLabelText(/export format/i);
    await user.selectOptions(formatSelect, 'csv');
    
    // Select user metrics
    const userMetricsCheckbox = screen.getByLabelText(/user metrics/i);
    await user.click(userMetricsCheckbox);
    
    // Export
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });
  });

  it('exports JSON data when JSON format is selected', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    // Select JSON format
    const formatSelect = screen.getByLabelText(/export format/i);
    await user.selectOptions(formatSelect, 'json');
    
    // Select event data
    const eventDataCheckbox = screen.getByLabelText(/event data/i);
    await user.click(eventDataCheckbox);
    
    // Export
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'application/json'
        })
      );
    });
  });

  it('generates PDF report when PDF format is selected', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    // Select PDF format
    const formatSelect = screen.getByLabelText(/export format/i);
    await user.selectOptions(formatSelect, 'pdf');
    
    // Select all data types
    await user.click(screen.getByLabelText(/user metrics/i));
    await user.click(screen.getByLabelText(/event data/i));
    await user.click(screen.getByLabelText(/page views/i));
    
    // Export
    const exportButton = screen.getByRole('button', { name: /generate report/i });
    await user.click(exportButton);
    
    // Should call API for PDF generation
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/analytics/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('userMetrics')
      });
    });
  });

  it('validates date range selection', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    // Set end date before start date
    const startDate = screen.getByLabelText(/start date/i);
    const endDate = screen.getByLabelText(/end date/i);
    
    await user.type(startDate, '2024-01-15');
    await user.type(endDate, '2024-01-10');
    
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);
    
    expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
  });

  it('requires at least one data type to be selected', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    // Try to export without selecting any data types
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);
    
    expect(screen.getByText(/please select at least one data type/i)).toBeInTheDocument();
  });

  it('shows export progress during generation', async () => {
    const user = userEvent.setup();
    
    // Mock slow API response
    global.fetch = jest.fn(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['export data']))
        }), 1000)
      )
    );
    
    render(<ExportPanel />);
    
    const formatSelect = screen.getByLabelText(/export format/i);
    await user.selectOptions(formatSelect, 'csv');
    
    const userMetricsCheckbox = screen.getByLabelText(/user metrics/i);
    await user.click(userMetricsCheckbox);
    
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);
    
    // Should show progress indicator
    expect(screen.getByText(/generating export/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    global.fetch = jest.fn().mockRejectedValue(new Error('Export failed'));
    
    render(<ExportPanel />);
    
    const formatSelect = screen.getByLabelText(/export format/i);
    await user.selectOptions(formatSelect, 'pdf');
    
    const userMetricsCheckbox = screen.getByLabelText(/user metrics/i);
    await user.click(userMetricsCheckbox);
    
    const exportButton = screen.getByRole('button', { name: /generate report/i });
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(screen.getByText(/export failed/i)).toBeInTheDocument();
    });
  });

  it('displays export history', () => {
    render(<ExportPanel />);
    
    expect(screen.getByText(/recent exports/i)).toBeInTheDocument();
    
    // Mock export history
    const mockHistory = [
      { id: 'export-1', format: 'csv', dataTypes: ['userMetrics'], createdAt: '2024-01-01T10:00:00Z' },
      { id: 'export-2', format: 'pdf', dataTypes: ['eventData', 'pageViews'], createdAt: '2024-01-01T09:00:00Z' }
    ];
    
    // Should show history items
    mockHistory.forEach(item => {
      expect(screen.getByText(item.format.toUpperCase())).toBeInTheDocument();
    });
  });

  it('allows scheduling recurring exports', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    const scheduleToggle = screen.getByLabelText(/schedule recurring export/i);
    await user.click(scheduleToggle);
    
    // Should show scheduling options
    expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /daily/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /weekly/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /monthly/i })).toBeInTheDocument();
    
    // Select weekly frequency
    const frequencySelect = screen.getByLabelText(/frequency/i);
    await user.selectOptions(frequencySelect, 'weekly');
    
    // Set email for delivery
    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'admin@example.com');
    
    const scheduleButton = screen.getByRole('button', { name: /schedule export/i });
    await user.click(scheduleButton);
    
    expect(screen.getByText(/export scheduled successfully/i)).toBeInTheDocument();
  });

  it('filters data by user segments', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    const segmentFilter = screen.getByLabelText(/filter by user segment/i);
    await user.selectOptions(segmentFilter, 'high-engagement');
    
    // Should update data preview
    expect(screen.getByText(/filtered by: high-engagement users/i)).toBeInTheDocument();
  });

  it('shows data preview before export', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    const userMetricsCheckbox = screen.getByLabelText(/user metrics/i);
    await user.click(userMetricsCheckbox);
    
    const previewButton = screen.getByRole('button', { name: /preview data/i });
    await user.click(previewButton);
    
    // Should show data preview
    expect(screen.getByText(/data preview/i)).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('5 sessions')).toBeInTheDocument();
  });

  it('estimates export file size', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    
    const userMetricsCheckbox = screen.getByLabelText(/user metrics/i);
    await user.click(userMetricsCheckbox);
    
    const eventDataCheckbox = screen.getByLabelText(/event data/i);
    await user.click(eventDataCheckbox);
    
    // Should show estimated file size
    expect(screen.getByText(/estimated size/i)).toBeInTheDocument();
    expect(screen.getByText(/~2.5 MB/i)).toBeInTheDocument();
  });
});