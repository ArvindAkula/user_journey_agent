import axios, { AxiosInstance } from 'axios';
import { UserEvent } from '../types';
import { validateUserEvent } from '../utils/eventValidator';

export interface EventServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableOfflineQueue?: boolean;
  maxOfflineEvents?: number;
}

export class EventService {
  private apiClient: AxiosInstance;
  private eventQueue: UserEvent[] = [];
  private offlineQueue: UserEvent[] = [];
  private batchSize: number;
  private flushInterval: number;
  private maxRetries: number;
  private retryDelay: number;
  private enableOfflineQueue: boolean;
  private maxOfflineEvents: number;
  private flushTimer?: NodeJS.Timeout;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private retryAttempts: Map<string, number> = new Map();
  private eventBuffer: Map<string, UserEvent> = new Map(); // Deduplication buffer
  private lastFlushTime: number = Date.now();
  private eventStats: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    offlineEvents: number;
  } = {
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    offlineEvents: 0
  };

  constructor(config: EventServiceConfig) {
    console.log('[EventService] Constructor called - Version: 2.0 with device truncation');
    this.apiClient = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 5000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.batchSize = config.batchSize || 10;
    this.flushInterval = config.flushInterval || 5000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.enableOfflineQueue = config.enableOfflineQueue ?? true;
    this.maxOfflineEvents = config.maxOfflineEvents || 1000;

    this.setupNetworkListeners();
    this.loadOfflineQueue();
    this.startFlushTimer();
  }

  async trackEvent(event: Omit<UserEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const fullEvent: UserEvent = {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date(),
    };

    // Validate event before queuing
    const validationErrors = validateUserEvent(fullEvent);
    if (validationErrors.length > 0) {
      console.warn('Event validation failed:', validationErrors);
      this.eventStats.failedEvents++;
      return;
    }

    // Check for duplicate events (deduplication)
    const eventKey = this.generateEventKey(fullEvent);
    if (this.eventBuffer.has(eventKey)) {
      console.debug('Duplicate event detected, skipping:', eventKey);
      return;
    }

    // Add to deduplication buffer with TTL
    this.eventBuffer.set(eventKey, fullEvent);
    setTimeout(() => this.eventBuffer.delete(eventKey), 30000); // 30 second TTL

    this.eventStats.totalEvents++;

    // Add to appropriate queue based on network status
    if (this.isOnline) {
      this.eventQueue.push(fullEvent);
      
      // Smart batching - flush immediately for critical events or when batch is full
      const isCriticalEvent = fullEvent.eventType === 'error_event' || fullEvent.eventType === 'struggle_signal';
      if (isCriticalEvent || this.eventQueue.length >= this.batchSize) {
        await this.flush();
      }
    } else if (this.enableOfflineQueue) {
      this.addToOfflineQueue(fullEvent);
      this.eventStats.offlineEvents++;
    }
  }

  async trackPageView(userId: string, sessionId: string, page: string, context?: any): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'page_view',
      eventData: {
        feature: page,
        ...context,
      },
      userContext: context?.userContext || this.getDefaultUserContext(),
      deviceInfo: context?.deviceInfo || this.getDefaultDeviceInfo(),
    });
  }

  async trackFeatureInteraction(
    userId: string, 
    sessionId: string, 
    feature: string, 
    success: boolean, 
    context?: any
  ): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'feature_interaction',
      eventData: {
        feature,
        success,
        attemptCount: context?.attemptCount || 1,
        duration: context?.duration,
        errorMessage: context?.errorMessage,
      },
      userContext: context?.userContext || this.getDefaultUserContext(),
      deviceInfo: context?.deviceInfo || this.getDefaultDeviceInfo(),
    });
  }

  async trackVideoEngagement(
    userId: string, 
    sessionId: string, 
    videoId: string, 
    engagementData: any
  ): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'video_engagement',
      eventData: {
        videoId,
        ...engagementData,
      },
      userContext: engagementData.userContext || this.getDefaultUserContext(),
      deviceInfo: engagementData.deviceInfo || this.getDefaultDeviceInfo(),
    });
  }

  async trackStruggleSignal(
    userId: string, 
    sessionId: string, 
    feature: string, 
    signalData: any
  ): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'struggle_signal',
      eventData: {
        feature,
        attemptCount: signalData.attemptCount,
        duration: signalData.duration,
        errorMessage: signalData.errorMessage,
      },
      userContext: signalData.userContext || this.getDefaultUserContext(),
      deviceInfo: signalData.deviceInfo || this.getDefaultDeviceInfo(),
    });
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEventsWithRetry(eventsToSend);
      this.eventStats.successfulEvents += eventsToSend.length;
      this.lastFlushTime = Date.now();
    } catch (error) {
      console.error('Error sending events after retries:', error);
      this.eventStats.failedEvents += eventsToSend.length;
      
      // Move failed events to offline queue if enabled
      if (this.enableOfflineQueue) {
        eventsToSend.forEach(event => this.addToOfflineQueue(event));
      } else {
        // Re-queue events for next flush attempt
        this.eventQueue.unshift(...eventsToSend);
      }
    }
  }

  private async sendEventsWithRetry(events: UserEvent[]): Promise<void> {
    const batchId = this.generateEventId();
    let lastError: Error | null = null;

    // Convert Date objects to epoch milliseconds for backend compatibility
    const eventsWithEpochTimestamps = events.map(event => ({
      ...event,
      timestamp: event.timestamp instanceof Date ? event.timestamp.getTime() : event.timestamp
    }));

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log('[EventService] Sending batch:', {
          endpoint: '/events/track/batch',
          baseURL: this.apiClient.defaults.baseURL,
          fullURL: `${this.apiClient.defaults.baseURL}/events/track/batch`,
          eventCount: eventsWithEpochTimestamps.length,
          batchId,
          sampleEvent: eventsWithEpochTimestamps[0]
        });
        
        await this.apiClient.post('/events/track/batch', {
          events: eventsWithEpochTimestamps,
          batchId,
          timestamp: new Date().toISOString()
        });
        
        console.log('[EventService] Batch sent successfully');
        
        // Clear retry count on success
        this.retryAttempts.delete(batchId);
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Event batch send attempt ${attempt}/${this.maxRetries} failed:`, error);
        
        // Don't retry on client errors (4xx)
        if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 400 && error.response.status < 500) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }

    this.retryAttempts.set(batchId, this.maxRetries);
    throw lastError || new Error('Max retries exceeded');
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processOfflineQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  private addToOfflineQueue(event: UserEvent): void {
    // Prevent queue from growing too large
    if (this.offlineQueue.length >= this.maxOfflineEvents) {
      // Remove oldest events to make room
      this.offlineQueue.shift();
    }

    this.offlineQueue.push(event);
    this.saveOfflineQueue();
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    console.log(`Processing ${this.offlineQueue.length} offline events`);
    
    // Move offline events to main queue for processing
    const offlineEvents = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueue();

    // Add events to main queue in batches
    for (const event of offlineEvents) {
      this.eventQueue.push(event);
      
      if (this.eventQueue.length >= this.batchSize) {
        await this.flush();
      }
    }

    // Flush any remaining events
    if (this.eventQueue.length > 0) {
      await this.flush();
    }
  }

  private loadOfflineQueue(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('eventService_offlineQueue');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.offlineQueue = parsed.map((event: any) => ({
            ...event,
            timestamp: new Date(event.timestamp)
          }));
        }
      } catch (error) {
        console.warn('Failed to load offline queue:', error);
        this.offlineQueue = [];
      }
    }
  }

  private saveOfflineQueue(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('eventService_offlineQueue', JSON.stringify(this.offlineQueue));
      } catch (error) {
        console.warn('Failed to save offline queue:', error);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventKey(event: UserEvent): string {
    // Create a unique key for deduplication based on critical event properties
    return `${event.userId}-${event.eventType}-${event.eventData.feature || event.eventData.videoId || event.eventData.action}-${Math.floor(event.timestamp.getTime() / 1000)}`;
  }

  private getDefaultDeviceInfo() {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    
    console.log('[EventService] Device Info:', {
      userAgentLength: userAgent.length,
      deviceModel: userAgent
    });
    
    return {
      platform: 'Web' as const,
      appVersion: '1.0.0',
      deviceModel: userAgent,
    };
  }

  private getDefaultUserContext() {
    return {
      deviceType: 'desktop',
      browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(0, 2).join(' ') : 'Unknown',
      userSegment: 'default',
      sessionStage: 'active',
      previousActions: [] as string[],
    };
  }

  // Enhanced tracking methods
  async trackUserAction(userId: string, sessionId: string, action: string, actionData?: any): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'user_action',
      eventData: {
        action,
        ...actionData,
      },
      userContext: actionData?.userContext || this.getDefaultUserContext(),
      deviceInfo: actionData?.deviceInfo || this.getDefaultDeviceInfo(),
    });
  }

  async trackError(userId: string, sessionId: string, error: Error | string, context?: any): Promise<void> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined;

    await this.trackEvent({
      userId,
      sessionId,
      eventType: 'error_event',
      eventData: {
        errorMessage,
        errorStack,
        ...context,
      },
      userContext: context?.userContext || this.getDefaultUserContext(),
      deviceInfo: context?.deviceInfo || this.getDefaultDeviceInfo(),
    });
  }

  // Analytics and monitoring methods
  getEventStats() {
    return {
      ...this.eventStats,
      queueSize: this.eventQueue.length,
      offlineQueueSize: this.offlineQueue.length,
      isOnline: this.isOnline,
      lastFlushTime: this.lastFlushTime,
    };
  }

  clearEventStats(): void {
    this.eventStats = {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      offlineEvents: 0,
    };
  }

  // Force flush all queued events
  async forceFlush(): Promise<void> {
    await this.flush();
    if (this.offlineQueue.length > 0) {
      await this.processOfflineQueue();
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}