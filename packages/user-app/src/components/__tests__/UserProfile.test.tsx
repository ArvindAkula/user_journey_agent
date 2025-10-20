import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfile from '../UserProfile';
import { useAuth, useEventTracking } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn(),
  useEventTracking: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

const mockTrackEvent = jest.fn();
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  avatar: 'https://example.com/avatar.jpg',
  preferences: {
    theme: 'light' as const,
    notifications: true,
    language: 'en'
  }
};

describe('UserProfile Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      updateProfile: jest.fn(),
      loading: false
    });
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser)
    });
  });

  it('renders user profile information', () => {
    render(<UserProfile />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
  });

  it('displays user avatar', () => {
    render(<UserProfile />);
    
    const avatar = screen.getByRole('img', { name: /profile avatar/i });
    expect(avatar).toHaveAttribute('src', mockUser.avatar);
  });

  it('allows editing profile information', async () => {
    const user = userEvent.setup();
    const mockUpdateProfile = jest.fn().mockResolvedValue(true);
    
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      updateProfile: mockUpdateProfile,
      loading: false
    });
    
    render(<UserProfile />);
    
    const editButton = screen.getByRole('button', { name: /edit profile/i });
    await user.click(editButton);
    
    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jane');
    
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        ...mockUser,
        firstName: 'Jane'
      });
    });
    
    expect(mockTrackEvent).toHaveBeenCalledWith('profile_update', {
      fields: ['firstName'],
      success: true
    });
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<UserProfile />);
    
    const editButton = screen.getByRole('button', { name: /edit profile/i });
    await user.click(editButton);
    
    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);
    
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
  });

  it('handles avatar upload', async () => {
    const user = userEvent.setup();
    render(<UserProfile />);
    
    const avatarInput = screen.getByLabelText(/upload avatar/i);
    const file = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
    
    await user.upload(avatarInput, file);
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('avatar_upload', {
        fileName: 'avatar.jpg',
        fileSize: expect.any(Number)
      });
    });
  });

  it('manages user preferences', async () => {
    const user = userEvent.setup();
    render(<UserProfile />);
    
    const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
    await user.click(preferencesTab);
    
    const themeSelect = screen.getByLabelText(/theme/i);
    await user.selectOptions(themeSelect, 'dark');
    
    const notificationsToggle = screen.getByLabelText(/notifications/i);
    await user.click(notificationsToggle);
    
    const saveButton = screen.getByRole('button', { name: /save preferences/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('preferences_update', {
        changes: {
          theme: 'dark',
          notifications: false
        },
        success: true
      });
    });
  });

  it('handles profile update errors', async () => {
    const user = userEvent.setup();
    const mockUpdateProfile = jest.fn().mockRejectedValue(new Error('Update failed'));
    
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      updateProfile: mockUpdateProfile,
      loading: false
    });
    
    render(<UserProfile />);
    
    const editButton = screen.getByRole('button', { name: /edit profile/i });
    await user.click(editButton);
    
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to update profile/i)).toBeInTheDocument();
    });
    
    expect(mockTrackEvent).toHaveBeenCalledWith('profile_update', {
      fields: [],
      success: false,
      errorMessage: 'Update failed'
    });
  });

  it('displays loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      updateProfile: jest.fn(),
      loading: true
    });
    
    render(<UserProfile />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles missing user data gracefully', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      updateProfile: jest.fn(),
      loading: false
    });
    
    render(<UserProfile />);
    
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
  });
});