import { UserEvent } from '../types';

export const validateUserEvent = (event: Partial<UserEvent>): string[] => {
  const errors: string[] = [];

  // Required field validation
  if (!event.userId || typeof event.userId !== 'string' || event.userId.trim().length === 0) {
    errors.push('userId is required and must be a non-empty string');
  }

  if (!event.sessionId || typeof event.sessionId !== 'string' || event.sessionId.trim().length === 0) {
    errors.push('sessionId is required and must be a non-empty string');
  }

  if (!event.eventId || typeof event.eventId !== 'string' || event.eventId.trim().length === 0) {
    errors.push('eventId is required and must be a non-empty string');
  }

  if (!event.timestamp || !(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
    errors.push('timestamp is required and must be a valid Date');
  }

  // Event type validation
  const validEventTypes = ['page_view', 'feature_interaction', 'video_engagement', 'struggle_signal', 'user_action', 'error_event'];
  if (!event.eventType) {
    errors.push('eventType is required');
  } else if (!validEventTypes.includes(event.eventType)) {
    errors.push(`eventType must be one of: ${validEventTypes.join(', ')}`);
  }

  // Event data validation
  if (!event.eventData || typeof event.eventData !== 'object') {
    errors.push('eventData is required and must be an object');
  } else {
    // Event type specific validation
    switch (event.eventType) {
      case 'page_view':
        if (!event.eventData.feature || typeof event.eventData.feature !== 'string') {
          errors.push('eventData.feature is required for page_view events');
        }
        break;
      
      case 'feature_interaction':
        if (!event.eventData.feature || typeof event.eventData.feature !== 'string') {
          errors.push('eventData.feature is required for feature_interaction events');
        }
        if (typeof event.eventData.success !== 'boolean') {
          errors.push('eventData.success is required and must be a boolean for feature_interaction events');
        }
        if (event.eventData.attemptCount !== undefined && (typeof event.eventData.attemptCount !== 'number' || event.eventData.attemptCount < 1)) {
          errors.push('eventData.attemptCount must be a positive number if provided');
        }
        break;
      
      case 'video_engagement':
        if (!event.eventData.videoId || typeof event.eventData.videoId !== 'string') {
          errors.push('eventData.videoId is required for video_engagement events');
        }
        if (event.eventData.duration !== undefined && (typeof event.eventData.duration !== 'number' || event.eventData.duration < 0)) {
          errors.push('eventData.duration must be a non-negative number if provided');
        }
        if (event.eventData.completionRate !== undefined && (typeof event.eventData.completionRate !== 'number' || event.eventData.completionRate < 0 || event.eventData.completionRate > 100)) {
          errors.push('eventData.completionRate must be a number between 0 and 100 if provided');
        }
        break;
      
      case 'struggle_signal':
        if (!event.eventData.feature || typeof event.eventData.feature !== 'string') {
          errors.push('eventData.feature is required for struggle_signal events');
        }
        if (!event.eventData.attemptCount || typeof event.eventData.attemptCount !== 'number' || event.eventData.attemptCount < 1) {
          errors.push('eventData.attemptCount is required and must be a positive number for struggle_signal events');
        }
        break;
    }
  }

  // User context validation
  if (!event.userContext || typeof event.userContext !== 'object') {
    errors.push('userContext is required and must be an object');
  } else {
    if (event.userContext.deviceType && typeof event.userContext.deviceType !== 'string') {
      errors.push('userContext.deviceType must be a string if provided');
    }
    if (event.userContext.browserInfo && typeof event.userContext.browserInfo !== 'string') {
      errors.push('userContext.browserInfo must be a string if provided');
    }
    if (event.userContext.persona && typeof event.userContext.persona !== 'string') {
      errors.push('userContext.persona must be a string if provided');
    }
  }

  // Device info validation
  if (!event.deviceInfo || typeof event.deviceInfo !== 'object') {
    errors.push('deviceInfo is required and must be an object');
  } else {
    if (!event.deviceInfo.platform || typeof event.deviceInfo.platform !== 'string') {
      errors.push('deviceInfo.platform is required and must be a string');
    }
    if (event.deviceInfo.appVersion && typeof event.deviceInfo.appVersion !== 'string') {
      errors.push('deviceInfo.appVersion must be a string if provided');
    }
  }

  // Timestamp validation (not too old or in the future)
  if (event.timestamp instanceof Date) {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const maxFuture = 5 * 60 * 1000; // 5 minutes
    
    if (event.timestamp.getTime() < now.getTime() - maxAge) {
      errors.push('timestamp is too old (more than 24 hours)');
    }
    
    if (event.timestamp.getTime() > now.getTime() + maxFuture) {
      errors.push('timestamp is too far in the future (more than 5 minutes)');
    }
  }

  return errors;
};

export const isValidUserEvent = (event: Partial<UserEvent>): event is UserEvent => {
  return validateUserEvent(event).length === 0;
};

export const sanitizeEventData = (eventData: any): any => {
  if (!eventData || typeof eventData !== 'object') {
    return {};
  }

  const sanitized = { ...eventData };

  // Remove potentially sensitive data
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'];
  sensitiveKeys.forEach(key => {
    if (key in sanitized) {
      delete sanitized[key];
    }
  });

  // Truncate long strings
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
      sanitized[key] = sanitized[key].substring(0, 1000) + '...';
    }
  });

  return sanitized;
};

export const enrichEventContext = (userContext: any, additionalContext?: any): any => {
  const enriched = {
    ...userContext,
    ...additionalContext,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    viewport: typeof window !== 'undefined' ? {
      width: window.innerWidth,
      height: window.innerHeight
    } : undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
    connectionType: typeof navigator !== 'undefined' && 'connection' in navigator 
      ? (navigator as any).connection?.effectiveType : undefined,
    onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    cookieEnabled: typeof navigator !== 'undefined' ? navigator.cookieEnabled : undefined,
    screenResolution: typeof screen !== 'undefined' ? {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    } : undefined,
  };

  return enriched;
};

// Enhanced validation for struggle detection
export const validateStruggleSignal = (eventData: any): string[] => {
  const errors: string[] = [];
  
  if (!eventData.feature || typeof eventData.feature !== 'string') {
    errors.push('Struggle signal must include a feature name');
  }
  
  if (!eventData.attemptCount || typeof eventData.attemptCount !== 'number' || eventData.attemptCount < 1) {
    errors.push('Struggle signal must include a valid attempt count');
  }
  
  if (eventData.attemptCount > 10) {
    errors.push('Attempt count seems unusually high, please verify');
  }
  
  return errors;
};

// Batch validation for multiple events
export const validateEventBatch = (events: Partial<UserEvent>[]): { valid: UserEvent[], invalid: Array<{ event: Partial<UserEvent>, errors: string[] }> } => {
  const valid: UserEvent[] = [];
  const invalid: Array<{ event: Partial<UserEvent>, errors: string[] }> = [];
  
  events.forEach(event => {
    const errors = validateUserEvent(event);
    if (errors.length === 0) {
      valid.push(event as UserEvent);
    } else {
      invalid.push({ event, errors });
    }
  });
  
  return { valid, invalid };
};

// Event rate limiting validation
export const validateEventRate = (events: UserEvent[], timeWindowMs: number = 60000, maxEvents: number = 100): boolean => {
  const now = Date.now();
  const recentEvents = events.filter(event => 
    now - event.timestamp.getTime() < timeWindowMs
  );
  
  return recentEvents.length <= maxEvents;
};