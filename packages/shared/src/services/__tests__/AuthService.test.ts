import { AuthService } from '../AuthService';

// Mock Firebase Auth
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null
  })),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordResetEmail(...args)
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('login', () => {
    it('successfully logs in user with valid credentials', async () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User'
      };
      
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });

      const result = await authService.login('test@example.com', 'password123');
      
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      );
      expect(result).toEqual(mockUser);
    });

    it('throws error for invalid credentials', async () => {
      const error = new Error('Invalid credentials');
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await expect(authService.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('handles network errors during login', async () => {
      const networkError = new Error('Network error');
      mockSignInWithEmailAndPassword.mockRejectedValue(networkError);

      await expect(authService.login('test@example.com', 'password123'))
        .rejects.toThrow('Network error');
    });
  });

  describe('register', () => {
    it('successfully registers new user', async () => {
      const mockUser = {
        uid: 'newuser123',
        email: 'newuser@example.com',
        displayName: null
      };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      mockUpdateProfile.mockResolvedValue(undefined);

      const result = await authService.register(
        'newuser@example.com',
        'password123',
        'New User'
      );
      
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'newuser@example.com',
        'password123'
      );
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'New User'
      });
      expect(result).toEqual(mockUser);
    });

    it('throws error for existing email', async () => {
      const error = new Error('Email already in use');
      mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

      await expect(authService.register('existing@example.com', 'password123', 'User'))
        .rejects.toThrow('Email already in use');
    });

    it('handles weak password error', async () => {
      const error = new Error('Password is too weak');
      mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

      await expect(authService.register('test@example.com', '123', 'User'))
        .rejects.toThrow('Password is too weak');
    });
  });

  describe('logout', () => {
    it('successfully logs out user', async () => {
      mockSignOut.mockResolvedValue(undefined);

      await authService.logout();
      
      expect(mockSignOut).toHaveBeenCalledWith(expect.anything());
    });

    it('handles logout errors', async () => {
      const error = new Error('Logout failed');
      mockSignOut.mockRejectedValue(error);

      await expect(authService.logout()).rejects.toThrow('Logout failed');
    });
  });

  describe('getCurrentUser', () => {
    it('returns current user when authenticated', () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User'
      };
      
      (authService as any).auth.currentUser = mockUser;

      const result = authService.getCurrentUser();
      expect(result).toEqual(mockUser);
    });

    it('returns null when not authenticated', () => {
      (authService as any).auth.currentUser = null;

      const result = authService.getCurrentUser();
      expect(result).toBeNull();
    });
  });

  describe('onAuthStateChanged', () => {
    it('sets up auth state listener', () => {
      const callback = jest.fn();
      
      authService.onAuthStateChanged(callback);
      
      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(
        expect.anything(),
        callback
      );
    });

    it('returns unsubscribe function', () => {
      const mockUnsubscribe = jest.fn();
      mockOnAuthStateChanged.mockReturnValue(mockUnsubscribe);
      
      const unsubscribe = authService.onAuthStateChanged(jest.fn());
      
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe('resetPassword', () => {
    it('sends password reset email successfully', async () => {
      mockSendPasswordResetEmail.mockResolvedValue(undefined);

      await authService.resetPassword('test@example.com');
      
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com'
      );
    });

    it('handles invalid email error', async () => {
      const error = new Error('Invalid email');
      mockSendPasswordResetEmail.mockRejectedValue(error);

      await expect(authService.resetPassword('invalid-email'))
        .rejects.toThrow('Invalid email');
    });
  });

  describe('updateUserProfile', () => {
    it('updates user profile successfully', async () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Old Name'
      };
      
      (authService as any).auth.currentUser = mockUser;
      mockUpdateProfile.mockResolvedValue(undefined);

      await authService.updateUserProfile({ displayName: 'New Name' });
      
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'New Name'
      });
    });

    it('throws error when no user is authenticated', async () => {
      (authService as any).auth.currentUser = null;

      await expect(authService.updateUserProfile({ displayName: 'New Name' }))
        .rejects.toThrow('No user is currently authenticated');
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when user is authenticated', () => {
      (authService as any).auth.currentUser = { uid: 'user123' };

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('returns false when user is not authenticated', () => {
      (authService as any).auth.currentUser = null;

      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});