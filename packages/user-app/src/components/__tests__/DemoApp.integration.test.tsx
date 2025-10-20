import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DemoApp from '../DemoApp';
import { useEventTracking, useAuth } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useEventTracking: jest.fn(),
  useAuth: jest.fn()
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('DemoApp Integration Tests', () => {
  const mockTrackEvent = jest.fn();
  const mockUser = {
    uid: 'user123',
    email: 'test@example.com',
    displayName: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
      isAuthenticated: true
    });
  });

  it('completes full user journey through demo features', async () => {
    renderWithRouter(<DemoApp />);
    
    // 1. User starts with beginner persona
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    
    // 2. User switches to advanced persona
    fireEvent.click(screen.getByText('Advanced'));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'feature_interaction',
        feature: 'persona_switcher',
        eventData: {
          action: 'persona_changed',
          persona: 'advanced'
        }
      });
    });
    
    // 3. User interacts with calculator
    const calculatorTab = screen.getByText('Calculator');
    fireEvent.click(calculatorTab);
    
    // Perform calculation
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'feature_interaction',
        feature: 'calculator',
        eventData: {
          action: 'calculation_performed',
          operation: 'addition',
          result: 8,
          success: true
        }
      });
    });
    
    // 4. User watches a video
    const videosTab = screen.getByText('Videos');
    fireEvent.click(videosTab);
    
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'video_engagement',
        feature: 'video_library',
        eventData: {
          action: 'video_started',
          videoId: '1',
          videoTitle: 'Getting Started Tutorial'
        }
      });
    });
    
    // 5. User uploads a document
    const uploadTab = screen.getByText('Upload');
    fireEvent.click(uploadTab);
    
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'feature_interaction',
        feature: 'document_upload',
        eventData: {
          action: 'file_uploaded',
          fileName: 'test.pdf',
          fileSize: 12,
          fileType: 'application/pdf'
        }
      });
    });
    
    // Verify user progress is updated
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '80');
  });

  it('handles user struggle scenarios and recovery', async () => {
    renderWithRouter(<DemoApp />);
    
    // User makes calculation error
    const calculatorTab = screen.getByText('Calculator');
    fireEvent.click(calculatorTab);
    
    // Attempt division by zero
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('÷'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('='));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'struggle_signal',
        feature: 'calculator',
        eventData: {
          action: 'calculation_error',
          error: 'division_by_zero',
          success: false
        }
      });
    });
    
    // System shows help message
    expect(screen.getByText('Cannot divide by zero')).toBeInTheDocument();
    expect(screen.getByTestId('help-tooltip')).toBeInTheDocument();
    
    // User recovers by clearing and trying again
    fireEvent.click(screen.getByText('C'));
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'feature_interaction',
        feature: 'calculator',
        eventData: {
          action: 'calculation_performed',
          operation: 'addition',
          result: 8,
          success: true
        }
      });
    });
  });

  it('tracks user engagement patterns across features', async () => {
    renderWithRouter(<DemoApp />);
    
    // User spends time on each feature
    const startTime = Date.now();
    
    // Calculator usage
    fireEvent.click(screen.getByText('Calculator'));
    
    // Simulate time spent
    jest.advanceTimersByTime(30000); // 30 seconds
    
    // Switch to videos
    fireEvent.click(screen.getByText('Videos'));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'feature_interaction',
        feature: 'calculator',
        eventData: {
          action: 'feature_exit',
          timeSpent: 30000,
          interactionCount: 1
        }
      });
    });
    
    // Video engagement
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    // Simulate video watching
    const video = screen.getByTestId('video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 60, writable: true });
    Object.defineProperty(video, 'duration', { value: 120, writable: true });
    
    fireEvent.timeUpdate(video);
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'video_engagement',
        feature: 'video_library',
        eventData: {
          action: 'video_progress',
          videoId: '1',
          currentTime: 60,
          duration: 120,
          progressPercentage: 50
        }
      });
    });
  });

  it('handles offline and online state transitions', async () => {
    renderWithRouter(<DemoApp />);
    
    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    window.dispatchEvent(new Event('offline'));
    
    // User continues to interact while offline
    fireEvent.click(screen.getByText('Calculator'));
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    // Events should be queued
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
    expect(screen.getByText('Working offline')).toBeInTheDocument();
    
    // Simulate coming back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    window.dispatchEvent(new Event('online'));
    
    await waitFor(() => {
      expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument();
      // Queued events should be sent
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'feature_interaction',
        feature: 'calculator',
        eventData: {
          action: 'calculation_performed',
          operation: 'addition',
          result: 8,
          success: true
        }
      });
    });
  });

  it('maintains user session across page refreshes', async () => {
    renderWithRouter(<DemoApp />);
    
    // User makes progress
    fireEvent.click(screen.getByText('Advanced')); // Switch persona
    fireEvent.click(screen.getByText('Calculator'));
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    // Simulate page refresh by re-rendering
    const { rerender } = renderWithRouter(<DemoApp />);
    
    rerender(
      <BrowserRouter>
        <DemoApp />
      </BrowserRouter>
    );
    
    // User state should be restored
    expect(screen.getByText('Advanced')).toHaveClass('active');
    expect(screen.getByTestId('calculator-display')).toHaveTextContent('8');
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('handles concurrent user interactions', async () => {
    renderWithRouter(<DemoApp />);
    
    // Simulate rapid interactions
    const calculatorTab = screen.getByText('Calculator');
    const videosTab = screen.getByText('Videos');
    
    // Rapid tab switching
    fireEvent.click(calculatorTab);
    fireEvent.click(videosTab);
    fireEvent.click(calculatorTab);
    
    // Rapid calculator inputs
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    
    // All events should be tracked without conflicts
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledTimes(6); // Tab switches + number inputs
    });
    
    // UI should remain consistent
    expect(screen.getByTestId('calculator-display')).toHaveTextContent('123');
  });

  it('provides accessibility throughout user journey', () => {
    renderWithRouter(<DemoApp />);
    
    // Check initial accessibility
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    
    // Navigate using keyboard
    const calculatorTab = screen.getByRole('tab', { name: /calculator/i });
    calculatorTab.focus();
    fireEvent.keyDown(calculatorTab, { key: 'Enter' });
    
    // Calculator should be accessible
    expect(screen.getByRole('application')).toBeInTheDocument();
    expect(screen.getByLabelText('Calculator display')).toBeInTheDocument();
    
    // Navigate to videos
    const videosTab = screen.getByRole('tab', { name: /videos/i });
    videosTab.focus();
    fireEvent.keyDown(videosTab, { key: 'Enter' });
    
    // Video library should be accessible
    expect(screen.getByRole('region', { name: /video library/i })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});