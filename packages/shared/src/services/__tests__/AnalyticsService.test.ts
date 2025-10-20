import { AnalyticsService } from '../AnalyticsService';
import { AnalyticsFilter } from '../../types/AnalyticsFilter';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  }))
}));

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockAxios: any;

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = new AnalyticsService();
    mockAxios = (analyticsService as any).api;
  });

  describe('getMetricsOverview', () => {
    it('fetches metrics overview successfully', async () => {
      const mockData = {
        totalUsers: 1000,
        activeUsers: 750,
        conversionRate: 0.15,
        avgSessionDuration: 300
      };
      
      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await analyticsService.getMetricsOverview();
      
      expect(mockAxios.get).toHaveBeenCalledWith('/analytics/metrics/overview');
      expect(result).toEqual(mockData);
    });

    it('handles API errors gracefully', async () => {
      const error = new Error('API Error');
      mockAxios.get.mockRejectedValue(error);

      await expect(analyticsService.getMetricsOverview()).rejects.toThrow('API Error');
    });
  });

  describe('getUserJourneyData', () => {
    it('fetches user journey data with filters', async () => {
      const mockData = [
        { step: 'landing', users: 1000, dropoff: 0.1 },
        { step: 'signup', users: 900, dropoff: 0.2 },
        { step: 'onboarding', users: 720, dropoff: 0.15 }
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

      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await analyticsService.getUserJourneyData(filters);
      
      expect(mockAxios.get).toHaveBeenCalledWith('/analytics/user-journey', {
        params: expect.objectContaining({
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-01-31T00:00:00.000Z',
          userSegments: 'new_users',
          platforms: 'web',
          features: 'calculator'
        })
      });
      expect(result).toEqual(mockData);
    });

    it('handles empty filters', async () => {
      const mockData = [];
      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await analyticsService.getUserJourneyData({} as AnalyticsFilter);
      
      expect(mockAxios.get).toHaveBeenCalledWith('/analytics/user-journey', {
        params: {}
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('getStruggleSignals', () => {
    it('fetches struggle signals data', async () => {
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

      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await analyticsService.getStruggleSignals();
      
      expect(mockAxios.get).toHaveBeenCalledWith('/analytics/struggle-signals');
      expect(result).toEqual(mockData);
    });
  });

  describe('getVideoEngagementData', () => {
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

      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await analyticsService.getVideoEngagementData(filters);
      
      expect(mockAxios.get).toHaveBeenCalledWith('/analytics/video-engagement', {
        params: expect.objectContaining({
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-01-31T00:00:00.000Z'
        })
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('exportAnalyticsData', () => {
    it('exports analytics data successfully', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      mockAxios.get.mockResolvedValue({ data: mockBlob });

      const exportConfig = {
        format: 'csv' as const,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-31')
        },
        includeMetrics: ['users', 'sessions'],
        filters: {} as AnalyticsFilter
      };

      const result = await analyticsService.exportAnalyticsData(exportConfig);
      
      expect(mockAxios.get).toHaveBeenCalledWith('/analytics/export', {
        params: expect.objectContaining({
          format: 'csv',
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-01-31T00:00:00.000Z',
          includeMetrics: 'users,sessions'
        }),
        responseType: 'blob'
      });
      expect(result).toEqual(mockBlob);
    });
  });

  describe('getRealTimeMetrics', () => {
    it('fetches real-time metrics', async () => {
      const mockData = {
        activeUsers: 150,
        currentSessions: 200,
        eventsPerMinute: 50,
        topPages: ['/calculator', '/videos', '/upload']
      };

      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await analyticsService.getRealTimeMetrics();
      
      expect(mockAxios.get).toHaveBeenCalledWith('/analytics/real-time');
      expect(result).toEqual(mockData);
    });
  });

  describe('error handling', () => {
    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockAxios.get.mockRejectedValue(networkError);

      await expect(analyticsService.getMetricsOverview()).rejects.toThrow('Network Error');
    });

    it('handles 404 errors', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Not found' }
        }
      };
      mockAxios.get.mockRejectedValue(error);

      await expect(analyticsService.getMetricsOverview()).rejects.toThrow();
    });

    it('handles 500 errors', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      };
      mockAxios.get.mockRejectedValue(error);

      await expect(analyticsService.getMetricsOverview()).rejects.toThrow();
    });
  });
});