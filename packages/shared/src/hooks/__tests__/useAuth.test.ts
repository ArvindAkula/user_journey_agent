import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { AuthService } from '../../services/AuthService';

// Mock AuthService
jest.mock('../../services/AuthService');

describe('useAuth Hook', () => {
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    (AuthService as jest.Mock).mockImplementation(() => mockAuthService);
  });

  it('initializes with null user and loading state', () => {
    mockAuthService.getCurrentUser.mockReturnValue(null);
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets user when authentication state changes', async () => {
    const mockUser = {
      uid: 'user123',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    let authStateCallback: (user: any) => void;
    mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
      authStateCallback = callback;
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());

    act(() => {
      authStateCallback(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles login successfully', async () => {
    const mockUser = {
      uid: 'user123',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    mockAuthService.login.mockResolvedValue(mockUser);
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(result.current.error).toBeNull();
  });

  it('handles login error', async () => {
    const error = new Error('Invalid credentials');
    mockAuthService.login.mockRejectedValue(error);
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'wrongpassword');
    });

    expect(result.current.error).toBe('Invalid credentials');
  });

  it('handles register successfully', async () => {
    const mockUser = {
      uid: 'newuser123',
      email: 'newuser@example.com',
      displayName: 'New User'
    };

    mockAuthService.register.mockResolvedValue(mockUser);
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register('newuser@example.com', 'password123', 'New User');
    });

    expect(mockAuthService.register).toHaveBeenCalledWith(
      'newuser@example.com',
      'password123',
      'New User'
    );
    expect(result.current.error).toBeNull();
  });

  it('handles register error', async () => {
    const error = new Error('Email already in use');
    mockAuthService.register.mockRejectedValue(error);
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register('existing@example.com', 'password123', 'User');
    });

    expect(result.current.error).toBe('Email already in use');
  });

  it('handles logout successfully', async () => {
    mockAuthService.logout.mockResolvedValue();
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('handles logout error', async () => {
    const error = new Error('Logout failed');
    mockAuthService.logout.mockRejectedValue(error);
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.error).toBe('Logout failed');
  });

  it('handles password reset successfully', async () => {
    mockAuthService.resetPassword.mockResolvedValue();
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.resetPassword('test@example.com');
    });

    expect(mockAuthService.resetPassword).toHaveBeenCalledWith('test@example.com');
    expect(result.current.error).toBeNull();
  });

  it('clears error when clearError is called', () => {
    mockAuthService.onAuthStateChanged.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useAuth());

    // Set an error first
    act(() => {
      (result.current as any).setError('Test error');
    });

    expect(result.current.error).toBe('Test error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('unsubscribes from auth state changes on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockAuthService.onAuthStateChanged.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useAuth());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('provides isAuthenticated computed value', () => {
    const mockUser = {
      uid: 'user123',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    let authStateCallback: (user: any) => void;
    mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
      authStateCallback = callback;
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());

    // Initially not authenticated
    expect(result.current.isAuthenticated).toBe(false);

    // After user is set
    act(() => {
      authStateCallback(mockUser);
    });

    expect(result.current.isAuthenticated).toBe(true);

    // After user is cleared
    act(() => {
      authStateCallback(null);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });
});