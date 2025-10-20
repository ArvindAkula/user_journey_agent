/**
 * CDN and asset optimization utilities for production deployment
 */
import React from 'react';

interface CDNConfig {
  baseUrl: string;
  version: string;
  enablePreload: boolean;
  enablePrefetch: boolean;
}

class CDNManager {
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
    
    return `${this.config.baseUrl}/${this.config.version}/${cleanPath}`;
  }

  /**
   * Preload critical assets
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
   * Prefetch non-critical assets
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
   * Preload critical resources for the user app
   */
  preloadCriticalAssets(): void {
    // Preload critical fonts
    this.preloadAsset('/static/fonts/inter-var.woff2', 'font');
    
    // Preload critical images
    this.preloadAsset('/static/images/logo.svg', 'image');
    this.preloadAsset('/static/images/hero-bg.jpg', 'image');
    
    // Preload critical CSS chunks
    this.preloadAsset('/static/css/main.css', 'style');
  }

  /**
   * Prefetch route-based assets
   */
  prefetchRouteAssets(routeName: string): void {
    const routeAssets: Record<string, string[]> = {
      calculator: [
        '/static/js/calculator.chunk.js',
        '/static/css/calculator.css',
      ],
      videos: [
        '/static/js/videos.chunk.js',
        '/static/css/videos.css',
        '/static/images/video-placeholder.jpg',
      ],
      documents: [
        '/static/js/documents.chunk.js',
        '/static/css/documents.css',
      ],
      profile: [
        '/static/js/profile.chunk.js',
        '/static/css/profile.css',
      ],
    };

    const assets = routeAssets[routeName] || [];
    assets.forEach(asset => this.prefetchAsset(asset));
  }

  /**
   * Set up intersection observer for lazy loading images
   */
  setupLazyLoading(): void {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          
          if (src) {
            img.src = this.getAssetUrl(src);
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01,
    });

    // Observe all lazy images
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  /**
   * Optimize image loading with responsive images
   */
  getResponsiveImageUrl(basePath: string, width: number, quality: number = 80): string {
    if (process.env.REACT_APP_ENVIRONMENT !== 'production') {
      return basePath;
    }

    // Add image optimization parameters for CDN
    const optimizedPath = `${basePath}?w=${width}&q=${quality}&f=webp`;
    return this.getAssetUrl(optimizedPath);
  }

  /**
   * Clear preloaded/prefetched asset tracking
   */
  clearCache(): void {
    this.preloadedAssets.clear();
    this.prefetchedAssets.clear();
  }
}

// Create CDN manager instance
const cdnConfig: CDNConfig = {
  baseUrl: process.env.REACT_APP_CDN_URL || '',
  version: process.env.REACT_APP_VERSION || 'v1',
  enablePreload: process.env.REACT_APP_ENVIRONMENT === 'production',
  enablePrefetch: process.env.REACT_APP_ENVIRONMENT === 'production',
};

export const cdnManager = new CDNManager(cdnConfig);

/**
 * Hook for using CDN functionality in components
 */
export const useCDN = () => {
  return {
    getAssetUrl: cdnManager.getAssetUrl.bind(cdnManager),
    preloadAsset: cdnManager.preloadAsset.bind(cdnManager),
    prefetchAsset: cdnManager.prefetchAsset.bind(cdnManager),
    prefetchRouteAssets: cdnManager.prefetchRouteAssets.bind(cdnManager),
    getResponsiveImageUrl: cdnManager.getResponsiveImageUrl.bind(cdnManager),
  };
};

/**
 * Lazy Image component with CDN support
 */
export const LazyImage: React.FC<{
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  className?: string;
  placeholder?: string;
}> = ({ src, alt, width, height, quality = 80, className = '', placeholder }) => {
  const { getResponsiveImageUrl, getAssetUrl } = useCDN();
  
  const optimizedSrc = width 
    ? getResponsiveImageUrl(src, width, quality)
    : getAssetUrl(src);

  const placeholderSrc = placeholder 
    ? getAssetUrl(placeholder)
    : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=';

  return React.createElement('img', {
    'data-src': optimizedSrc,
    src: placeholderSrc,
    alt: alt,
    width: width,
    height: height,
    className: `lazy ${className}`,
    loading: 'lazy',
    style: {
      transition: 'opacity 0.3s ease',
    }
  });
};

export default cdnManager;