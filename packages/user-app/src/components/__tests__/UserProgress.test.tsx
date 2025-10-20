import React from 'react';
import { render, screen } from '@testing-library/react';
import UserProgress from '../UserProgress';
import { useAuth, useEventTracking } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn(),
  useEventTracking: jest.fn()
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe'
};

const mockProgressData = {
  videosWatched: 5,
  totalVideos: 10,
  calculationsCompleted: 3,
  documentsUploaded: 2,
  profileCompletion: 80,
  lastActivity: new Date('2024-01-15'),
  achievements: [
    { id: 'first-video', name: 'First Video Watched', earned: true },
    { id: 'calculator-expert', name: 'Calculator Expert', earned: false }
  ]
};

describe('UserProgress Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser
    });
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: jest.fn()
    });
    
    // Mock fetch for progress data
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProgressData)
    });
  });

  it('renders progress overview', async () => {
    render(<UserProgress />);
    
    expect(screen.getByText(/progress overview/i)).toBeInTheDocument();
    
    // Wait for data to load
    await screen.findByText('5 / 10');
    expect(screen.getByText('5 / 10')).toBeInTheDocument(); // Videos watched
    expect(screen.getByText('3')).toBeInTheDocument(); // Calculations completed
    expect(screen.getByText('2')).toBeInTheDocument(); // Documents uploaded
  });

  it('displays profile completion percentage', async () => {
    render(<UserProgress />);
    
    await screen.findByText('80%');
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText(/profile completion/i)).toBeInTheDocument();
  });

  it('shows video watching progress', async () => {
    render(<UserProgress />);
    
    await screen.findByText(/videos watched/i);
    expect(screen.getByText(/videos watched/i)).toBeInTheDocument();
    
    // Check progress bar
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50'); // 5/10 = 50%
  });

  it('displays achievements section', async () => {
    render(<UserProgress />);
    
    await screen.findByText(/achievements/i);
    expect(screen.getByText(/achievements/i)).toBeInTheDocument();
    expect(screen.getByText('First Video Watched')).toBeInTheDocument();
    expect(screen.getByText('Calculator Expert')).toBeInTheDocument();
  });

  it('shows earned vs unearned achievements', async () => {
    render(<UserProgress />);
    
    await screen.findByText('First Video Watched');
    
    const earnedAchievement = screen.getByText('First Video Watched').closest('.achievement');
    const unearnedAchievement = screen.getByText('Calculator Expert').closest('.achievement');
    
    expect(earnedAchievement).toHaveClass('earned');
    expect(unearnedAchievement).toHaveClass('unearned');
  });

  it('displays last activity date', async () => {
    render(<UserProgress />);
    
    await screen.findByText(/last activity/i);
    expect(screen.getByText(/last activity/i)).toBeInTheDocument();
    expect(screen.getByText(/jan 15, 2024/i)).toBeInTheDocument();
  });

  it('handles loading state', () => {
    // Mock pending fetch
    global.fetch = jest.fn(() => new Promise(() => {}));
    
    render(<UserProgress />);
    
    expect(screen.getByText(/loading progress/i)).toBeInTheDocument();
  });

  it('handles error state', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to load'));
    
    render(<UserProgress />);
    
    await screen.findByText(/failed to load progress/i);
    expect(screen.getByText(/failed to load progress/i)).toBeInTheDocument();
  });

  it('handles empty progress data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        videosWatched: 0,
        totalVideos: 0,
        calculationsCompleted: 0,
        documentsUploaded: 0,
        profileCompletion: 0,
        achievements: []
      })
    });
    
    render(<UserProgress />);
    
    await screen.findByText('0 / 0');
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
    expect(screen.getByText(/no achievements yet/i)).toBeInTheDocument();
  });

  it('calculates progress percentages correctly', async () => {
    render(<UserProgress />);
    
    await screen.findByText('50%'); // Video progress: 5/10 = 50%
    
    const videoProgressBar = screen.getByRole('progressbar');
    expect(videoProgressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('handles user not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null
    });
    
    render(<UserProgress />);
    
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
  });
});