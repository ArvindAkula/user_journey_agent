/**
 * Unit tests for Firebase Analytics Service
 * Tests event tracking methods, user property setting, and environment-specific configuration
 */

import { FirebaseAnalyticsService } from '../FirebaseAnalyticsService';
import { analytics } from '../../config/firebase';
import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';

// Mock Firebase Analytics
jest.mock('../../config/firebase', () => ({
  analytics: {}
}));

jest.mock('firebase/analytics', () => ({
  logEvent: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn()
}));

describe('FirebaseAnalyticsService', () => {
  let service: FirebaseAnalyticsService;
  const originalEnv = process.env;
  const originalConsole = console;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Reset singleton instance
    (FirebaseAnalyticsService as any).instance = undefined;
    service = FirebaseAnalyticsService.getInstance();
  });

  afterAll(() => {
    process.env = originalEnv;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('Initialization', () => {
    test('should create singleton instance', () => {
      const instance1 = FirebaseAnalyticsService.getInstance();
      const instance2 = FirebaseAnalyticsService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should initialize in development mode', () => {
      process.env.NODE_ENV = 'development';
      const devService = FirebaseAnalyticsService.getInstance();
      
      expect(devService.isAvailable()).toBe(true);
    });

    test('should initialize in production mode', () => {
      process.env.NODE_ENV = 'production';
      const prodService = FirebaseAnalyticsService.getInstance();
      
      expect(prodService.isAvailable()).toBe(true);
    });
  });

  describe('User ID Management', () => {
    test('should set user ID', () => {
      service.setUserId('test-user-123');
      
      expect(setUserId).toHaveBeenCalledWith(analytics, 'test-user-123');
    });

    test('should log user ID in development mode', () => {
      process.env.NODE_ENV = 'development';
      const devService = FirebaseAnalyticsService.getInstance();
      
      devService.setUserId('test-user-123');
      
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle errors when setting user ID', () => {
      (setUserId as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      service.setUserId('test-user-123');
      
      expect(console.error).toHaveBeenCalledWith('Error setting user ID:', expect.any(Error));
    });
  });

  describe('User Properties', () => {
    test('should set user properties', () => {
      const properties = {
        role: 'admin',
        subscription: 'premium'
      };
      
      service.setUserProperties(properties);
      
      expect(setUserProperties).toHaveBeenCalledWith(analytics, properties);
    });

    test('should log user properties in development mode', () => {
      process.env.NODE_ENV = 'development';
      const devService = FirebaseAnalyticsService.getInstance();
      
      const properties = { role: 'admin' };
      devService.setUserProperties(properties);
      
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle errors when setting user properties', () => {
      (setUserProperties as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      service.setUserProperties({ role: 'admin' });
      
      expect(console.error).toHaveBeenCalledWith('Error setting user properties:', expect.any(Error));
    });
  });

  describe('Page View Tracking', () => {
    test('should track page view', () => {
      service.trackPageView('Home Page');
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'page_view',
        expect.objectContaining({
          page_title: 'Home Page',
          timestamp: expect.any(Number)
        })
      );
    });

    test('should track page view with additional parameters', () => {
      service.trackPageView('Calculator', { section: 'mortgage' });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'page_view',
        expect.objectContaining({
          page_title: 'Calculator',
          section: 'mortgage',
          timestamp: expect.any(Number)
        })
      );
    });

    test('should handle errors when tracking page view', () => {
      (logEvent as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      service.trackPageView('Home Page');
      
      expect(console.error).toHaveBeenCalledWith('Error tracking page view:', expect.any(Error));
    });
  });

  describe('Calculator Event Tracking', () => {
    test('should track calculator interaction', () => {
      service.trackCalculatorEvent('calculate', {
        loanAmount: 300000,
        interestRate: 3.5,
        termYears: 30,
        monthlyPayment: 1347.13
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'calculator_interaction',
        expect.objectContaining({
          action: 'calculate',
          loan_amount: 300000,
          interest_rate: 3.5,
          term_years: 30,
          monthly_payment: 1347.13,
          calculation_type: 'mortgage',
          success: true,
          timestamp: expect.any(Number)
        })
      );
    });

    test('should track calculator error', () => {
      service.trackCalculatorEvent('calculate', {
        loanAmount: 300000,
        success: false,
        errorType: 'invalid_input'
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'calculator_interaction',
        expect.objectContaining({
          action: 'calculate',
          success: false,
          error_type: 'invalid_input'
        })
      );
    });

    test('should handle errors when tracking calculator event', () => {
      (logEvent as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      service.trackCalculatorEvent('calculate', { loanAmount: 300000 });
      
      expect(console.error).toHaveBeenCalledWith('Error tracking calculator event:', expect.any(Error));
    });
  });

  describe('Video Event Tracking', () => {
    test('should track video play event', () => {
      service.trackVideoEvent('play', 'video-123', {
        duration: 300,
        position: 0,
        videoTitle: 'Introduction Video'
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'video_engagement',
        expect.objectContaining({
          action: 'play',
          video_id: 'video-123',
          video_title: 'Introduction Video',
          video_duration: 300,
          video_position: 0,
          playback_speed: 1.0,
          timestamp: expect.any(Number)
        })
      );
    });

    test('should track video complete event', () => {
      service.trackVideoEvent('complete', 'video-123', {
        duration: 300,
        position: 300,
        completionRate: 100
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'video_engagement',
        expect.objectContaining({
          action: 'complete',
          video_id: 'video-123',
          completion_rate: 100
        })
      );
    });

    test('should track video seek event', () => {
      service.trackVideoEvent('seek', 'video-123', {
        position: 150
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'video_engagement',
        expect.objectContaining({
          action: 'seek',
          video_id: 'video-123',
          video_position: 150
        })
      );
    });

    test('should handle errors when tracking video event', () => {
      (logEvent as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      service.trackVideoEvent('play', 'video-123');
      
      expect(console.error).toHaveBeenCalledWith('Error tracking video event:', expect.any(Error));
    });
  });

  describe('Document Upload Tracking', () => {
    test('should track successful document upload', () => {
      service.trackDocumentUpload('pdf', {
        fileSize: 1024000,
        fileName: 'document.pdf',
        success: true
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'document_upload',
        expect.objectContaining({
          document_type: 'pdf',
          file_size: 1024000,
          file_name: 'document.pdf',
          success: true,
          timestamp: expect.any(Number)
        })
      );
    });

    test('should track failed document upload', () => {
      service.trackDocumentUpload('pdf', {
        success: false,
        errorType: 'file_too_large'
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'document_upload',
        expect.objectContaining({
          document_type: 'pdf',
          success: false,
          error_type: 'file_too_large'
        })
      );
    });
  });

  describe('Feature Interaction Tracking', () => {
    test('should track feature interaction', () => {
      service.trackFeatureInteraction('calculator', 'submit', {
        attemptCount: 1,
        success: true,
        timeSpent: 5000
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'feature_interaction',
        expect.objectContaining({
          feature_name: 'calculator',
          interaction_action: 'submit',
          attempt_count: 1,
          interaction_success: true,
          time_spent: 5000,
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Navigation Tracking', () => {
    test('should track navigation', () => {
      service.trackNavigation('/home', '/calculator');
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'navigation',
        expect.objectContaining({
          from_page: '/home',
          to_page: '/calculator',
          timestamp: expect.any(Number)
        })
      );
    });

    test('should track navigation with additional parameters', () => {
      service.trackNavigation('/home', '/calculator', { trigger: 'menu_click' });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'navigation',
        expect.objectContaining({
          from_page: '/home',
          to_page: '/calculator',
          trigger: 'menu_click'
        })
      );
    });
  });

  describe('Struggle Signal Tracking', () => {
    test('should track struggle signal', () => {
      service.trackStruggleSignal('calculator', {
        attemptCount: 3,
        timeSpent: 15000,
        errorType: 'validation_error',
        severity: 'medium'
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'struggle_signal',
        expect.objectContaining({
          feature_name: 'calculator',
          attempt_count: 3,
          time_spent: 15000,
          error_type: 'validation_error',
          severity: 'medium',
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Custom Event Tracking', () => {
    test('should track custom event', () => {
      service.trackCustomEvent('custom_action', {
        category: 'engagement',
        value: 100
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'custom_action',
        expect.objectContaining({
          category: 'engagement',
          value: 100,
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Search Tracking', () => {
    test('should track search', () => {
      service.trackSearch('mortgage calculator', 5);
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'search',
        expect.objectContaining({
          search_term: 'mortgage calculator',
          results_count: 5,
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Error Tracking', () => {
    test('should track error', () => {
      service.trackError('api_error', 'Failed to fetch data', {
        endpoint: '/api/data',
        statusCode: 500
      });
      
      expect(logEvent).toHaveBeenCalledWith(
        analytics,
        'error',
        expect.objectContaining({
          error_type: 'api_error',
          error_message: 'Failed to fetch data',
          endpoint: '/api/data',
          statusCode: 500,
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Environment-Specific Configuration', () => {
    test('should enable debug logging in development', () => {
      process.env.NODE_ENV = 'development';
      const devService = FirebaseAnalyticsService.getInstance();
      
      devService.trackPageView('Test Page');
      
      expect(console.log).toHaveBeenCalled();
    });

    test('should not log in production', () => {
      process.env.NODE_ENV = 'production';
      const prodService = FirebaseAnalyticsService.getInstance();
      
      prodService.trackPageView('Test Page');
      
      // Console.log should not be called for tracking in production
      // (only initialization log)
      const trackingLogs = (console.log as jest.Mock).mock.calls.filter(
        call => call[0]?.includes('Page view')
      );
      expect(trackingLogs.length).toBe(0);
    });
  });

  describe('Availability Check', () => {
    test('should return true when analytics is available', () => {
      expect(service.isAvailable()).toBe(true);
    });

    test('should handle unavailable analytics gracefully', () => {
      // Mock analytics as null
      (analytics as any) = null;
      const unavailableService = FirebaseAnalyticsService.getInstance();
      
      // Should not throw error
      expect(() => {
        unavailableService.trackPageView('Test');
      }).not.toThrow();
    });
  });
});
