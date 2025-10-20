import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RealTimeMonitor from '../RealTimeMonitor';
import { useRealTimeAnalytics, useWebSocket } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useRealTimeAnalytics: jest.fn(),
  useWebSocket: jest.fn()
}));

const mockRealTimeData = {
  activeUsers: 127,
  currentSessions: 89,
  eventsPerMinute: 45,
  recentEvents: [
    {
      id: 'event-1',
      type: 'video_start',
      userId: 'user-123',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      data: { videoId: 'video-1', title: 'Loan Basics' }
    },
    {
      id: 'event-2',
      type: 'calculation_complete',
      userId: 'user-456',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      data: { principal: 200000, monthlyPayment: 1200 }
    },
    {
      id: 'event-3',
      type: 'document_upload',
      userId: 'user-789',
      timestamp: new Date('2024-01-01T10:02:00Z'),
      data: { fileName: 'contract.pdf', fileSize: 1024000 }
    }
  ],
  activePages: [
    { page: '/calculator', activeUsers: 45 },
    { page: '/videos', activeUsers: 32 },
    { page: '/documents', activeUsers: 28 },
    { page: '/profile', activeUsers: 22 }
  ],
  geographicData: [
    { country: 'US', activeUsers: 89 },
    { country: 'CA', activeUsers: 23 },
    { country: 'UK', activeUsers: 15 }
  ]
};

describe('RealTimeMonitor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: mockRealTimeData,
      connected: true,
      lastUpdate: new Date()
    });
    (useWebSocket as jest.Mock).mockReturnValue({
      connected: true,
      reconnect: jest.fn()
    });
  });

  it('renders real-time monitor with key metrics', () => {
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/real-time monitor/i)).toBeInTheDocument();
    expect(screen.getByText('127')).toBeInTheDocument(); // Active users
    expect(screen.getByText('89')).toBeInTheDocument(); // Current sessions
    expect(screen.getByText('45')).toBeInTheDocument(); // Events per minute
  });

  it('displays connection status', () => {
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
    expect(screen.getByTestId('connection-indicator')).toHaveClass('connected');
  });

  it('shows recent events stream', () => {
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/recent events/i)).toBeInTheDocument();
    expect(screen.getByText('video_start')).toBeInTheDocument();
    expect(screen.getByText('Loan Basics')).toBeInTheDocument();
    expect(screen.getByText('calculation_complete')).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
    expect(screen.getByText('document_upload')).toBeInTheDocument();
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
  });

  it('displays active pages with user counts', () => {
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/active pages/i)).toBeInTheDocument();
    expect(screen.getByText('/calculator')).toBeInTheDocument();
    expect(screen.getByText('45 users')).toBeInTheDocument();
    expect(screen.getByText('/videos')).toBeInTheDocument();
    expect(screen.getByText('32 users')).toBeInTheDocument();
  });

  it('shows geographic distribution', () => {
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/geographic distribution/i)).toBeInTheDocument();
    expect(screen.getByText('US: 89 users')).toBeInTheDocument();
    expect(screen.getByText('CA: 23 users')).toBeInTheDocument();
    expect(screen.getByText('UK: 15 users')).toBeInTheDocument();
  });

  it('handles disconnected state', () => {
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: mockRealTimeData,
      connected: false,
      lastUpdate: new Date()
    });
    (useWebSocket as jest.Mock).mockReturnValue({
      connected: false,
      reconnect: jest.fn()
    });
    
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    expect(screen.getByTestId('connection-indicator')).toHaveClass('disconnected');
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });

  it('attempts reconnection when reconnect button is clicked', async () => {
    const user = userEvent.setup();
    const mockReconnect = jest.fn();
    
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: mockRealTimeData,
      connected: false,
      lastUpdate: new Date()
    });
    (useWebSocket as jest.Mock).mockReturnValue({
      connected: false,
      reconnect: mockReconnect
    });
    
    render(<RealTimeMonitor />);
    
    const reconnectButton = screen.getByRole('button', { name: /reconnect/i });
    await user.click(reconnectButton);
    
    expect(mockReconnect).toHaveBeenCalled();
  });

  it('filters events by type', async () => {
    const user = userEvent.setup();
    render(<RealTimeMonitor />);
    
    const eventFilter = screen.getByLabelText(/filter events/i);
    await user.selectOptions(eventFilter, 'video_start');
    
    // Should only show video_start events
    expect(screen.getByText('video_start')).toBeInTheDocument();
    expect(screen.queryByText('calculation_complete')).not.toBeInTheDocument();
    expect(screen.queryByText('document_upload')).not.toBeInTheDocument();
  });

  it('displays event timestamps correctly', () => {
    render(<RealTimeMonitor />);
    
    // Should show relative timestamps
    expect(screen.getByText(/just now|seconds ago|minutes ago/)).toBeInTheDocument();
  });

  it('shows event details in expandable format', async () => {
    const user = userEvent.setup();
    render(<RealTimeMonitor />);
    
    const eventItem = screen.getByText('video_start').closest('.event-item');
    const expandButton = within(eventItem!).getByRole('button', { name: /expand/i });
    
    await user.click(expandButton);
    
    // Should show detailed event data
    expect(screen.getByText('videoId: video-1')).toBeInTheDocument();
    expect(screen.getByText('userId: user-123')).toBeInTheDocument();
  });

  it('updates metrics in real-time', async () => {
    const { rerender } = render(<RealTimeMonitor />);
    
    // Initial state
    expect(screen.getByText('127')).toBeInTheDocument();
    
    // Update data
    const updatedData = {
      ...mockRealTimeData,
      activeUsers: 135,
      recentEvents: [
        ...mockRealTimeData.recentEvents,
        {
          id: 'event-4',
          type: 'profile_update',
          userId: 'user-999',
          timestamp: new Date(),
          data: { field: 'firstName' }
        }
      ]
    };
    
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: updatedData,
      connected: true,
      lastUpdate: new Date()
    });
    
    rerender(<RealTimeMonitor />);
    
    // Should show updated metrics
    expect(screen.getByText('135')).toBeInTheDocument();
    expect(screen.getByText('profile_update')).toBeInTheDocument();
  });

  it('displays last update timestamp', () => {
    const lastUpdate = new Date('2024-01-01T10:05:00Z');
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: mockRealTimeData,
      connected: true,
      lastUpdate
    });
    
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/last update/i)).toBeInTheDocument();
    expect(screen.getByText(/10:05/)).toBeInTheDocument();
  });

  it('shows event rate trends', () => {
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/event rate/i)).toBeInTheDocument();
    expect(screen.getByText('45 events/min')).toBeInTheDocument();
    
    // Should show trend indicator
    expect(screen.getByTestId('event-rate-trend')).toBeInTheDocument();
  });

  it('handles empty events gracefully', () => {
    (useRealTimeAnalytics as jest.Mock).mockReturnValue({
      data: {
        ...mockRealTimeData,
        recentEvents: []
      },
      connected: true,
      lastUpdate: new Date()
    });
    
    render(<RealTimeMonitor />);
    
    expect(screen.getByText(/no recent events/i)).toBeInTheDocument();
  });

  it('pauses and resumes real-time updates', async () => {
    const user = userEvent.setup();
    render(<RealTimeMonitor />);
    
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    await user.click(pauseButton);
    
    expect(screen.getByText(/paused/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    
    const resumeButton = screen.getByRole('button', { name: /resume/i });
    await user.click(resumeButton);
    
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });

  it('exports real-time data', async () => {
    const user = userEvent.setup();
    render(<RealTimeMonitor />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    await user.click(exportButton);
    
    // Should show export options
    expect(screen.getByText(/export real-time data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument();
  });
});