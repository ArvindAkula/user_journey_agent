import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import { useAuth, useEventTracking } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn(),
  useEventTracking: jest.fn()
}));

// Mock the UserProfile and UserProgress components
jest.mock('../components/UserProfile', () => {
  return function MockUserProfile() {
    return <div data-testid="user-profile">User Profile Component</div>;
  };
});

jest.mock('../components/UserProgress', () => {
  return function MockUserProgress() {
    return <div data-testid="user-progress">User Progress Component</div>;
  };
});

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  avatar: 'https://example.com/avatar.jpg'
};

const mockTrackEvent = jest.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false
    });
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
  });

  it('renders profile page with header and components', () => {
    renderWithRouter(<ProfilePage />);
    
    expect(screen.getByText(/user profile/i)).toBeInTheDocument();
    expect(screen.getByText(/manage your account and view progress/i)).toBeInTheDocument();
    expect(screen.getByTestId('user-profile')).toBeInTheDocument();
    expect(screen.getByTestId('user-progress')).toBeInTheDocument();
  });

  it('tracks page view event on mount', () => {
    renderWithRouter(<ProfilePage />);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('page_view', {
      page: 'profile',
      userId: 'user-123'
    });
  });

  it('displays profile navigation tabs', () => {
    renderWithRouter(<ProfilePage />);
    
    expect(screen.getByRole('tab', { name: /profile info/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /progress/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
  });

  it('switches between profile tabs', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ProfilePage />);
    
    // Initially shows profile info
    expect(screen.getByTestId('user-profile')).toBeInTheDocument();
    
    // Switch to progress tab
    const progressTab = screen.getByRole('tab', { name: /progress/i });
    await user.click(progressTab);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('profile_tab_switch', {
      from: 'profile',
      to: 'progress'
    });
  });

  it('displays user welcome message', () => {
    renderWithRouter(<ProfilePage />);
    
    expect(screen.getByText(/welcome back, john/i)).toBeInTheDocument();
  });

  it('shows account summary information', () => {
    renderWithRouter(<ProfilePage />);
    
    expect(screen.getByText(/account summary/i)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });

  it('handles user not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false
    });
    
    renderWithRouter(<ProfilePage />);
    
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    expect(screen.queryByTestId('user-profile')).not.toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true
    });
    
    renderWithRouter(<ProfilePage />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows quick actions section', () => {
    renderWithRouter(<ProfilePage />);
    
    expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download data/i })).toBeInTheDocument();
  });

  it('handles quick action clicks', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ProfilePage />);
    
    const editProfileButton = screen.getByRole('button', { name: /edit profile/i });
    await user.click(editProfileButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('profile_quick_action', {
      action: 'edit_profile'
    });
  });

  it('displays activity summary', async () => {
    // Mock API response for activity summary
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        lastLogin: '2024-01-15T10:00:00Z',
        totalSessions: 25,
        videosWatched: 10,
        calculationsRun: 5
      })
    });
    
    renderWithRouter(<ProfilePage />);
    
    await waitFor(() => {
      expect(screen.getByText(/activity summary/i)).toBeInTheDocument();
      expect(screen.getByText('25 sessions')).toBeInTheDocument();
      expect(screen.getByText('10 videos watched')).toBeInTheDocument();
    });
  });

  it('shows settings tab content', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ProfilePage />);
    
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    await user.click(settingsTab);
    
    expect(screen.getByText(/account settings/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy settings/i)).toBeInTheDocument();
    expect(screen.getByText(/notification preferences/i)).toBeInTheDocument();
  });

  it('handles data export request', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['user data']))
    });
    
    renderWithRouter(<ProfilePage />);
    
    const downloadButton = screen.getByRole('button', { name: /download data/i });
    await user.click(downloadButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('data_export_request', {
      userId: 'user-123'
    });
  });

  it('displays account deletion option in settings', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ProfilePage />);
    
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    await user.click(settingsTab);
    
    expect(screen.getByText(/delete account/i)).toBeInTheDocument();
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
    
    renderWithRouter(<ProfilePage />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load activity/i)).toBeInTheDocument();
    });
  });
});