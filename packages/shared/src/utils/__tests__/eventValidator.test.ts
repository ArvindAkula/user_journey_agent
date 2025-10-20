import { validateEvent, validateEventBatch, isValidEventType } from '../eventValidator';
import { UserEvent } from '../../types/UserEvent';

describe('Event Validator', () => {
  const validEvent: UserEvent = {
    eventId: 'event123',
    userId: 'user123',
    sessionId: 'session123',
    eventType: 'page_view',
    timestamp: new Date('2023-01-15T10:00:00Z'),
    eventData: {
      feature: 'calculator',
      attemptCount: 1,
      duration: 30,
      success: true
    },
    userContext: {
      deviceType: 'desktop',
      browserInfo: 'Chrome 91.0',
      location: 'US',
      persona: 'beginner'
    }
  };

  describe('validateEvent', () => {
    it('validates a correct event', () => {
      const result = validateEvent(validEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects event with missing eventId', () => {
      const invalidEvent = { ...validEvent, eventId: '' };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('eventId is required');
    });

    it('rejects event with missing userId', () => {
      const invalidEvent = { ...validEvent, userId: '' };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('userId is required');
    });

    it('rejects event with missing sessionId', () => {
      const invalidEvent = { ...validEvent, sessionId: '' };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sessionId is required');
    });

    it('rejects event with invalid eventType', () => {
      const invalidEvent = { ...validEvent, eventType: 'invalid_type' as any };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('eventType must be one of: page_view, feature_interaction, video_engagement, struggle_signal');
    });

    it('rejects event with invalid timestamp', () => {
      const invalidEvent = { ...validEvent, timestamp: 'invalid-date' as any };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('timestamp must be a valid Date');
    });

    it('rejects event with future timestamp', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day in future
      const invalidEvent = { ...validEvent, timestamp: futureDate };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('timestamp cannot be in the future');
    });

    it('rejects event with missing userContext', () => {
      const invalidEvent = { ...validEvent, userContext: undefined as any };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('userContext is required');
    });

    it('rejects event with missing deviceType in userContext', () => {
      const invalidEvent = {
        ...validEvent,
        userContext: { ...validEvent.userContext, deviceType: '' }
      };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('userContext.deviceType is required');
    });

    it('rejects event with missing browserInfo in userContext', () => {
      const invalidEvent = {
        ...validEvent,
        userContext: { ...validEvent.userContext, browserInfo: '' }
      };
      const result = validateEvent(invalidEvent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('userContext.browserInfo is required');
    });

    it('validates event with minimal required fields', () => {
      const minimalEvent: UserEvent = {
        eventId: 'event123',
        userId: 'user123',
        sessionId: 'session123',
        eventType: 'page_view',
        timestamp: new Date(),
        eventData: {},
        userContext: {
          deviceType: 'desktop',
          browserInfo: 'Chrome 91.0'
        }
      };
      
      const result = validateEvent(minimalEvent);
      expect(result.isValid).toBe(true);
    });

    it('validates eventData fields when present', () => {
      const eventWithInvalidData = {
        ...validEvent,
        eventData: {
          ...validEvent.eventData,
          attemptCount: -1, // Invalid negative attempt count
          duration: -5 // Invalid negative duration
        }
      };
      
      const result = validateEvent(eventWithInvalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('eventData.attemptCount must be a positive number');
      expect(result.errors).toContain('eventData.duration must be a positive number');
    });

    it('validates struggle signal specific fields', () => {
      const struggleEvent: UserEvent = {
        ...validEvent,
        eventType: 'struggle_signal',
        eventData: {
          feature: 'calculator',
          attemptCount: 5,
          errorMessage: 'Calculation failed'
        }
      };
      
      const result = validateEvent(struggleEvent);
      expect(result.isValid).toBe(true);
    });

    it('validates video engagement specific fields', () => {
      const videoEvent: UserEvent = {
        ...validEvent,
        eventType: 'video_engagement',
        eventData: {
          feature: 'video_library',
          duration: 120,
          success: true
        }
      };
      
      const result = validateEvent(videoEvent);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateEventBatch', () => {
    it('validates a batch of correct events', () => {
      const events = [validEvent, { ...validEvent, eventId: 'event456' }];
      const result = validateEventBatch(events);
      
      expect(result.isValid).toBe(true);
      expect(result.validEvents).toHaveLength(2);
      expect(result.invalidEvents).toHaveLength(0);
    });

    it('separates valid and invalid events', () => {
      const invalidEvent = { ...validEvent, eventId: '' };
      const events = [validEvent, invalidEvent];
      const result = validateEventBatch(events);
      
      expect(result.isValid).toBe(false);
      expect(result.validEvents).toHaveLength(1);
      expect(result.invalidEvents).toHaveLength(1);
      expect(result.invalidEvents[0].event).toEqual(invalidEvent);
    });

    it('handles empty batch', () => {
      const result = validateEventBatch([]);
      
      expect(result.isValid).toBe(true);
      expect(result.validEvents).toHaveLength(0);
      expect(result.invalidEvents).toHaveLength(0);
    });

    it('validates maximum batch size', () => {
      const events = Array(101).fill(validEvent); // Exceed max batch size of 100
      const result = validateEventBatch(events);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch size cannot exceed 100 events');
    });

    it('checks for duplicate event IDs in batch', () => {
      const events = [validEvent, validEvent]; // Same event ID
      const result = validateEventBatch(events);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate event IDs found in batch');
    });
  });

  describe('isValidEventType', () => {
    it('returns true for valid event types', () => {
      expect(isValidEventType('page_view')).toBe(true);
      expect(isValidEventType('feature_interaction')).toBe(true);
      expect(isValidEventType('video_engagement')).toBe(true);
      expect(isValidEventType('struggle_signal')).toBe(true);
    });

    it('returns false for invalid event types', () => {
      expect(isValidEventType('invalid_type')).toBe(false);
      expect(isValidEventType('')).toBe(false);
      expect(isValidEventType(null as any)).toBe(false);
      expect(isValidEventType(undefined as any)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles null event', () => {
      const result = validateEvent(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event cannot be null or undefined');
    });

    it('handles undefined event', () => {
      const result = validateEvent(undefined as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event cannot be null or undefined');
    });

    it('handles event with extra properties', () => {
      const eventWithExtra = {
        ...validEvent,
        extraProperty: 'should be ignored'
      };
      
      const result = validateEvent(eventWithExtra as any);
      expect(result.isValid).toBe(true); // Extra properties are allowed
    });

    it('validates very old timestamps', () => {
      const oldDate = new Date('2020-01-01');
      const eventWithOldDate = { ...validEvent, timestamp: oldDate };
      const result = validateEvent(eventWithOldDate);
      
      expect(result.isValid).toBe(true); // Old dates are allowed
    });
  });
});