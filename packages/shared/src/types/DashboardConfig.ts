import { AnalyticsFilter } from './AnalyticsFilter';

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'filter' | 'export';
  title: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: {
    dataSource?: string;
    chartType?: 'line' | 'bar' | 'pie' | 'heatmap' | 'funnel';
    metrics?: string[];
    filters?: AnalyticsFilter;
    refreshInterval?: number;
  };
  visible: boolean;
}

export interface DashboardConfig {
  id: string;
  name: string;
  layout: 'grid' | 'list' | 'custom';
  widgets: DashboardWidget[];
  refreshInterval: number;
  defaultFilters: AnalyticsFilter;
  exportSettings: ExportConfig;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canShare: boolean;
  };
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

export interface ExportConfig {
  formats: ('csv' | 'json' | 'pdf' | 'xlsx')[];
  includeFilters: boolean;
  includeMetadata: boolean;
  dateFormat: string;
  timezone: string;
  maxRows?: number;
  compression?: boolean;
}