import { AnalyticsAuthService } from '../AnalyticsAuthService';
import { AnalyticsLoginCredentials, AnalyticsUser, AnalyticsRole } from '../../types/AnalyticsAuth';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  }))
}));

describe('AnalyticsAuthService', () => {
  let authService: AnalyticsAuthService;
  let mockApiClient: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Create service instance
    authService = new AnalyticsAuthService({
      baseURL: 'http://localhost:8080/api',
      timeout: 15000
    });

    // Get the mocked API client
    mockApiClient = (authService as any).apiClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const credentials: AnalyticsLoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser: AnalyticsUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'analytics_analyst',
        permissions: ['view_analytics', 'export_data'],
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      };

      const mockResponse = {
        data: {
          user: mockUser,
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 3600
        }
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.login(credentials);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/analytics/login', credentials);
      expect(result).toEqual(mockUser);
      expect(localStorage.getItem('analytics_access_token')).toBe('mock-access-token');
      expect(localStorage.getItem('analytics_refresh_token')).toBe('mock-refresh-token');
    });

    it('should handle login failure', async () => {
      const credentials: AnalyticsLoginCredentials = {
        email: 'test@example.com',
        password: 'wrong-password'
      };

      const mockError = {
        response: {
          data: {
            message: 'Invalid credentials'
          }
        }
      };

      mockApiClient.post.mockRejectedValue(mockError);

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
      expect(localStorage.getItem('analytics_access_token')).toBeNull();
      expect(localStorage.getItem('analytics_refresh_token')).toBeNull();
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear tokens', async () => {
      // Set up tokens
      localStorage.setItem('analytics_access_token', 'test-token');
      localStorage.setItem('analytics_refresh_token', 'test-refresh-token');

      mockApiClient.post.mockResolvedValue({ data: {} });

      await authService.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/analytics/logout', {
        refreshToken: 'test-refresh-token'
      });
      expect(localStorage.getItem('analytics_access_token')).toBeNull();
      expect(localStorage.getItem('analytics_refresh_token')).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true for user with required permission', () => {
      const mockUser: AnalyticsUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'analytics_analyst',
        permissions: ['view_analytics', 'export_data'],
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      };

      // Set the current auth state
      (authService as any).currentAuthState = {
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: mockUser.permissions
      };

      expect(authService.hasPermission('view_analytics')).toBe(true);
      expect(authService.hasPermission('export_data')).toBe(true);
      expect(authService.hasPermission('manage_users')).toBe(false);
    });

    it('should return false for inactive user', () => {
      const mockUser: AnalyticsUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'analytics_analyst',
        permissions: ['view_analytics', 'export_data'],
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: false // User is inactive
      };

      (authService as any).currentAuthState = {
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: mockUser.permissions
      };

      expect(authService.hasPermission('view_analytics')).toBe(false);
    });
  });

  describe('decodeToken', () => {
    it('should decode JWT token correctly', () => {
      // Create a mock JWT token (header.payload.signature)
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'analytics_analyst' as AnalyticsRole,
        permissions: ['view_analytics', 'export_data'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'analytics-dashboard',
        iss: 'analytics-api'
      };

      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const decoded = authService.decodeToken(mockToken);

      expect(decoded).toEqual(payload);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token';
      const decoded = authService.decodeToken(invalidToken);
      expect(decoded).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      const expiredPayload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'analytics_analyst' as AnalyticsRole,
        permissions: ['view_analytics'],
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        aud: 'analytics-dashboard',
        iss: 'analytics-api'
      };

      const encodedPayload = btoa(JSON.stringify(expiredPayload));
      const expiredToken = `header.${encodedPayload}.signature`;

      expect(authService.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should return false for valid token', () => {
      const validPayload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'analytics_analyst' as AnalyticsRole,
        permissions: ['view_analytics'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        aud: 'analytics-dashboard',
        iss: 'analytics-api'
      };

      const encodedPayload = btoa(JSON.stringify(validPayload));
      const validToken = `header.${encodedPayload}.signature`;

      expect(authService.isTokenExpired(validToken)).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw for user with required permission', () => {
      const mockUser: AnalyticsUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'analytics_analyst',
        permissions: ['view_analytics', 'export_data'],
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      };

      (authService as any).currentAuthState = {
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: mockUser.permissions
      };

      expect(() => authService.requirePermission('view_analytics')).not.toThrow();
    });

    it('should throw for user without required permission', () => {
      const mockUser: AnalyticsUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'analytics_viewer',
        permissions: ['view_analytics'],
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      };

      (authService as any).currentAuthState = {
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: mockUser.permissions
      };

      expect(() => authService.requirePermission('manage_users')).toThrow('Access denied: manage_users permission required');
    });
  });
});