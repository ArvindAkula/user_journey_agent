/**
 * CDN and asset optimization utilities for analytics dashboard
 */
import React from 'react';

interface CDNConfig {
  baseUrl: string;
  version: string;
  enablePreload: boolean;
  enablePrefetch: boolean;
}

class DashboardCDNManager {
  private config: CDNConfig;
  private preloadedAssets: Set<string> = new Set();
  private prefetchedAssets: Set<string> = new Set();

  constructor(config: CDNConfig) {
    this.config = config;
  }

  /**
   * Get the full CDN URL for an asset
   */
  getAssetUrl(assetPath: string): string {
    if (process.env.REACT_APP_ENVIRONMENT !== 'production' || !this.config.baseUrl) {
      return assetPath;
    }

    // Remove leading slash if present
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    
    return `${this.config.baseUrl}/dashboard/${this.config.version}/${cleanPath}`;
  }

  /**
   * Preload critical assets for dashboard
   */
  preloadAsset(assetPath: string, assetType: 'script' | 'style' | 'image' | 'font' = 'script'): void {
    if (!this.config.enablePreload || this.preloadedAssets.has(assetPath)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = this.getAssetUrl(assetPath);
    
    switch (assetType) {
      case 'script':
        link.as = 'script';
        break;
      case 'style':
        link.as = 'style';
        break;
      case 'image':
        link.as = 'image';
        break;
      case 'font':
        link.as = 'font';
        link.crossOrigin = 'anonymous';
        break;
    }

    document.head.appendChild(link);
    this.preloadedAssets.add(assetPath);
  }

  /**
   * Prefetch dashboard-specific assets
   */
  prefetchAsset(assetPath: string): void {
    if (!this.config.enablePrefetch || this.prefetchedAssets.has(assetPath)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = this.getAssetUrl(assetPath);

    document.head.appendChild(link);
    this.prefetchedAssets.add(assetPath);
  }

  /**
   * Preload critical dashboard assets
   */
  preloadCriticalAssets(): void {
    // Preload critical fonts for dashboard
    this.preloadAsset('/static/fonts/inter-var.woff2', 'font');
    this.preloadAsset('/static/fonts/roboto-mono.woff2', 'font'); // For code/data display
    
    // Preload dashboard icons and images
    this.preloadAsset('/static/images/dashboard-logo.svg', 'image');
    this.preloadAsset('/static/images/chart-icons.svg', 'image');
    
    // Preload critical CSS
    this.preloadAsset('/static/css/dashboard.css', 'style');
    this.preloadAsset('/static/css/charts.css', 'style');
  }

  /**
   * Prefetch dashboard page assets
   */
  prefetchDashboardAssets(pageName: string): void {
    const pageAssets: Record<string, string[]> = {
      dashboard: [
        '/static/js/dashboard.chunk.js',
        '/static/css/dashboard.css',
        '/static/js/recharts.chunk.js',
      ],
      metrics: [
        '/static/js/metrics.chunk.js',
        '/static/css/metrics.css',
        '/static/js/charts.chunk.js',
      ],
      'user-journey': [
        '/static/js/user-journey.chunk.js',
        '/static/css/user-journey.css',
        '/static/js/d3.chunk.js',
      ],
      realtime: [
        '/static/js/realtime.chunk.js',
        '/static/css/realtime.css',
        '/static/js/socketio.chunk.js',
      ],
      exports: [
        '/static/js/exports.chunk.js',
        '/static/css/exports.css',
      ],
    };

    const assets = pageAssets[pageName] || [];
    assets.forEach(asset => this.prefetchAsset(asset));
  }

  /**
   * Optimize chart library loading
   */
  preloadChartLibraries(): void {
    // Preload chart libraries that are commonly used
    this.preloadAsset('/static/js/recharts.chunk.js');
    this.preloadAsset('/static/js/d3.chunk.js');
    
    // Prefetch less common chart libraries
    this.prefetchAsset('/static/js/chart-js.chunk.js');
    this.prefetchAsset('/static/js/plotly.chunk.js');
  }

  /**
   * Setup resource hints for dashboard performance
   */
  setupResourceHints(): void {
    // DNS prefetch for external services
    const dnsPrefetchDomains = [
      'api.analytics.example.com',
      'ws.analytics.example.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
    ];

    dnsPrefetchDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });

    // Preconnect to critical origins
    const preconnectOrigins = [
      process.env.REACT_APP_API_URL,
      process.env.REACT_APP_WS_URL,
    ].filter(Boolean);

    preconnectOrigins.forEach(origin => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin!;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  /**
   * Optimize data visualization assets
   */
  optimizeVisualizationAssets(): void {
    // Lazy load heavy visualization libraries
    const loadVisualizationLibrary = (libraryName: string) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = this.getAssetUrl(`/static/js/${libraryName}.chunk.js`);
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    // Store library loaders for on-demand loading
    (window as any).loadVisualizationLibrary = loadVisualizationLibrary;
  }

  /**
   * Clear cache and reset tracking
   */
  clearCache(): void {
    this.preloadedAssets.clear();
    this.prefetchedAssets.clear();
  }

  /**
   * Get performance-optimized image URL for dashboard assets
   */
  getOptimizedImageUrl(basePath: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
  } = {}): string {
    if (process.env.REACT_APP_ENVIRONMENT !== 'production') {
      return basePath;
    }

    const { width, height, quality = 80, format = 'webp' } = options;
    
    let optimizedPath = basePath;
    const params = new URLSearchParams();
    
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    params.append('q', quality.toString());
    params.append('f', format);
    
    if (params.toString()) {
      optimizedPath += `?${params.toString()}`;
    }

    return this.getAssetUrl(optimizedPath);
  }
}

// Create dashboard CDN manager instance
const dashboardCDNConfig: CDNConfig = {
  baseUrl: process.env.REACT_APP_CDN_URL || '',
  version: process.env.REACT_APP_VERSION || 'v1',
  enablePreload: process.env.REACT_APP_ENVIRONMENT === 'production',
  enablePrefetch: process.env.REACT_APP_ENVIRONMENT === 'production',
};

export const dashboardCDNManager = new DashboardCDNManager(dashboardCDNConfig);

/**
 * Hook for using CDN functionality in dashboard components
 */
export const useDashboardCDN = () => {
  return {
    getAssetUrl: dashboardCDNManager.getAssetUrl.bind(dashboardCDNManager),
    preloadAsset: dashboardCDNManager.preloadAsset.bind(dashboardCDNManager),
    prefetchAsset: dashboardCDNManager.prefetchAsset.bind(dashboardCDNManager),
    prefetchDashboardAssets: dashboardCDNManager.prefetchDashboardAssets.bind(dashboardCDNManager),
    getOptimizedImageUrl: dashboardCDNManager.getOptimizedImageUrl.bind(dashboardCDNManager),
    preloadChartLibraries: dashboardCDNManager.preloadChartLibraries.bind(dashboardCDNManager),
  };
};

/**
 * Dashboard-optimized lazy image component
 */
export const DashboardLazyImage: React.FC<{
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  className?: string;
  placeholder?: string;
}> = ({ 
  src, 
  alt, 
  width, 
  height, 
  quality = 80, 
  format = 'webp',
  className = '', 
  placeholder 
}) => {
  const { getOptimizedImageUrl, getAssetUrl } = useDashboardCDN();
  
  const optimizedSrc = getOptimizedImageUrl(src, { width, height, quality, format });
  
  const placeholderSrc = placeholder 
    ? getAssetUrl(placeholder)
    : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjc3NDhkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=';

  return React.createElement('img', {
    'data-src': optimizedSrc,
    src: placeholderSrc,
    alt: alt,
    width: width,
    height: height,
    className: `dashboard-lazy-image ${className}`,
    loading: 'lazy',
    style: {
      transition: 'opacity 0.3s ease',
      backgroundColor: '#f8f9fa',
    }
  });
};

export default dashboardCDNManager;