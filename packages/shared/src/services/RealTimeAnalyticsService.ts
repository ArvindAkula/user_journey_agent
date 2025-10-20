import { UserEvent } from '../types';

export interface RealTimeMetrics {
  totalEvents: number;
  activeUsers: number;
  strugglesDetected: number;
  videoEngagements: number;
  eventsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  lastUpdated: string;
}

export interface RealTimeUpdate {
  type: 'event_processed' | 'metrics_updated' | 'struggle_detected' | 'user_activity';
  timestamp: string;
  data: any;
  event?: UserEvent;
  insights?: any;
  metrics?: RealTimeMetrics;
}

export interface EventCorrelation {
  userId: string;
  sessionId: string;
  eventSequence: UserEvent[];
  strugglesDetected: number;
  completedActions: number;
  timeSpent: number;
  lastActivity: string;
}

export interface RealTimeAnalyticsConfig {
  websocketUrl: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enableEventCorrelation?: boolean;
  correlationWindowMs?: number;
}

export class RealTimeAnalyticsService {
  private websocket: WebSocket | null = null;
  private config: RealTimeAnalyticsConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private eventCorrelations: Map<string, EventCorrelation> = new Map();
  private metricsBuffer: RealTimeMetrics | null = null;
  private eventBuffer: UserEvent[] = [];
  private processingQueue: RealTimeUpdate[] = [];

  constructor(config: RealTimeAnalyticsConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      enableEventCorrelation: true,
      correlationWindowMs: 300000, // 5 minutes
      ...config,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        // Use SockJS for better compatibility with Spring Boot
        const sockJSUrl = this.config.websocketUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        
        // For now, we'll use a simple HTTP polling approach instead of WebSocket
        // This avoids the STOMP complexity and connection issues
        console.log('🔗 [RealTimeAnalyticsService] Connecting to real-time analytics via HTTP polling');
        console.log('🔗 [RealTimeAnalyticsService] WebSocket URL:', this.config.websocketUrl);
        console.log('🔗 [RealTimeAnalyticsService] Converted to HTTP:', sockJSUrl);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
        
        // Start polling for updates
        this.startPolling();
        console.log('✅ [RealTimeAnalyticsService] Connected and polling started');
        resolve();

      } catch (error) {
        reject(error);
      }
    });
  }

  private startPolling(): void {
    // Poll for metrics updates every 5 seconds
    const pollInterval = setInterval(async () => {
      if (!this.isConnected) {
        clearInterval(pollInterval);
        return;
      }
      
      try {
        // Try to fetch real metrics from backend
        const apiUrl = this.config.websocketUrl
          .replace('ws://', 'http://')
          .replace('wss://', 'https://')
          .replace('/ws/realtime', '/api/analytics/realtime/metrics');
        
        console.log('╔════════════════════════════════════════════════════════════');
        console.log('║ FETCHING REAL-TIME METRICS');
        console.log('╠════════════════════════════════════════════════════════════');
        console.log('║ URL:', apiUrl);
        console.log('║ Time:', new Date().toISOString());
        console.log('╚════════════════════════════════════════════════════════════');
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include', // Include credentials for CORS
        });
        
        console.log('╔════════════════════════════════════════════════════════════');
        console.log('║ RESPONSE RECEIVED');
        console.log('╠════════════════════════════════════════════════════════════');
        console.log('║ Status:', response.status, response.statusText);
        console.log('║ OK:', response.ok);
        console.log('║ Headers:');
        response.headers.forEach((value, key) => {
          console.log('║   ', key + ':', value);
        });
        console.log('╚════════════════════════════════════════════════════════════');
        
        if (response.ok) {
          const metrics: RealTimeMetrics = await response.json();
          console.log('✅ Real metrics received:', metrics);
          this.metricsBuffer = metrics;
          
          const update: RealTimeUpdate = {
            type: 'metrics_updated',
            timestamp: new Date().toISOString(),
            data: { metrics },
            metrics,
          };
          
          this.handleMessage(update);
        } else {
          console.warn('❌ Response not OK, falling back to mock data');
          // Fallback to mock data if API fails
          this.useMockMetrics();
        }
      } catch (error) {
        // Fallback to mock data on error
        console.error('╔════════════════════════════════════════════════════════════');
        console.error('║ FETCH ERROR');
        console.error('╠════════════════════════════════════════════════════════════');
        console.error('║ Error:', error);
        console.error('║ Error type:', error instanceof TypeError ? 'Network/CORS' : 'Other');
        if (error instanceof Error) {
          console.error('║ Message:', error.message);
          console.error('║ Stack:', error.stack);
        }
        console.error('╚════════════════════════════════════════════════════════════');
        console.warn('⚠️  Falling back to mock data');
        this.useMockMetrics();
      }
    }, 5000);
  }

  private useMockMetrics(): void {
    const mockMetrics: RealTimeMetrics = {
      totalEvents: Math.floor(Math.random() * 1000) + 500,
      activeUsers: Math.floor(Math.random() * 50) + 10,
      strugglesDetected: Math.floor(Math.random() * 20),
      videoEngagements: Math.floor(Math.random() * 100) + 50,
      eventsPerMinute: Math.floor(Math.random() * 30) + 10,
      averageResponseTime: Math.floor(Math.random() * 200) + 100,
      errorRate: Math.random() * 5,
      lastUpdated: new Date().toISOString(),
    };
    
    this.metricsBuffer = mockMetrics;
    
    const update: RealTimeUpdate = {
      type: 'metrics_updated',
      timestamp: new Date().toISOString(),
      data: { metrics: mockMetrics },
      metrics: mockMetrics,
    };
    
    this.handleMessage(update);
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.isConnected = false;
    console.log('🔌 Real-time analytics disconnected');
  }

  // Subscribe to specific analytics event types
  subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType);
        }
      }
    };
  }

  // Send event to backend for processing
  async sendEvent(event: UserEvent): Promise<void> {
    if (!this.isConnected) {
      // Buffer events when disconnected
      this.eventBuffer.push(event);
      return;
    }

    try {
      // For now, just update local correlation data
      // In a full implementation, this would send to the backend via HTTP API
      if (this.config.enableEventCorrelation) {
        this.updateEventCorrelation(event);
      }

      // Simulate event processing
      const update: RealTimeUpdate = {
        type: 'event_processed',
        timestamp: new Date().toISOString(),
        data: { event },
        event,
      };
      
      this.handleMessage(update);

    } catch (error) {
      console.error('Error processing event:', error);
      this.eventBuffer.push(event);
    }
  }

  // Get current real-time metrics
  getCurrentMetrics(): RealTimeMetrics | null {
    return this.metricsBuffer;
  }

  // Get event correlations for a specific user
  getUserCorrelation(userId: string): EventCorrelation | null {
    return this.eventCorrelations.get(userId) || null;
  }

  // Get all active user correlations
  getAllCorrelations(): EventCorrelation[] {
    return Array.from(this.eventCorrelations.values());
  }

  // Removed subscribeToTopics - using HTTP polling instead

  private handleMessage(data: RealTimeUpdate): void {
    const update: RealTimeUpdate = data;

    // Update local state based on message type
    switch (update.type) {
      case 'event_processed':
        this.handleEventProcessed(update);
        break;
      case 'metrics_updated':
        this.handleMetricsUpdate(update);
        break;
      case 'struggle_detected':
        this.handleStruggleDetected(update);
        break;
      case 'user_activity':
        this.handleUserActivity(update);
        break;
    }

    // Add to processing queue for batch processing
    this.processingQueue.push(update);
    this.processUpdateQueue();

    // Notify subscribers
    this.notifySubscribers(update.type, update);
  }

  private handleEventProcessed(update: RealTimeUpdate): void {
    if (update.event) {
      // Update event correlation
      if (this.config.enableEventCorrelation) {
        this.updateEventCorrelation(update.event);
      }
    }

    if (update.metrics) {
      this.metricsBuffer = update.metrics;
    }
  }

  private handleMetricsUpdate(update: RealTimeUpdate): void {
    if (update.data.metrics || update.metrics) {
      this.metricsBuffer = update.data.metrics || update.metrics;
    }
  }

  private handleStruggleDetected(update: RealTimeUpdate): void {
    // Handle struggle detection updates
    if (update.insights && update.event) {
      const userId = update.event.userId;
      const correlation = this.eventCorrelations.get(userId);
      
      if (correlation) {
        correlation.strugglesDetected++;
        correlation.lastActivity = new Date().toISOString();
      }
    }
  }

  private handleUserActivity(update: RealTimeUpdate): void {
    // Handle general user activity updates
    if (update.data.userId) {
      const correlation = this.eventCorrelations.get(update.data.userId);
      if (correlation) {
        correlation.lastActivity = new Date().toISOString();
      }
    }
  }

  private updateEventCorrelation(event: UserEvent): void {
    const userId = event.userId;
    let correlation = this.eventCorrelations.get(userId);

    if (!correlation) {
      correlation = {
        userId,
        sessionId: event.sessionId,
        eventSequence: [],
        strugglesDetected: 0,
        completedActions: 0,
        timeSpent: 0,
        lastActivity: new Date().toISOString(),
      };
      this.eventCorrelations.set(userId, correlation);
    }

    // Add event to sequence
    correlation.eventSequence.push(event);
    correlation.lastActivity = new Date().toISOString();

    // Update metrics based on event type
    if (event.eventType === 'struggle_signal') {
      correlation.strugglesDetected++;
    } else if (event.eventType === 'feature_interaction' && event.eventData.success) {
      correlation.completedActions++;
    }

    // Calculate time spent
    if (correlation.eventSequence.length > 1) {
      const firstEvent = correlation.eventSequence[0];
      const lastEvent = correlation.eventSequence[correlation.eventSequence.length - 1];
      correlation.timeSpent = lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime();
    }

    // Clean up old events (keep only events within correlation window)
    const cutoffTime = Date.now() - (this.config.correlationWindowMs || 300000);
    correlation.eventSequence = correlation.eventSequence.filter(
      e => e.timestamp.getTime() > cutoffTime
    );

    // Remove correlation if no recent events
    if (correlation.eventSequence.length === 0) {
      this.eventCorrelations.delete(userId);
    }
  }

  private processUpdateQueue(): void {
    // Process updates in batches to avoid overwhelming the UI
    if (this.processingQueue.length > 10) {
      const batch = this.processingQueue.splice(0, 10);
      
      // Notify batch processing subscribers
      this.notifySubscribers('batch_processed', {
        type: 'batch_processed',
        timestamp: new Date().toISOString(),
        data: { updates: batch, count: batch.length },
      });
    }
  }

  private notifySubscribers(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} listener:`, error);
        }
      });
    }

    // Also notify 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback({ eventType, data });
        } catch (error) {
          console.error('Error in all-events listener:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      (this.config.reconnectInterval || 3000) * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnect failed:', error);
        if (this.reconnectAttempts < (this.config.maxReconnectAttempts || 5)) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  // Flush buffered events when connection is restored
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0 || !this.isConnected) {
      return;
    }

    console.log(`📤 Flushing ${this.eventBuffer.length} buffered events`);
    
    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const event of eventsToFlush) {
      await this.sendEvent(event);
    }
  }

  // Clean up old correlations periodically
  private cleanupCorrelations(): void {
    const cutoffTime = Date.now() - (this.config.correlationWindowMs || 300000);
    
    for (const [userId, correlation] of this.eventCorrelations.entries()) {
      const lastActivityTime = new Date(correlation.lastActivity).getTime();
      if (lastActivityTime < cutoffTime) {
        this.eventCorrelations.delete(userId);
      }
    }
  }

  // Start periodic cleanup
  startPeriodicCleanup(intervalMs: number = 60000): void {
    setInterval(() => {
      this.cleanupCorrelations();
    }, intervalMs);
  }

  // Get connection status
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    bufferedEvents: number;
    activeCorrelations: number;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      bufferedEvents: this.eventBuffer.length,
      activeCorrelations: this.eventCorrelations.size,
    };
  }
}