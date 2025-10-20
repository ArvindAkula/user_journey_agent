import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HomePage from '../HomePage';
import { useAuth } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn()
}));

// Mock child components
jest.mock('../../components/UserHeader', () => ({
  UserHeader: () => <div data-testid="user-header">User Header</div>
}));

jest.mock('../../components/TabNavigation', () => ({
  TabNavigation: ({ onTabChange }: { onTabChange: (tab: string) => void }) => (
    <div data-testid="tab-navigation">
      <button onClick={() => onTabChange('demo')}>Demo</button>
      <button onClick={() => onTabChange('videos')}>Videos</button>
      <button onClick={() => onTabChange('calculator')}>Calculator</button>
    </div>
  )
}));

jest.mock('../../components/DemoApp', () => ({
  DemoApp: () => <div data-testid="demo-app">Demo App</div>
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('HomePage Component', () => {
  const mockUser = {
    uid: 'user123',
    email: 'test@example.com',
    displayName: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
      isAuthenticated: true
    });
  });

  it('renders home page for authenticated user', () => {
    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('user-header')).toBeInTheDocument();
    expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    expect(screen.getByTestId('demo-app')).toBeInTheDocument();
  });

  it('shows loading state when auth is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
      isAuthenticated: false
    });

    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false
    });

    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('login-redirect')).toBeInTheDocument();
    expect(screen.getByText('Please log in to continue')).toBeInTheDocument();
  });

  it('handles tab navigation', () => {
    renderWithRouter(<HomePage />);
    
    // Initially shows demo tab
    expect(screen.getByTestId('demo-app')).toBeInTheDocument();
    
    // Switch to videos tab
    fireEvent.click(screen.getByText('Videos'));
    
    expect(screen.getByTestId('video-library')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-app')).not.toBeInTheDocument();
  });

  it('displays user welcome message', () => {
    renderWithRouter(<HomePage />);
    
    expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument();
  });

  it('shows user progress section', () => {
    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('user-progress-section')).toBeInTheDocument();
    expect(screen.getByText('Your Progress')).toBeInTheDocument();
  });

  it('displays quick actions', () => {
    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    
    // Check for action buttons
    expect(screen.getByText('Start Demo')).toBeInTheDocument();
    expect(screen.getByText('Watch Videos')).toBeInTheDocument();
    expect(screen.getByText('Use Calculator')).toBeInTheDocument();
  });

  it('handles quick action clicks', () => {
    renderWithRouter(<HomePage />);
    
    // Click "Watch Videos" quick action
    fireEvent.click(screen.getByText('Watch Videos'));
    
    // Should switch to videos tab
    expect(screen.getByTestId('video-library')).toBeInTheDocument();
  });

  it('shows recent activity', () => {
    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('displays personalized recommendations', () => {
    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('recommendations')).toBeInTheDocument();
    expect(screen.getByText('Recommended for You')).toBeInTheDocument();
  });

  it('handles user profile updates', () => {
    const updatedUser = {
      ...mockUser,
      displayName: 'Updated User'
    };

    const { rerender } = renderWithRouter(<HomePage />);
    
    expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument();
    
    // Update user
    (useAuth as jest.Mock).mockReturnValue({
      user: updatedUser,
      loading: false,
      isAuthenticated: true
    });
    
    rerender(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Welcome back, Updated User!')).toBeInTheDocument();
  });

  it('renders with proper CSS classes', () => {
    renderWithRouter(<HomePage />);
    
    const homePage = screen.getByTestId('home-page');
    expect(homePage).toHaveClass('home-page');
    
    const mainContent = screen.getByTestId('main-content');
    expect(mainContent).toHaveClass('main-content');
  });

  it('handles responsive layout', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    renderWithRouter(<HomePage />);
    
    const homePage = screen.getByTestId('home-page');
    expect(homePage).toHaveClass('mobile-layout');
  });

  it('shows notification banner when present', () => {
    // Mock a notification
    const mockNotification = {
      id: '1',
      message: 'New features available!',
      type: 'info'
    };

    renderWithRouter(<HomePage />);
    
    // Simulate notification being set
    expect(screen.getByTestId('notification-banner')).toBeInTheDocument();
    expect(screen.getByText('New features available!')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    renderWithRouter(<HomePage />);
    
    const demoButton = screen.getByText('Demo');
    demoButton.focus();
    
    fireEvent.keyDown(demoButton, { key: 'ArrowRight' });
    
    const videosButton = screen.getByText('Videos');
    expect(videosButton).toHaveFocus();
  });

  it('renders accessibility attributes', () => {
    renderWithRouter(<HomePage />);
    
    const homePage = screen.getByTestId('home-page');
    expect(homePage).toHaveAttribute('role', 'main');
    expect(homePage).toHaveAttribute('aria-label', 'Home Page');
    
    const mainContent = screen.getByTestId('main-content');
    expect(mainContent).toHaveAttribute('role', 'region');
    expect(mainContent).toHaveAttribute('aria-label', 'Main Content');
  });

  it('handles error states gracefully', () => {
    // Mock auth error
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      error: 'Authentication failed'
    });

    renderWithRouter(<HomePage />);
    
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
  });
});