export interface AnalyticsFilter {
  dateRange: {
    start: Date;
    end: Date;
  };
  userSegments: string[];
  platforms: string[];
  features: string[];
  personas?: string[];
  eventTypes?: string[];
}

export interface UserJourneyMetrics {
  totalUsers: number;
  activeUsers: number;
  conversionRate: number;
  averageSessionDuration: number;
  dropOffRate: number;
  struggleSignals: number;
}

export interface VideoEngagementMetrics {
  totalViews: number;
  averageWatchTime: number;
  completionRate: number;
  topVideos: VideoMetric[];
}

export interface VideoMetric {
  videoId: string;
  title: string;
  views: number;
  avgWatchTime: number;
  completionRate: number;
}

export interface StruggleSignalData {
  featureId: string;
  featureName: string;
  signalCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'increasing' | 'decreasing' | 'stable';
  detectedAt?: number;
  description?: string;
  recommendedActions?: string[];
  exitRiskScore?: number;
}

export interface UserSegmentData {
  segment: string;
  userCount: number;
  conversionRate: number;
  avgEngagement: number;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  metric: string;
}

export interface ExportData {
  format: 'csv' | 'json' | 'pdf';
  data: any;
  filename: string;
}

export interface AmazonQQuery {
  query: string;
  context?: string;
  filters?: AnalyticsFilter;
}

export interface AmazonQResponse {
  answer: string;
  confidence: number;
  sources: string[];
  visualizations?: any[];
  followUpQuestions?: string[];
}