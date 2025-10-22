import React, { useState, useRef, useEffect } from 'react';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../config';
import { firebaseAnalyticsService } from '../services/FirebaseAnalyticsService';
import './VideoLibrary.css';

interface VideoLibraryProps {
  onVideoComplete: () => void;
}

interface Video {
  id: string;
  title: string;
  description: string;
  duration: number; // in seconds
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  thumbnail: string;
  thumbnailUrl?: string;
  videoUrl: string;
  tags: string[];
  uploadDate: Date;
  viewCount: number;
  rating: number;
}

interface VideoProgress {
  videoId: string;
  watchTime: number;
  completed: boolean;
  lastWatched: Date;
  bookmarks: number[];
}

const VideoLibrary: React.FC<VideoLibraryProps> = ({ onVideoComplete }) => {
  // Create event service instance with enhanced configuration
  const eventService = new EventService({
    baseURL: config.apiBaseUrl,
    timeout: 5000,
    batchSize: 5,
    flushInterval: 3000,
    maxRetries: 3,
    retryDelay: 1000,
    enableOfflineQueue: true,
    maxOfflineEvents: 500
  });

  const { 
    trackVideoEngagement, 
    trackFeatureInteraction, 
    trackUserAction, 
    trackError,
    trackButtonClick,
    trackFormInteraction,
    trackPerformanceMetric,
    getInteractionStats
  } = useEventTracking({
    eventService,
    userId: 'demo-user',
    sessionId: `demo-session-${Date.now()}`,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  const [videos] = useState<Video[]>([
    {
      id: 'financial-planning-basics',
      title: 'Financial Planning Fundamentals',
      description: 'Master the essential concepts of personal financial planning, budgeting, and goal setting for long-term financial success.',
      duration: 420,
      category: 'financial-planning',
      difficulty: 'beginner',
      thumbnail: '💰',
      thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=225&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      tags: ['budgeting', 'planning', 'basics', 'goals'],
      uploadDate: new Date('2024-01-15'),
      viewCount: 1247,
      rating: 4.8
    },
    {
      id: 'loan-calculator-mastery',
      title: 'Loan Calculator: Advanced Strategies',
      description: 'Learn how to use our loan calculator effectively to compare different loan options, understand amortization, and make informed borrowing decisions.',
      duration: 360,
      category: 'tools',
      difficulty: 'intermediate',
      thumbnail: '🧮',
      thumbnailUrl: 'https://images.unsplash.com/photo-1554224154-26032fced8bd?w=400&h=225&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      tags: ['calculator', 'loans', 'amortization', 'comparison'],
      uploadDate: new Date('2024-02-01'),
      viewCount: 892,
      rating: 4.6
    },
    {
      id: 'document-management',
      title: 'Secure Document Management',
      description: 'Best practices for organizing, uploading, and managing your financial documents securely in our platform.',
      duration: 240,
      category: 'security',
      difficulty: 'beginner',
      thumbnail: '📄',
      thumbnailUrl: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=400&h=225&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      tags: ['documents', 'security', 'organization', 'upload'],
      uploadDate: new Date('2024-01-28'),
      viewCount: 654,
      rating: 4.7
    },
    {
      id: 'investment-basics',
      title: 'Investment Portfolio Basics',
      description: 'Introduction to building a diversified investment portfolio, understanding risk tolerance, and long-term wealth building strategies.',
      duration: 480,
      category: 'investments',
      difficulty: 'intermediate',
      thumbnail: '📈',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=225&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      tags: ['investments', 'portfolio', 'diversification', 'risk'],
      uploadDate: new Date('2024-02-10'),
      viewCount: 1156,
      rating: 4.9
    },
    {
      id: 'retirement-planning',
      title: 'Retirement Planning Strategies',
      description: 'Comprehensive guide to retirement planning, including 401(k) optimization, IRA strategies, and calculating retirement needs.',
      duration: 540,
      category: 'retirement',
      difficulty: 'advanced',
      thumbnail: '🏖️',
      thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=225&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      tags: ['retirement', '401k', 'IRA', 'planning'],
      uploadDate: new Date('2024-02-15'),
      viewCount: 743,
      rating: 4.8
    },
    {
      id: 'credit-score-optimization',
      title: 'Credit Score Optimization',
      description: 'Learn proven strategies to improve your credit score, understand credit reports, and maintain excellent credit health.',
      duration: 300,
      category: 'credit',
      difficulty: 'intermediate',
      thumbnail: '⭐',
      thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=225&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      tags: ['credit', 'score', 'optimization', 'reports'],
      uploadDate: new Date('2024-02-05'),
      viewCount: 987,
      rating: 4.5
    }
  ]);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [pausePoints, setPausePoints] = useState<number[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'title' | 'duration' | 'rating' | 'uploadDate' | 'viewCount'>('title');
  const [videoProgress, setVideoProgress] = useState<VideoProgress[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load video progress from localStorage on component mount
  useEffect(() => {
    const savedProgress = localStorage.getItem('videoProgress');
    if (savedProgress) {
      try {
        setVideoProgress(JSON.parse(savedProgress));
      } catch (error) {
        console.error('Error loading video progress:', error);
      }
    }
  }, []);

  // Save video progress to localStorage whenever it changes
  useEffect(() => {
    if (videoProgress.length > 0) {
      localStorage.setItem('videoProgress', JSON.stringify(videoProgress));
    }
  }, [videoProgress]);

  const categories = ['all', ...Array.from(new Set(videos.map(v => v.category)))];
  
  // Filter and search videos
  const filteredVideos = videos
    .filter(video => {
      const matchesCategory = filterCategory === 'all' || video.category === filterCategory;
      const matchesSearch = searchQuery === '' || 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'duration':
          return a.duration - b.duration;
        case 'rating':
          return b.rating - a.rating;
        case 'uploadDate':
          return b.uploadDate.getTime() - a.uploadDate.getTime();
        case 'viewCount':
          return b.viewCount - a.viewCount;
        default:
          return 0;
      }
    });

  // Get progress for a specific video
  const getVideoProgress = (videoId: string): VideoProgress | undefined => {
    return videoProgress.find(p => p.videoId === videoId);
  };

  // Update video progress
  const updateVideoProgress = (videoId: string, updates: Partial<VideoProgress>) => {
    setVideoProgress(prev => {
      const existing = prev.find(p => p.videoId === videoId);
      if (existing) {
        return prev.map(p => p.videoId === videoId ? { ...p, ...updates } : p);
      } else {
        return [...prev, {
          videoId,
          watchTime: 0,
          completed: false,
          lastWatched: new Date(),
          bookmarks: [],
          ...updates
        }];
      }
    });
  };

  const handleVideoSelect = (video: Video) => {
    const selectionStartTime = performance.now();
    const previousVideo = selectedVideo;
    const progress = getVideoProgress(video.id);
    
    setSelectedVideo(video);
    setCurrentTime(progress?.watchTime || 0);
    setPausePoints([]);
    setBookmarks(progress?.bookmarks || []);
    setWatchStartTime(Date.now());
    
    // Set video to saved progress if available
    if (videoRef.current && progress?.watchTime) {
      videoRef.current.currentTime = progress.watchTime;
    }
    
    // Track video card click
    trackButtonClick(`video_card_${video.id}`, video.title, {
      videoId: video.id,
      category: video.category,
      difficulty: video.difficulty,
      previousVideo: previousVideo?.id,
      filterContext: filterCategory,
      videoIndex: filteredVideos.findIndex(v => v.id === video.id),
      hasProgress: !!progress,
      resumeTime: progress?.watchTime || 0
    });
    
    // Track video selection with enhanced context
    trackUserAction('video_selected', {
      videoId: video.id,
      videoTitle: video.title,
      category: video.category,
      difficulty: video.difficulty,
      duration: video.duration,
      previousVideo: previousVideo?.id,
      selectionMethod: 'card_click',
      filterActive: filterCategory !== 'all',
      currentFilter: filterCategory,
      searchActive: searchQuery !== '',
      currentSearch: searchQuery,
      sortBy: sortBy
    });
    
    // Track video engagement initialization
    trackVideoEngagement(video.id, {
      action: 'video_selected',
      duration: progress?.watchTime || 0,
      completionRate: progress ? (progress.watchTime / video.duration) * 100 : 0,
      category: video.category,
      difficulty: video.difficulty,
      selectionContext: {
        filterCategory,
        totalAvailableVideos: filteredVideos.length,
        videoPosition: filteredVideos.findIndex(v => v.id === video.id) + 1,
        hasProgress: !!progress,
        isResume: !!progress?.watchTime
      }
    });
    
    // Track selection performance
    const selectionEndTime = performance.now();
    trackPerformanceMetric('video_selection_time', selectionEndTime - selectionStartTime, 'ms');
  };

  const handleAddBookmark = () => {
    if (selectedVideo && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const newBookmarks = [...bookmarks, currentTime].sort((a, b) => a - b);
      setBookmarks(newBookmarks);
      
      updateVideoProgress(selectedVideo.id, {
        bookmarks: newBookmarks,
        lastWatched: new Date()
      });
      
      trackUserAction('video_bookmark_added', {
        videoId: selectedVideo.id,
        bookmarkTime: currentTime,
        totalBookmarks: newBookmarks.length
      });
    }
  };

  const handleJumpToBookmark = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      trackUserAction('video_bookmark_used', {
        videoId: selectedVideo?.id,
        bookmarkTime: time
      });
    }
  };

  const handlePlay = () => {
    if (!watchStartTime) {
      setWatchStartTime(Date.now());
    }
    
    if (selectedVideo) {
      trackVideoEngagement(selectedVideo.id, {
        action: 'play',
        duration: currentTime,
        completionRate: (currentTime / selectedVideo.duration) * 100
      });
      
      // Track in Firebase Analytics
      firebaseAnalyticsService.trackVideoEvent('play', selectedVideo.id, {
        duration: selectedVideo.duration,
        position: currentTime,
        videoTitle: selectedVideo.title
      });
    }
  };

  const handlePause = () => {
    if (selectedVideo && videoRef.current) {
      const pauseTime = videoRef.current.currentTime;
      setPausePoints(prev => [...prev, pauseTime]);
      
      // Update progress
      updateVideoProgress(selectedVideo.id, {
        watchTime: pauseTime,
        lastWatched: new Date(),
        completed: pauseTime >= selectedVideo.duration * 0.95
      });
      
      trackVideoEngagement(selectedVideo.id, {
        action: 'pause',
        duration: pauseTime,
        completionRate: (pauseTime / selectedVideo.duration) * 100,
        pausePoints: [...pausePoints, pauseTime],
        userContext: {
          deviceType: 'desktop',
          browserInfo: navigator.userAgent,
          persona: 'demo-user',
          userSegment: 'demo',
          sessionStage: 'active',
          previousActions: []
        },
        deviceInfo: {
          platform: 'Web' as const,
          appVersion: '1.0.0',
          deviceModel: 'Browser'
        }
      });
      
      // Track in Firebase Analytics
      firebaseAnalyticsService.trackVideoEvent('pause', selectedVideo.id, {
        duration: selectedVideo.duration,
        position: pauseTime,
        completionRate: (pauseTime / selectedVideo.duration) * 100,
        videoTitle: selectedVideo.title
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && selectedVideo) {
      const newTime = videoRef.current.currentTime;
      setCurrentTime(newTime);
      
      // Update progress every 5 seconds
      if (Math.floor(newTime) % 5 === 0) {
        updateVideoProgress(selectedVideo.id, {
          watchTime: newTime,
          lastWatched: new Date(),
          completed: newTime >= selectedVideo.duration * 0.95
        });
      }
    }
  };

  const handleVideoEnd = () => {
    if (selectedVideo && watchStartTime) {
      const watchDuration = Date.now() - watchStartTime;
      
      // Mark as completed
      updateVideoProgress(selectedVideo.id, {
        watchTime: selectedVideo.duration,
        completed: true,
        lastWatched: new Date()
      });
      
      trackVideoEngagement(selectedVideo.id, {
        action: 'complete',
        duration: selectedVideo.duration,
        completionRate: 100,
        watchDuration,
        pausePoints,
        userContext: {
          deviceType: 'desktop',
          browserInfo: navigator.userAgent,
          persona: 'demo-user',
          userSegment: 'demo',
          sessionStage: 'active',
          previousActions: []
        },
        deviceInfo: {
          platform: 'Web' as const,
          appVersion: '1.0.0',
          deviceModel: 'Browser'
        }
      });
      
      // Track in Firebase Analytics
      firebaseAnalyticsService.trackVideoEvent('complete', selectedVideo.id, {
        duration: selectedVideo.duration,
        position: selectedVideo.duration,
        completionRate: 100,
        videoTitle: selectedVideo.title
      });
      
      onVideoComplete();
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-library">
      <div className="video-header">
        <h2>Video Library</h2>
        <p>Learn through our comprehensive video tutorials and guides</p>
        
        <div className="video-controls">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search videos by title, description, or tags..."
              value={searchQuery}
              onChange={(e) => {
                const newQuery = e.target.value;
                setSearchQuery(newQuery);
                trackFormInteraction('video-library', 'search', 'change', newQuery);
              }}
              className="search-input"
            />
          </div>
          
          <div className="filter-sort-section">
            <div className="filter-group">
              <label htmlFor="category-filter">Category:</label>
              <select
                id="category-filter"
                value={filterCategory}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  const previousCategory = filterCategory;
                  setFilterCategory(newCategory);
                  
                  trackFormInteraction('video-library', 'category-filter', 'change', newCategory);
                  trackUserAction('video_filter_changed', {
                    fromCategory: previousCategory,
                    toCategory: newCategory,
                    availableVideos: filteredVideos.length,
                    totalVideos: videos.length
                  });
                }}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="sort-group">
              <label htmlFor="sort-select">Sort by:</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => {
                  const newSort = e.target.value as typeof sortBy;
                  setSortBy(newSort);
                  trackFormInteraction('video-library', 'sort', 'change', newSort);
                }}
              >
                <option value="title">Title</option>
                <option value="duration">Duration</option>
                <option value="rating">Rating</option>
                <option value="uploadDate">Upload Date</option>
                <option value="viewCount">View Count</option>
              </select>
            </div>
          </div>
          
          <div className="results-info">
            Showing {filteredVideos.length} of {videos.length} videos
          </div>
        </div>
      </div>

      {selectedVideo && (
        <div className="video-player-section">
          <div className="video-player">
            <video
              ref={videoRef}
              width="100%"
              height="400"
              controls
              onPlay={handlePlay}
              onPause={handlePause}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnd}
              poster={selectedVideo.thumbnailUrl || selectedVideo.thumbnail}
            >
              <source src={selectedVideo.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          
          <div className="video-info">
            <div className="video-header-info">
              <h3>{selectedVideo.title}</h3>
              <div className="video-stats">
                <span className="rating">⭐ {selectedVideo.rating}</span>
                <span className="views">{selectedVideo.viewCount.toLocaleString()} views</span>
                <span className="upload-date">
                  {selectedVideo.uploadDate.toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <p>{selectedVideo.description}</p>
            
            <div className="video-meta">
              <span className="category">{selectedVideo.category.replace('-', ' ')}</span>
              <span className="difficulty">{selectedVideo.difficulty}</span>
              <span className="duration">{formatDuration(selectedVideo.duration)}</span>
            </div>
            
            <div className="video-tags">
              {selectedVideo.tags.map(tag => (
                <span key={tag} className="tag">#{tag}</span>
              ))}
            </div>
            
            <div className="video-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(currentTime / selectedVideo.duration) * 100}%` }}
                />
                {bookmarks.map((bookmark, index) => (
                  <div
                    key={index}
                    className="bookmark-marker"
                    style={{ left: `${(bookmark / selectedVideo.duration) * 100}%` }}
                    onClick={() => handleJumpToBookmark(bookmark)}
                    title={`Bookmark at ${formatDuration(Math.floor(bookmark))}`}
                  />
                ))}
              </div>
              <div className="progress-info">
                <span className="progress-text">
                  {formatDuration(Math.floor(currentTime))} / {formatDuration(selectedVideo.duration)}
                </span>
                <button 
                  className="bookmark-btn"
                  onClick={handleAddBookmark}
                  title="Add bookmark at current time"
                >
                  📌 Bookmark
                </button>
              </div>
            </div>
            
            {bookmarks.length > 0 && (
              <div className="bookmarks-list">
                <h4>Bookmarks</h4>
                <div className="bookmarks">
                  {bookmarks.map((bookmark, index) => (
                    <button
                      key={index}
                      className="bookmark-item"
                      onClick={() => handleJumpToBookmark(bookmark)}
                    >
                      {formatDuration(Math.floor(bookmark))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="video-grid">
        {filteredVideos.map(video => {
          const progress = getVideoProgress(video.id);
          const progressPercent = progress ? (progress.watchTime / video.duration) * 100 : 0;
          
          return (
            <div
              key={video.id}
              className={`video-card ${selectedVideo?.id === video.id ? 'selected' : ''} ${progress?.completed ? 'completed' : ''}`}
              onClick={() => handleVideoSelect(video)}
            >
              <div className="video-thumbnail">
                {video.thumbnailUrl ? (
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title}
                    className="video-thumbnail-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="video-thumbnail-icon">{video.thumbnail}</div>
                )}
                
                <div className="video-duration">
                  {formatDuration(video.duration)}
                </div>
                
                <div className={`difficulty-badge ${video.difficulty}`}>
                  {video.difficulty}
                </div>
                
                {progress?.completed && (
                  <div className="completed-badge">✓</div>
                )}
                
                {progressPercent > 0 && (
                  <div className="video-progress-overlay">
                    <div 
                      className="progress-bar-small"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
              
              <div className="video-details">
                <h4>{video.title}</h4>
                <p>{video.description}</p>
                
                <div className="video-metadata">
                  <div className="video-category">{video.category.replace('-', ' ')}</div>
                  <div className="video-stats">
                    <span className="rating">⭐ {video.rating}</span>
                    <span className="views">{video.viewCount.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="video-tags-preview">
                  {video.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="tag-small">#{tag}</span>
                  ))}
                  {video.tags.length > 3 && (
                    <span className="tag-more">+{video.tags.length - 3}</span>
                  )}
                </div>
                
                {progress && (
                  <div className="progress-indicator">
                    {progress.completed ? (
                      <span className="completed-text">✓ Completed</span>
                    ) : progress.watchTime > 0 ? (
                      <span className="in-progress-text">
                        ▶ Resume at {formatDuration(Math.floor(progress.watchTime))}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoLibrary;