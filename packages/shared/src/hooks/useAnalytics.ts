import { useState, useEffect, useCallback } from 'react';
import { AnalyticsService } from '../services';
import { 
  UserJourneyMetrics, 
  VideoEngagementMetrics, 
  StruggleSignalData, 
  UserSegmentData, 
  TimeSeriesData, 
  AnalyticsFilter,
  ExportData 
} from '../types';

export interface UseAnalyticsConfig {
  analyticsService: AnalyticsService;
}

export const useAnalytics = (config: UseAnalyticsConfig) => {
  const { analyticsService } = config;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserJourneyMetrics = useCallback(async (filters?: AnalyticsFilter): Promise<UserJourneyMetrics | null> => {
    return executeWithErrorHandling(() => analyticsService.getUserJourneyMetrics(filters));
  }, [analyticsService, executeWithErrorHandling]);

  const getVideoEngagementMetrics = useCallback(async (filters?: AnalyticsFilter): Promise<VideoEngagementMetrics | null> => {
    return executeWithErrorHandling(() => analyticsService.getVideoEngagementMetrics(filters));
  }, [analyticsService, executeWithErrorHandling]);

  const getStruggleSignals = useCallback(async (filters?: AnalyticsFilter): Promise<StruggleSignalData[] | null> => {
    return executeWithErrorHandling(() => analyticsService.getStruggleSignals(filters));
  }, [analyticsService, executeWithErrorHandling]);

  const getUserSegments = useCallback(async (filters?: AnalyticsFilter): Promise<UserSegmentData[] | null> => {
    return executeWithErrorHandling(() => analyticsService.getUserSegments(filters));
  }, [analyticsService, executeWithErrorHandling]);

  const getTimeSeriesData = useCallback(async (metric: string, filters?: AnalyticsFilter): Promise<TimeSeriesData[] | null> => {
    return executeWithErrorHandling(() => analyticsService.getTimeSeriesData(metric, filters));
  }, [analyticsService, executeWithErrorHandling]);

  const exportData = useCallback(async (exportConfig: ExportData): Promise<Blob | null> => {
    return executeWithErrorHandling(() => analyticsService.exportData(exportConfig));
  }, [analyticsService, executeWithErrorHandling]);

  const getUserInsights = useCallback(async (userId: string): Promise<any> => {
    return executeWithErrorHandling(() => analyticsService.getUserInsights(userId));
  }, [analyticsService, executeWithErrorHandling]);

  const getDashboardMetrics = useCallback(async (): Promise<any> => {
    return executeWithErrorHandling(() => analyticsService.getDashboardMetrics());
  }, [analyticsService, executeWithErrorHandling]);

  return {
    loading,
    error,
    getUserJourneyMetrics,
    getVideoEngagementMetrics,
    getStruggleSignals,
    getUserSegments,
    getTimeSeriesData,
    exportData,
    getUserInsights,
    getDashboardMetrics,
  };
};