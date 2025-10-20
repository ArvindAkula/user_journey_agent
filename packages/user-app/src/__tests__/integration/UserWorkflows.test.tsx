import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { useAuth, useEventTracking } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn(),
  useEventTracking: jest.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock Firebase
jest.mock('../../config/firebase', () => ({
  auth: {},
  analytics: {}
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe'
};

const mockTrackEvent = jest.fn();

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('User Workflows Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false
    });
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
    
    // Mock all API calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
  });

  describe('Complete User Journey', () => {
    it('allows user to navigate through all main features', async () => {
      const user = userEvent.setup();
      renderApp();
      
      // Start at home page
      expect(screen.getByText(/welcome to aws agent/i)).toBeInTheDocument();
      
      // Navigate to videos
      const videosLink = screen.getByRole('link', { name: /videos/i });
      await user.click(videosLink);
      
      expect(mockTrackEvent).toHaveBeenCalledWith('navigation', {
        from: '/',
        to: '/videos',
        method: 'tab_click'
      });
      
      // Navigate to calculator
      const calculatorLink = screen.getByRole('link', { name: /calculator/i });
      await user.click(calculatorLink);
      
      expect(mockTrackEvent).toHaveBeenCalledWith('navigation', {
        from: '/videos',
        to: '/calculator',
        method: 'tab_click'
      });
      
      // Navigate to documents
      const documentsLink = screen.getByRole('link', { name: /documents/i });
      await user.click(documentsLink);
      
      expect(mockTrackEvent).toHaveBeenCalledWith('navigation', {
        from: '/calculator',
        to: '/documents',
        method: 'tab_click'
      });
      
      // Navigate to profile
      const profileLink = screen.getByRole('link', { name: /profile/i });
      await user.click(profileLink);
      
      expect(mockTrackEvent).toHaveBeenCalledWith('navigation', {
        from: '/documents',
        to: '/profile',
        method: 'tab_click'
      });
    });
  });

  describe('Video Watching Workflow', () => {
    it('tracks complete video watching session', async () => {
      const user = userEvent.setup();
      
      // Mock video API responses
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'video-1',
              title: 'Introduction to Loans',
              duration: 300,
              thumbnailUrl: 'thumb.jpg'
            }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      
      renderApp();
      
      // Navigate to videos
      const videosLink = screen.getByRole('link', { name: /videos/i });
      await user.click(videosLink);
      
      // Wait for videos to load and click on a video
      await waitFor(() => {
        expect(screen.getByText('Introduction to Loans')).toBeInTheDocument();
      });
      
      const videoThumbnail = screen.getByText('Introduction to Loans');
      await user.click(videoThumbnail);
      
      // Verify video engagement tracking
      expect(mockTrackEvent).toHaveBeenCalledWith('video_start', {
        videoId: 'video-1',
        title: 'Introduction to Loans'
      });
    });
  });

  describe('Loan Calculator Workflow', () => {
    it('completes loan calculation and saves result', async () => {
      const user = userEvent.setup();
      
      // Mock calculator API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          monthlyPayment: 1500,
          totalInterest: 50000,
          totalAmount: 250000
        })
      });
      
      renderApp();
      
      // Navigate to calculator
      const calculatorLink = screen.getByRole('link', { name: /calculator/i });
      await user.click(calculatorLink);
      
      // Fill in loan details
      const principalInput = screen.getByLabelText(/loan amount/i);
      const rateInput = screen.getByLabelText(/interest rate/i);
      const termInput = screen.getByLabelText(/loan term/i);
      
      await user.clear(principalInput);
      await user.type(principalInput, '200000');
      
      await user.clear(rateInput);
      await user.type(rateInput, '5.5');
      
      await user.clear(termInput);
      await user.type(termInput, '30');
      
      // Calculate
      const calculateButton = screen.getByRole('button', { name: /calculate/i });
      await user.click(calculateButton);
      
      // Verify calculation tracking
      expect(mockTrackEvent).toHaveBeenCalledWith('calculation_complete', {
        principal: 200000,
        interestRate: 5.5,
        termYears: 30,
        monthlyPayment: 1500
      });
      
      // Save calculation
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      expect(mockTrackEvent).toHaveBeenCalledWith('calculation_save', {
        calculationId: expect.any(String)
      });
    });
  });

  describe('Document Upload Workflow', () => {
    it('uploads document with validation and tracking', async () => {
      const user = userEvent.setup();
      
      // Mock upload API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'doc-123',
          fileName: 'test.pdf'
        })
      });
      
      renderApp();
      
      // Navigate to documents
      const documentsLink = screen.getByRole('link', { name: /documents/i });
      await user.click(documentsLink);
      
      // Upload a file
      const fileInput = screen.getByLabelText(/select files/i);
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      await user.upload(fileInput, file);
      
      // Verify file selection tracking
      expect(mockTrackEvent).toHaveBeenCalledWith('document_upload_start', {
        fileName: 'test.pdf',
        fileSize: expect.any(Number)
      });
      
      // Upload the file
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);
      
      // Verify upload completion tracking
      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith('document_upload_complete', {
          fileName: 'test.pdf',
          success: true
        });
      });
    });
  });

  describe('Profile Management Workflow', () => {
    it('updates user profile and preferences', async () => {
      const user = userEvent.setup();
      
      // Mock profile update API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      renderApp();
      
      // Navigate to profile
      const profileLink = screen.getByRole('link', { name: /profile/i });
      await user.click(profileLink);
      
      // Edit profile
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      // Update first name
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      // Save changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      // Verify profile update tracking
      expect(mockTrackEvent).toHaveBeenCalledWith('profile_update', {
        fields: ['firstName'],
        success: true
      });
    });
  });

  describe('Error Handling Workflows', () => {
    it('handles API errors gracefully across features', async () => {
      const user = userEvent.setup();
      
      // Mock API failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      renderApp();
      
      // Try to navigate to videos (should handle error)
      const videosLink = screen.getByRole('link', { name: /videos/i });
      await user.click(videosLink);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
      
      // Verify error tracking
      expect(mockTrackEvent).toHaveBeenCalledWith('error', {
        page: 'videos',
        error: 'Network error'
      });
    });
  });

  describe('Authentication Workflow', () => {
    it('handles login and logout flow', async () => {
      const user = userEvent.setup();
      const mockLogin = jest.fn().mockResolvedValue(true);
      const mockLogout = jest.fn();
      
      // Start with no user
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        login: mockLogin,
        logout: mockLogout,
        loading: false
      });
      
      renderApp();
      
      // Should show login prompt
      expect(screen.getByText(/please log in/i)).toBeInTheDocument();
      
      // Click login button
      const loginButton = screen.getByRole('button', { name: /log in/i });
      await user.click(loginButton);
      
      // Fill login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  describe('Offline Behavior', () => {
    it('queues events when offline and syncs when online', async () => {
      const user = userEvent.setup();
      
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      renderApp();
      
      // Navigate to calculator
      const calculatorLink = screen.getByRole('link', { name: /calculator/i });
      await user.click(calculatorLink);
      
      // Events should be queued (not sent immediately)
      expect(mockTrackEvent).toHaveBeenCalledWith('navigation', {
        from: '/',
        to: '/calculator',
        method: 'tab_click',
        queued: true
      });
      
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      
      // Trigger online event
      window.dispatchEvent(new Event('online'));
      
      // Should sync queued events
      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith('events_synced', {
          count: expect.any(Number)
        });
      });
    });
  });
});