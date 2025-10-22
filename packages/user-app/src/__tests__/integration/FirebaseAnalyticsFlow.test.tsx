/**
 * Integration tests for Firebase Analytics Event Flow
 * Tests end-to-end event tracking from user actions to Firebase Analytics
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FirebaseAnalyticsService } from '../../services/FirebaseAnalyticsService';

// Mock Firebase Analytics
jest.mock('../../config/firebase', () => ({
  analytics: {},
  auth: {}
}));

jest.mock('firebase/analytics', () => ({
  logEvent: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn()
}));

describe('Firebase Analytics Event Flow Integration Tests', () => {
  let analyticsService: FirebaseAnalyticsService;
  const { logEvent, setUserId, setUserProperties } = require('firebase/analytics');

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = FirebaseAnalyticsService.getInstance();
  });

  describe('Page View Tracking', () => {
    test('should track page view when user navigates', () => {
      analyticsService.trackPageView('Home Page');

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'page_view',
        expect.objectContaining({
          page_title: 'Home Page'
        })
      );
    });

    test('should include page location and path', () => {
      analyticsService.trackPageView('Calculator');

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'page_view',
        expect.objectContaining({
          page_title: 'Calculator',
          page_location: expect.any(String),
          page_path: expect.any(String)
        })
      );
    });
  });

  describe('Calculator Event Tracking', () => {
    test('should track calculator interaction', () => {
      analyticsService.trackCalculatorEvent('calculate', {
        loanAmount: 300000,
        interestRate: 3.5,
        termYears: 30,
        monthlyPayment: 1347.13
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'calculator_interaction',
        expect.objectContaining({
          action: 'calculate',
          loan_amount: 300000,
          interest_rate: 3.5,
          term_years: 30,
          monthly_payment: 1347.13
        })
      );
    });

    test('should track calculator errors', () => {
      analyticsService.trackCalculatorEvent('calculate', {
        success: false,
        errorType: 'invalid_input'
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'calculator_interaction',
        expect.objectContaining({
          success: false,
          error_type: 'invalid_input'
        })
      );
    });
  });

  describe('Video Engagement Tracking', () => {
    test('should track video play event', () => {
      analyticsService.trackVideoEvent('play', 'video-123', {
        duration: 300,
        position: 0,
        videoTitle: 'Introduction Video'
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'video_engagement',
        expect.objectContaining({
          action: 'play',
          video_id: 'video-123',
          video_title: 'Introduction Video'
        })
      );
    });

    test('should track video completion', () => {
      analyticsService.trackVideoEvent('complete', 'video-123', {
        duration: 300,
        position: 300,
        completionRate: 100
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'video_engagement',
        expect.objectContaining({
          action: 'complete',
          completion_rate: 100
        })
      );
    });

    test('should track video seek', () => {
      analyticsService.trackVideoEvent('seek', 'video-123', {
        position: 150
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'video_engagement',
        expect.objectContaining({
          action: 'seek',
          video_position: 150
        })
      );
    });
  });

  describe('Document Upload Tracking', () => {
    test('should track successful document upload', () => {
      analyticsService.trackDocumentUpload('pdf', {
        fileSize: 1024000,
        fileName: 'document.pdf',
        success: true
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'document_upload',
        expect.objectContaining({
          document_type: 'pdf',
          file_size: 1024000,
          success: true
        })
      );
    });

    test('should track failed document upload', () => {
      analyticsService.trackDocumentUpload('pdf', {
        success: false,
        errorType: 'file_too_large'
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'document_upload',
        expect.objectContaining({
          success: false,
          error_type: 'file_too_large'
        })
      );
    });
  });

  describe('User Properties', () => {
    test('should set user ID', () => {
      analyticsService.setUserId('user-123');

      expect(setUserId).toHaveBeenCalledWith(
        expect.anything(),
        'user-123'
      );
    });

    test('should set user properties', () => {
      const properties = {
        role: 'premium',
        subscription: 'monthly'
      };

      analyticsService.setUserProperties(properties);

      expect(setUserProperties).toHaveBeenCalledWith(
        expect.anything(),
        properties
      );
    });
  });

  describe('Navigation Tracking', () => {
    test('should track navigation between pages', () => {
      analyticsService.trackNavigation('/home', '/calculator');

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'navigation',
        expect.objectContaining({
          from_page: '/home',
          to_page: '/calculator'
        })
      );
    });
  });

  describe('Struggle Signal Tracking', () => {
    test('should track struggle signals', () => {
      analyticsService.trackStruggleSignal('calculator', {
        attemptCount: 3,
        timeSpent: 15000,
        errorType: 'validation_error',
        severity: 'medium'
      });

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'struggle_signal',
        expect.objectContaining({
          feature_name: 'calculator',
          attempt_count: 3,
          severity: 'medium'
        })
      );
    });
  });

  describe('Event Batching', () => {
    test('should handle multiple events in sequence', () => {
      analyticsService.trackPageView('Home');
      analyticsService.trackFeatureInteraction('calculator', 'open');
      analyticsService.trackCalculatorEvent('calculate', { loanAmount: 300000 });

      expect(logEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle analytics errors gracefully', () => {
      logEvent.mockImplementationOnce(() => {
        throw new Error('Analytics error');
      });

      // Should not throw
      expect(() => {
        analyticsService.trackPageView('Test');
      }).not.toThrow();
    });
  });
});
