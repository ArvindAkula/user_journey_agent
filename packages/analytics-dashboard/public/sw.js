// Service Worker for Analytics Dashboard - Production Caching Strategy

const CACHE_NAME = 'analytics-dashboard-v1.0.0';
const STATIC_CACHE_NAME = 'analytics-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'analytics-dynamic-v1.0.0';
const CHART_CACHE_NAME = 'analytics-charts-v1.0.0';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/login',
  '/static/js/main.js',
  '/static/css/main.css',
  '/static/media/dashboard-logo.svg',
  '/manifest.json'
];

// Chart libraries and heavy assets
const CHART_ASSETS = [
  /\/static\/js\/recharts/,
  /\/static\/js\/d3/,
  /\/static\/js\/charts/
];

// API endpoints that can be cached (read-only data)
const CACHEABLE_API_PATTERNS = [
  /\/api\/analytics\/summary/,
  /\/api\/analytics\/historical/,
  /\/api\/user\/profile/
];

// Real-time endpoints that should never be cached
const NO_CACHE_PATTERNS = [
  /\/api\/analytics\/realtime/,
  /\/api\/auth/,
  /\/api\/websocket/
];

// CDN assets to cache
const CDN_CACHE_PATTERNS = [
  /https:\/\/cdn\.analytics\.example\.com/,
  /https:\/\/fonts\.googleapis\.com/,
  /https:\/\/fonts\.gstatic\.com/
];

self.addEventListener('install', (event) => {
  console.log('Analytics Dashboard Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME)
        .then((cache) => {
          console.log('Caching static assets...');
          return cache.addAll(STATIC_ASSETS);
        }),
      caches.open(CHART_CACHE_NAME)
        .then((cache) => {
          console.log('Preparing chart cache...');
          return cache;
        })
    ])
    .then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Analytics Dashboard Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CHART_CACHE_NAME &&
                cacheName.startsWith('analytics-')) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never cache real-time or auth endpoints
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(fetch(request));
    return;
  }

  // Handle static assets (cache-first)
  if (STATIC_ASSETS.some(asset => request.url.includes(asset)) ||
      request.url.includes('/static/')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          return response || fetch(request)
            .then((fetchResponse) => {
              if (fetchResponse.ok) {
                const responseClone = fetchResponse.clone();
                const cacheName = CHART_ASSETS.some(pattern => pattern.test(request.url)) 
                  ? CHART_CACHE_NAME 
                  : STATIC_CACHE_NAME;
                
                caches.open(cacheName)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return fetchResponse;
            });
        })
    );
    return;
  }

  // Handle CDN assets (cache-first with long TTL)
  if (CDN_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            // Check if cached response is still fresh (6 hours for dashboard assets)
            const cachedDate = new Date(response.headers.get('date'));
            const now = new Date();
            const hoursDiff = (now - cachedDate) / (1000 * 60 * 60);
            
            if (hoursDiff < 6) {
              return response;
            }
          }
          
          return fetch(request)
            .then((fetchResponse) => {
              if (fetchResponse.ok) {
                const responseClone = fetchResponse.clone();
                caches.open(STATIC_CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return fetchResponse;
            })
            .catch(() => {
              // Return cached version if network fails
              return response;
            });
        })
    );
    return;
  }

  // Handle cacheable API requests (network-first with short TTL)
  if (CACHEABLE_API_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                // Add timestamp to track freshness
                const headers = new Headers(responseClone.headers);
                headers.set('sw-cached-at', new Date().toISOString());
                
                const cachedResponse = new Response(responseClone.body, {
                  status: responseClone.status,
                  statusText: responseClone.statusText,
                  headers: headers
                });
                
                cache.put(request, cachedResponse);
              });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                // Check if cached data is still fresh (5 minutes for analytics data)
                const cachedAt = cachedResponse.headers.get('sw-cached-at');
                if (cachedAt) {
                  const cachedDate = new Date(cachedAt);
                  const now = new Date();
                  const minutesDiff = (now - cachedDate) / (1000 * 60);
                  
                  if (minutesDiff < 5) {
                    return cachedResponse;
                  }
                }
              }
              
              // Return stale data with warning header
              if (cachedResponse) {
                const headers = new Headers(cachedResponse.headers);
                headers.set('sw-cache-status', 'stale');
                
                return new Response(cachedResponse.body, {
                  status: cachedResponse.status,
                  statusText: cachedResponse.statusText,
                  headers: headers
                });
              }
              
              // Return offline response
              return new Response(
                JSON.stringify({ 
                  error: 'Network unavailable', 
                  offline: true,
                  message: 'Dashboard is offline. Some data may be outdated.'
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Handle navigation requests (network-first)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match('/') || caches.match('/login');
        })
    );
    return;
  }

  // Default: network-first for everything else
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle background sync for analytics data
self.addEventListener('sync', (event) => {
  if (event.tag === 'analytics-sync') {
    event.waitUntil(
      syncAnalyticsData()
    );
  }
});

// Handle push notifications for dashboard alerts
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    // Only show notifications for critical alerts
    if (data.severity === 'critical' || data.severity === 'high') {
      const options = {
        body: data.body,
        icon: '/static/images/dashboard-icon-192x192.png',
        badge: '/static/images/alert-badge-72x72.png',
        tag: data.tag || 'dashboard-alert',
        requireInteraction: data.severity === 'critical',
        actions: [
          {
            action: 'view-dashboard',
            title: 'View Dashboard'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ],
        data: {
          url: data.dashboardUrl || '/dashboard',
          alertId: data.alertId
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view-dashboard') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/dashboard')
    );
  } else if (event.action === 'dismiss') {
    // Mark alert as dismissed
    if (event.notification.data.alertId) {
      markAlertAsDismissed(event.notification.data.alertId);
    }
  } else {
    // Default click - open dashboard
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Utility functions
async function syncAnalyticsData() {
  try {
    // Sync any pending analytics data when back online
    const pendingData = await getPendingAnalyticsData();
    
    for (const data of pendingData) {
      try {
        await fetch('/api/analytics/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        await removePendingData(data.id);
      } catch (error) {
        console.log('Sync failed for data:', data.id);
      }
    }
  } catch (error) {
    console.error('Analytics sync failed:', error);
  }
}

async function getPendingAnalyticsData() {
  // Implementation would depend on how you store pending data
  return [];
}

async function removePendingData(id) {
  // Implementation would depend on how you store pending data
}

async function markAlertAsDismissed(alertId) {
  try {
    await fetch(`/api/alerts/${alertId}/dismiss`, {
      method: 'POST'
    });
  } catch (error) {
    console.error('Failed to dismiss alert:', error);
  }
}

// Periodic cache cleanup
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEANUP_CACHE') {
    event.waitUntil(
      cleanupOldCacheEntries()
    );
  }
});

async function cleanupOldCacheEntries() {
  const cacheNames = [DYNAMIC_CACHE_NAME, CHART_CACHE_NAME];
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const cachedAt = response.headers.get('sw-cached-at');
        if (cachedAt) {
          const cachedDate = new Date(cachedAt);
          const now = new Date();
          const hoursDiff = (now - cachedDate) / (1000 * 60 * 60);
          
          // Remove entries older than 24 hours
          if (hoursDiff > 24) {
            await cache.delete(request);
          }
        }
      }
    }
  }
}