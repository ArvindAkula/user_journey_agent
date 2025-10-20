import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import VideoLibraryPage from '../VideoLibraryPage';
import { useAuth, useEventTracking } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn(),
  useEventTracking: jest.fn()
}));

// Mock the VideoLibrary component
jest.mock('../components/VideoLibrary', () => {
  return function MockVideoLibrary() {
    return <div data-testid="video-library">Video Library Component</div>;
  };
});

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe'
};

const mockTrackEvent = jest.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('VideoLibraryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false
    });
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
    
    // Mock fetch for video categories
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(['Financial Planning', 'Investment Basics', 'Loan Management'])
    });
  });

  it('renders video library page with header and video component', () => {
    renderWithRouter(<VideoLibraryPage />);
    
    expect(screen.getByText(/video library/i)).toBeInTheDocument();
    expect(screen.getByText(/educational videos and tutorials/i)).toBeInTheDocument();
    expect(screen.getByTestId('video-library')).toBeInTheDocument();
  });

  it('tracks page view event on mount', () => {
    renderWithRouter(<VideoLibraryPage />);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('page_view', {
      page: 'videos',
      userId: 'user-123'
    });
  });

  it('displays video categories filter', async () => {
    renderWithRouter(<VideoLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Financial Planning')).toBeInTheDocument();
      expect(screen.getByText('Investment Basics')).toBeInTheDocument();
      expect(screen.getByText('Loan Management')).toBeInTheDocument();
    });
  });

  it('handles category filter selection', async () => {
    const user = userEvent.setup();
    renderWithRouter(<VideoLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Financial Planning')).toBeInTheDocument();
    });
    
    const categoryButton = screen.getByRole('button', { name: /financial planning/i });
    await user.click(categoryButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('video_filter', {
      filterType: 'category',
      filterValue: 'Financial Planning'
    });
  });

  it('displays search functionality', () => {
    renderWithRouter(<VideoLibraryPage />);
    
    expect(screen.getByPlaceholderText(/search videos/i)).toBeInTheDocument();
  });

  it('handles video search', async () => {
    const user = userEvent.setup();
    renderWithRouter(<VideoLibraryPage />);
    
    const searchInput = screen.getByPlaceholderText(/search videos/i);
    await user.type(searchInput, 'loan calculator');
    
    expect(mockTrackEvent).toHaveBeenCalledWith('video_search', {
      searchTerm: 'loan calculator'
    });
  });

  it('shows video library features', () => {
    renderWithRouter(<VideoLibraryPage />);
    
    expect(screen.getByText(/high-quality tutorials/i)).toBeInTheDocument();
    expect(screen.getByText(/progress tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/bookmarking/i)).toBeInTheDocument();
    expect(screen.getByText(/multiple categories/i)).toBeInTheDocument();
  });

  it('handles user not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false
    });
    
    renderWithRouter(<VideoLibraryPage />);
    
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    expect(screen.queryByTestId('video-library')).not.toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true
    });
    
    renderWithRouter(<VideoLibraryPage />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles API errors for categories gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
    
    renderWithRouter(<VideoLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/all categories/i)).toBeInTheDocument();
    });
  });

  it('displays video statistics', async () => {
    // Mock API response for video stats
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['Financial Planning', 'Investment Basics'])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          totalVideos: 25,
          totalDuration: 180, // minutes
          watchedVideos: 5
        })
      });
    
    renderWithRouter(<VideoLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('25 videos available')).toBeInTheDocument();
      expect(screen.getByText('3 hours of content')).toBeInTheDocument();
      expect(screen.getByText('5 videos watched')).toBeInTheDocument();
    });
  });

  it('shows recently watched videos section', async () => {
    const mockRecentVideos = [
      {
        id: 'video-1',
        title: 'Introduction to Loans',
        watchedAt: '2024-01-01T00:00:00Z',
        progress: 75
      }
    ];
    
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['Financial Planning'])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRecentVideos)
      });
    
    renderWithRouter(<VideoLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/recently watched/i)).toBeInTheDocument();
      expect(screen.getByText('Introduction to Loans')).toBeInTheDocument();
    });
  });

  it('handles sort options', async () => {
    const user = userEvent.setup();
    renderWithRouter(<VideoLibraryPage />);
    
    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.selectOptions(sortSelect, 'duration');
    
    expect(mockTrackEvent).toHaveBeenCalledWith('video_sort', {
      sortBy: 'duration'
    });
  });

  it('displays video recommendations', async () => {
    const mockRecommendations = [
      {
        id: 'video-2',
        title: 'Advanced Loan Strategies',
        reason: 'Based on your recent activity'
      }
    ];
    
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['Financial Planning'])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRecommendations)
      });
    
    renderWithRouter(<VideoLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/recommended for you/i)).toBeInTheDocument();
      expect(screen.getByText('Advanced Loan Strategies')).toBeInTheDocument();
    });
  });
});