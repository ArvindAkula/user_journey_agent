/**
 * API endpoint constants
 * Centralized endpoint definitions to prevent URL construction errors
 * 
 * NOTE: These paths assume baseURL is 'http://localhost:8080' (no /api suffix)
 * All paths include the full route from root: /api/analytics/...
 */

// Base paths
export const API_BASE = '/api';
export const ANALYTICS_BASE = '/api/analytics';
export const AUTH_BASE = '/api/auth';
export const EVENTS_BASE = '/api/events';

// Analytics endpoints (full paths from root)
export const ANALYTICS_ENDPOINTS = {
  USER_JOURNEY: `${ANALYTICS_BASE}/user-journey`,
  VIDEO_ENGAGEMENT: `${ANALYTICS_BASE}/video-engagement`,
  STRUGGLE_SIGNALS: `${ANALYTICS_BASE}/struggle-signals`,
  USER_SEGMENTS: `${ANALYTICS_BASE}/user-segments`,
  TIME_SERIES: `${ANALYTICS_BASE}/time-series`,
  DASHBOARD: `${ANALYTICS_BASE}/dashboard`,
  EXPORT: `${ANALYTICS_BASE}/export`,
} as const;

// Auth endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: `${AUTH_BASE}/login`,
  LOGOUT: `${AUTH_BASE}/logout`,
  REFRESH: `${AUTH_BASE}/refresh`,
  ANALYTICS_LOGIN: `${AUTH_BASE}/analytics/login`,
} as const;

// Event endpoints
export const EVENT_ENDPOINTS = {
  TRACK: `${EVENTS_BASE}/track`,
  CONTEXT: `${EVENTS_BASE}/context`,
} as const;

/**
 * Safely join URL path segments, removing duplicate slashes
 * @param segments - Path segments to join
 * @returns Normalized path
 */
export const joinPath = (...segments: string[]): string => {
  return segments
    .join('/')
    .replace(/\/{2,}/g, '/') // Remove duplicate slashes
    .replace(/\/$/, ''); // Remove trailing slash
};

/**
 * Build full URL with base and path
 * @param base - Base URL
 * @param path - Path to append
 * @returns Full URL
 */
export const buildUrl = (base: string, path: string): string => {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};
