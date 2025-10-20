import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VideoLibrary from '../VideoLibrary';
import { useEventTracking } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useEventTracking: jest.fn()
}));

// Mock video element
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockImplementation(() => Promise.resolve()),
});

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  writable: true,
  value: jest.fn(),
});

describe('VideoLibrary Component', () => {
  const mockTrackEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
  });

  it('renders video library interface', () => {
    render(<VideoLibrary />);
    
    expect(screen.getByTestId('video-library')).toBeInTheDocument();
    expect(screen.getByText('Video Library')).toBeInTheDocument();
  });

  it('displays list of available videos', () => {
    render(<VideoLibrary />);
    
    expect(screen.getByTestId('video-list')).toBeInTheDocument();
    
    // Check for some expected video titles
    expect(screen.getByText('Getting Started Tutorial')).toBeInTheDocument();
    expect(screen.getByText('Advanced Features')).toBeInTheDocument();
    expect(screen.getByText('Tips and Tricks')).toBeInTheDocument();
  });

  it('plays video when clicked', async () => {
    render(<VideoLibrary />);
    
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
    
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

  it('tracks video progress', async () => {
    render(<VideoLibrary />);
    
    // Start playing a video
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
    
    const video = screen.getByTestId('video-element') as HTMLVideoElement;
    
    // Simulate video progress
    Object.defineProperty(video, 'currentTime', { value: 30, writable: true });
    Object.defineProperty(video, 'duration', { value: 120, writable: true });
    
    fireEvent.timeUpdate(video);
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'video_engagement',
      feature: 'video_library',
      eventData: {
        action: 'video_progress',
        videoId: '1',
        currentTime: 30,
        duration: 120,
        progressPercentage: 25
      }
    });
  });

  it('tracks video completion', async () => {
    render(<VideoLibrary />);
    
    // Start playing a video
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
    
    const video = screen.getByTestId('video-element') as HTMLVideoElement;
    
    // Simulate video completion
    Object.defineProperty(video, 'currentTime', { value: 120, writable: true });
    Object.defineProperty(video, 'duration', { value: 120, writable: true });
    
    fireEvent.ended(video);
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'video_engagement',
      feature: 'video_library',
      eventData: {
        action: 'video_completed',
        videoId: '1',
        totalWatchTime: 120,
        completionRate: 100
      }
    });
  });

  it('handles video pause and resume', async () => {
    render(<VideoLibrary />);
    
    // Start playing a video
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
    
    const video = screen.getByTestId('video-element');
    const pauseButton = screen.getByTestId('video-pause-button');
    
    // Pause video
    fireEvent.click(pauseButton);
    fireEvent.pause(video);
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'video_engagement',
      feature: 'video_library',
      eventData: {
        action: 'video_paused',
        videoId: '1'
      }
    });
    
    // Resume video
    const playButton = screen.getByTestId('video-play-button');
    fireEvent.click(playButton);
    fireEvent.play(video);
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'video_engagement',
      feature: 'video_library',
      eventData: {
        action: 'video_resumed',
        videoId: '1'
      }
    });
  });

  it('filters videos by category', () => {
    render(<VideoLibrary />);
    
    const categoryFilter = screen.getByTestId('category-filter');
    
    // Filter by "Tutorial" category
    fireEvent.change(categoryFilter, { target: { value: 'tutorial' } });
    
    expect(screen.getByText('Getting Started Tutorial')).toBeInTheDocument();
    expect(screen.queryByText('Advanced Features')).not.toBeInTheDocument();
  });

  it('searches videos by title', () => {
    render(<VideoLibrary />);
    
    const searchInput = screen.getByTestId('video-search');
    
    fireEvent.change(searchInput, { target: { value: 'Advanced' } });
    
    expect(screen.getByText('Advanced Features')).toBeInTheDocument();
    expect(screen.queryByText('Getting Started Tutorial')).not.toBeInTheDocument();
  });

  it('displays video duration and metadata', () => {
    render(<VideoLibrary />);
    
    const videoCard = screen.getByTestId('video-card-1');
    
    expect(videoCard).toHaveTextContent('Duration: 2:00');
    expect(videoCard).toHaveTextContent('Category: Tutorial');
    expect(videoCard).toHaveTextContent('Difficulty: Beginner');
  });

  it('handles video loading errors', async () => {
    render(<VideoLibrary />);
    
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
    
    const video = screen.getByTestId('video-element');
    
    // Simulate video error
    fireEvent.error(video);
    
    expect(screen.getByText('Error loading video')).toBeInTheDocument();
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'struggle_signal',
      feature: 'video_library',
      eventData: {
        action: 'video_error',
        videoId: '1',
        error: 'playback_failed'
      }
    });
  });

  it('supports video quality selection', async () => {
    render(<VideoLibrary />);
    
    // Start playing a video
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
    
    const qualitySelector = screen.getByTestId('quality-selector');
    
    fireEvent.change(qualitySelector, { target: { value: '720p' } });
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'feature_interaction',
      feature: 'video_library',
      eventData: {
        action: 'quality_changed',
        videoId: '1',
        quality: '720p'
      }
    });
  });

  it('displays video recommendations', () => {
    render(<VideoLibrary />);
    
    expect(screen.getByTestId('recommended-videos')).toBeInTheDocument();
    expect(screen.getByText('Recommended for you')).toBeInTheDocument();
  });

  it('handles fullscreen mode', async () => {
    render(<VideoLibrary />);
    
    // Start playing a video
    const videoThumbnail = screen.getByTestId('video-thumbnail-1');
    fireEvent.click(videoThumbnail);
    
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
    
    const fullscreenButton = screen.getByTestId('fullscreen-button');
    fireEvent.click(fullscreenButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventType: 'feature_interaction',
      feature: 'video_library',
      eventData: {
        action: 'fullscreen_toggled',
        videoId: '1',
        fullscreen: true
      }
    });
  });

  it('renders with accessibility attributes', () => {
    render(<VideoLibrary />);
    
    const videoLibrary = screen.getByTestId('video-library');
    expect(videoLibrary).toHaveAttribute('role', 'region');
    expect(videoLibrary).toHaveAttribute('aria-label', 'Video Library');
    
    const videoList = screen.getByTestId('video-list');
    expect(videoList).toHaveAttribute('role', 'list');
    
    const videoCards = screen.getAllByTestId(/video-card-/);
    videoCards.forEach(card => {
      expect(card).toHaveAttribute('role', 'listitem');
    });
  });

  it('supports keyboard navigation', () => {
    render(<VideoLibrary />);
    
    const firstVideo = screen.getByTestId('video-thumbnail-1');
    firstVideo.focus();
    
    fireEvent.keyDown(firstVideo, { key: 'Enter' });
    
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
});