import { renderHook, act } from '@testing-library/react';
import { useAnalytics } from '../useAnalytics';
import { AnalyticsService } from '../../services/AnalyticsService';
import { AnalyticsFilter } from '../../types/AnalyticsFilter';

// Mock AnalyticsService
jest.mock('../../services/AnalyticsService');

describe('useAnalytics Hook', () => {
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsService = new AnalyticsService() as jest.Mocked<AnalyticsService>;
    (AnalyticsService as jest.Mock).mockImplementation(() => mockAnalyticsService);
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches metrics overview successfully', async () => {
    const mockData = {
      totalUsers: 1000,
      activeUsers: 750,
      conversionRate: 0.15,
      avgSessionDuration: 300
    };

    mockAnalyticsService.getMetricsOverview.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      await result.current.fetchMetricsOverview();
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockAnalyticsService.getMetricsOverview).toHaveBeenCalled();
  });

  it('handles metrics overview fetch error', async () => {
    const error = new Error('Failed to fetch metrics');
    mockAnalyticsService.getMetricsOverview.mockRejectedValue(error);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      await result.current.fetchMetricsOverview();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Failed to fetch metrics');
  });

  it('fetches user journey data with filters', async () => {
    const mockData = [
      { step: 'landing', users: 1000, dropoff: 0.1 },
      { step: 'signup', users: 900, dropoff: 0.2 }
    ];

    const filters: AnalyticsFilter = {
      dateRange: {
        start: new Date('2023-01-01'),
        end: new Date('2023-01-31')
      },
      userSegments: ['new_users'],
      platforms: ['web'],
      features: ['calculator']
    };

    mockAnalyticsService.getUserJourneyData.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      await result.current.fetchUserJourneyData(filters);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockAnalyticsService.getUserJourneyData).toHaveBeenCalledWith(filters);
  });

  it('fetches struggle signals successfully', async () => {
    const mockData = [
      {
        id: '1',
        userId: 'user123',
        feature: 'calculator',
        signalType: 'multiple_attempts',
        severity: 'high',
        timestamp: new Date('2023-01-15T10:00:00Z')
      }
    ];

    mockAnalyticsService.getStruggleSignals.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      await result.current.fetchStruggleSignals();
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockAnalyticsService.getStruggleSignals).toHaveBeenCalled();
  });

  it('fetches video engagement data with filters', async () => {
    const mockData = [
      {
        videoId: 'video1',
        title: 'Tutorial 1',
        views: 500,
        avgWatchTime: 120,
        completionRate: 0.75
      }
    ];

    const filters: AnalyticsFilter = {
      dateRange: {
        start: new Date('2023-01-01'),
        end: new Date('2023-01-31')
      },
      userSegments: [],
      platforms: ['web'],
      features: []
    };

    mockAnalyticsService.getVideoEngagementData.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      await result.current.fetchVideoEngagementData(filters);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockAnalyticsService.getVideoEngagementData).toHaveBeenCalledWith(filters);
  });

  it('exports analytics data successfully', async () => {
    const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
    const exportConfig = {
      format: 'csv' as const,
      dateRange: {
        start: new Date('2023-01-01'),
        end: new Date('2023-01-31')
      },
      includeMetrics: ['users', 'sessions'],
      filters: {} as AnalyticsFilter
    };

    mockAnalyticsService.exportAnalyticsData.mockResolvedValue(mockBlob);

    const { result } = renderHook(() => useAnalytics());

    let exportResult: Blob | null = null;
    await act(async () => {
      exportResult = await result.current.exportData(exportConfig);
    });

    expect(exportResult).toEqual(mockBlob);
    expect(mockAnalyticsService.exportAnalyticsData).toHaveBeenCalledWith(exportConfig);
  });

  it('fetches real-time metrics successfully', async () => {
    const mockData = {
      activeUsers: 150,
      currentSessions: 200,
      eventsPerMinute: 50,
      topPages: ['/calculator', '/videos', '/upload']
    };

    mockAnalyticsService.getRealTimeMetrics.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      await result.current.fetchRealTimeMetrics();
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockAnalyticsService.getRealTimeMetrics).toHaveBeenCalled();
  });

  it('sets loading state during fetch operations', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockAnalyticsService.getMetricsOverview.mockReturnValue(promise);

    const { result } = renderHook(() => useAnalytics());

    // Start fetch operation
    act(() => {
      result.current.fetchMetricsOverview();
    });

    expect(result.current.loading).toBe(true);

    // Complete fetch operation
    await act(async () => {
      resolvePromise({ totalUsers: 1000 });
      await promise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('clears error when clearError is called', async () => {
    const error = new Error('Test error');
    mockAnalyticsService.getMetricsOverview.mockRejectedValue(error);

    const { result } = renderHook(() => useAnalytics());

    // Trigger error
    await act(async () => {
      await result.current.fetchMetricsOverview();
    });

    expect(result.current.error).toBe('Test error');

    // Clear error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('refreshes data when refresh is called', async () => {
    const mockData = { totalUsers: 1000 };
    mockAnalyticsService.getMetricsOverview.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAnalytics());

    // Initial fetch
    await act(async () => {
      await result.current.fetchMetricsOverview();
    });

    expect(mockAnalyticsService.getMetricsOverview).toHaveBeenCalledTimes(1);

    // Refresh
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockAnalyticsService.getMetricsOverview).toHaveBeenCalledTimes(2);
  });
});