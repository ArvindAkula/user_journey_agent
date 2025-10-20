import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DemoApp from '../DemoApp';
import { useEventTracking } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useEventTracking: jest.fn()
}));

// Mock child components
jest.mock('../InteractiveCalculator', () => ({
  InteractiveCalculator: () => <div data-testid="interactive-calculator">Calculator</div>
}));

jest.mock('../VideoLibrary', () => ({
  VideoLibrary: () => <div data-testid="video-library">Video Library</div>
}));

jest.mock('../DocumentUpload', () => ({
  DocumentUpload: () => <div data-testid="document-upload">Document Upload</div>
}));

// PersonaSwitcher has been moved to analytics dashboard

jest.mock('../UserProgress', () => ({
  UserProgress: () => <div data-testid="user-progress">User Progress</div>
}));

describe('DemoApp Component', () => {
  const mockTrackEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
  });

  it('renders all main components', () => {
    render(<DemoApp />);
    
    expect(screen.getByTestId('interactive-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('video-library')).toBeInTheDocument();
    expect(screen.getByTestId('document-upload')).toBeInTheDocument();
    expect(screen.getByTestId('user-progress')).toBeInTheDocument();
  });

  it('handles persona changes', () => {
    render(<DemoApp />);
    
    const beginnerButton = screen.getByText('Beginner');
    fireEvent.click(beginnerButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'feature_interaction',
      feature: 'persona_switcher',
      eventData: {
        action: 'persona_changed',
        persona: 'beginner'
      }
    });
  });

  it('tracks demo app initialization', () => {
    render(<DemoApp />);
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'page_view',
      feature: 'demo_app',
      eventData: {
        action: 'demo_initialized'
      }
    });
  });

  it('renders with proper CSS classes', () => {
    render(<DemoApp />);
    
    const container = screen.getByTestId('demo-app-container');
    expect(container).toHaveClass('demo-app');
  });

  it('handles component interactions', async () => {
    render(<DemoApp />);
    
    // Test persona switching
    const advancedButton = screen.getByText('Advanced');
    fireEvent.click(advancedButton);
    
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
  });

  it('maintains state across persona changes', () => {
    render(<DemoApp />);
    
    // Switch to advanced
    fireEvent.click(screen.getByText('Advanced'));
    
    // Verify components are still rendered
    expect(screen.getByTestId('interactive-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('video-library')).toBeInTheDocument();
    expect(screen.getByTestId('document-upload')).toBeInTheDocument();
  });

  it('handles error states gracefully', () => {
    // Mock event tracking to throw error
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: jest.fn().mockImplementation(() => {
        throw new Error('Tracking failed');
      })
    });

    // Should not crash when tracking fails
    expect(() => render(<DemoApp />)).not.toThrow();
  });

  it('renders accessibility attributes', () => {
    render(<DemoApp />);
    
    const container = screen.getByTestId('demo-app-container');
    expect(container).toHaveAttribute('role', 'main');
    expect(container).toHaveAttribute('aria-label', 'Demo Application');
  });

  it('handles keyboard navigation', () => {
    render(<DemoApp />);
    
    const beginnerButton = screen.getByText('Beginner');
    beginnerButton.focus();
    
    fireEvent.keyDown(beginnerButton, { key: 'Enter' });
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'feature_interaction',
      feature: 'persona_switcher',
      eventData: {
        action: 'persona_changed',
        persona: 'beginner'
      }
    });
  });
});