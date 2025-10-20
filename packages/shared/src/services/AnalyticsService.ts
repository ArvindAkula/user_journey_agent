import axios, { AxiosInstance } from 'axios';
import { 
  UserJourneyMetrics, 
  VideoEngagementMetrics, 
  StruggleSignalData, 
  UserSegmentData, 
  TimeSeriesData, 
  AnalyticsFilter,
  ExportData 
} from '../types';
import { ANALYTICS_ENDPOINTS } from '../constants/endpoints';

export interface AnalyticsServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class AnalyticsService {
  private apiClient: AxiosInstance;

  constructor(config: AnalyticsServiceConfig) {
    console.log('🔧 [AnalyticsService] Initializing with config:', {
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: config.headers
    });
    
    this.apiClient = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });
    
    // Add request interceptor for debugging
    this.apiClient.interceptors.request.use(
      (config) => {
        console.log('📤 [AnalyticsService] Outgoing request:', {
          method: config.method?.toUpperCase(),
          baseURL: config.baseURL,
          url: config.url,
          fullURL: `${config.baseURL}${config.url}`,
          data: config.data
        });
        return config;
      },
      (error) => {
        console.error('❌ [AnalyticsService] Request error:', error);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for debugging
    this.apiClient.interceptors.response.use(
      (response) => {
        console.log('📥 [AnalyticsService] Response received:', {
          status: response.status,
          url: response.config.url,
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        console.error('❌ [AnalyticsService] Response error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  // Helper to check if we should use mock data
  private shouldUseMockData(): boolean {
    const useRealData = localStorage.getItem('use_real_data') === 'true';
    const demoMode = localStorage.getItem('analytics_demo_mode') === 'true';
    return demoMode && !useRealData;
  }

  async getUserJourneyMetrics(filters?: AnalyticsFilter): Promise<UserJourneyMetrics> {
    if (this.shouldUseMockData()) {
      console.log('Demo mode: returning mock user journey metrics');
      return {
        totalUsers: 1250,
        activeUsers: 890,
        conversionRate: 68.5,
        averageSessionDuration: 12.3,
        dropOffRate: 15.2,
        struggleSignals: 45
      };
    }

    try {
      console.log('📡 [AnalyticsService] Calling', ANALYTICS_ENDPOINTS.USER_JOURNEY, 'with filters:', filters);
      const response = await this.apiClient.post(ANALYTICS_ENDPOINTS.USER_JOURNEY, filters || {});
      console.log('✅ [AnalyticsService] Received user journey metrics from backend:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [AnalyticsService] Error fetching user journey metrics:', error);
      console.warn('⚠️  [AnalyticsService] Falling back to mock data');
      // Return mock data for demo purposes
      return {
        totalUsers: 1250,
        activeUsers: 890,
        conversionRate: 68.5,
        averageSessionDuration: 12.3,
        dropOffRate: 15.2,
        struggleSignals: 45
      };
    }
  }

  async getVideoEngagementMetrics(filters?: AnalyticsFilter): Promise<VideoEngagementMetrics> {
    if (this.shouldUseMockData()) {
      console.log('Demo mode: returning mock video engagement metrics');
      return {
        totalViews: 5420,
        averageWatchTime: 4.2,
        completionRate: 72.8,
        topVideos: [
          { videoId: 'v1', title: 'Getting Started Guide', views: 1200, avgWatchTime: 5.1, completionRate: 85.2 },
          { videoId: 'v2', title: 'Advanced Features', views: 980, avgWatchTime: 3.8, completionRate: 68.4 },
          { videoId: 'v3', title: 'Tips & Tricks', views: 750, avgWatchTime: 4.5, completionRate: 76.1 }
        ]
      };
    }

    try {
      const response = await this.apiClient.post(ANALYTICS_ENDPOINTS.VIDEO_ENGAGEMENT, filters || {});
      return response.data;
    } catch (error) {
      console.error('Error fetching video engagement metrics:', error);
      // Return mock data for demo purposes
      return {
        totalViews: 5420,
        averageWatchTime: 4.2,
        completionRate: 72.8,
        topVideos: [
          { videoId: 'v1', title: 'Getting Started Guide', views: 1200, avgWatchTime: 5.1, completionRate: 85.2 },
          { videoId: 'v2', title: 'Advanced Features', views: 980, avgWatchTime: 3.8, completionRate: 68.4 },
          { videoId: 'v3', title: 'Tips & Tricks', views: 750, avgWatchTime: 4.5, completionRate: 76.1 }
        ]
      };
    }
  }

  async getStruggleSignals(filters?: AnalyticsFilter): Promise<StruggleSignalData[]> {
    if (this.shouldUseMockData()) {
      console.log('Demo mode: returning mock struggle signals');
      return [
        { featureId: 'document_upload', featureName: 'Document Upload', signalCount: 23, severity: 'high', trend: 'increasing' },
        { featureId: 'calculator', featureName: 'Loan Calculator', signalCount: 15, severity: 'medium', trend: 'stable' },
        { featureId: 'form_submission', featureName: 'Application Form', signalCount: 8, severity: 'low', trend: 'decreasing' }
      ];
    }

    try {
      const response = await this.apiClient.post(ANALYTICS_ENDPOINTS.STRUGGLE_SIGNALS, filters || {});
      return response.data;
    } catch (error) {
      console.error('Error fetching struggle signals:', error);
      // Return mock data for demo purposes
      return [
        { featureId: 'document_upload', featureName: 'Document Upload', signalCount: 23, severity: 'high', trend: 'increasing' },
        { featureId: 'calculator', featureName: 'Loan Calculator', signalCount: 15, severity: 'medium', trend: 'stable' },
        { featureId: 'form_submission', featureName: 'Application Form', signalCount: 8, severity: 'low', trend: 'decreasing' }
      ];
    }
  }

  async getUserSegments(filters?: AnalyticsFilter): Promise<UserSegmentData[]> {
    try {
      const response = await this.apiClient.post(ANALYTICS_ENDPOINTS.USER_SEGMENTS, filters || {});
      return response.data;
    } catch (error) {
      console.error('Error fetching user segments:', error);
      // Return mock data for demo purposes
      return [
        { segment: 'New Users', userCount: 320, conversionRate: 45.2, avgEngagement: 6.8 },
        { segment: 'Active Users', userCount: 890, conversionRate: 78.5, avgEngagement: 12.3 },
        { segment: 'At Risk', userCount: 125, conversionRate: 25.1, avgEngagement: 3.2 },
        { segment: 'Churned', userCount: 85, conversionRate: 0, avgEngagement: 0 }
      ];
    }
  }

  async getTimeSeriesData(metric: string, filters?: AnalyticsFilter): Promise<TimeSeriesData[]> {
    try {
      const response = await this.apiClient.post(ANALYTICS_ENDPOINTS.TIME_SERIES, { 
        metric, 
        filters: filters || null 
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching time series data:', error);
      // Return mock data for demo purposes
      const mockData: TimeSeriesData[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        mockData.push({
          timestamp: date.toISOString().split('T')[0],
          value: Math.floor(Math.random() * 100) + 50,
          metric
        });
      }
      return mockData;
    }
  }

  async exportData(exportConfig: ExportData): Promise<Blob> {
    try {
      const response = await this.apiClient.post(ANALYTICS_ENDPOINTS.EXPORT, exportConfig, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async getUserInsights(userId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/nova/insights/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user insights:', error);
      throw error;
    }
  }

  async getDashboardMetrics(): Promise<any> {
    if (this.shouldUseMockData()) {
      console.log('Demo mode: returning mock dashboard metrics');
      return {
        totalUsers: 1250,
        activeUsers: 890,
        conversionRate: 68.5,
        averageSessionDuration: 12.3,
        dropOffRate: 15.2,
        struggleSignals: 45,
        videoEngagement: {
          totalViews: 5420,
          averageWatchTime: 4.2,
          completionRate: 72.8
        },
        realTimeMetrics: {
          currentActiveUsers: 23,
          eventsPerMinute: 145,
          interventionsTriggered: 3,
          errorRate: 0.02
        }
      };
    }

    try {
      console.log('📡 [AnalyticsService] Calling', ANALYTICS_ENDPOINTS.DASHBOARD);
      const response = await this.apiClient.get(ANALYTICS_ENDPOINTS.DASHBOARD);
      console.log('✅ [AnalyticsService] Received dashboard metrics from backend:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [AnalyticsService] Error fetching dashboard metrics:', error);
      console.warn('⚠️  [AnalyticsService] Falling back to mock data');
      // Return mock data for demo purposes
      return {
        totalUsers: 1250,
        activeUsers: 890,
        conversionRate: 68.5,
        averageSessionDuration: 12.3,
        dropOffRate: 15.2,
        struggleSignals: 45,
        videoEngagement: {
          totalViews: 5420,
          averageWatchTime: 4.2,
          completionRate: 72.8
        },
        realTimeMetrics: {
          currentActiveUsers: 23,
          eventsPerMinute: 145,
          interventionsTriggered: 3,
          errorRate: 0.02
        }
      };
    }
  }
}