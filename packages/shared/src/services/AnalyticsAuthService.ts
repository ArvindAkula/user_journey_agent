import axios, { AxiosInstance } from 'axios';
import {
  AnalyticsUser,
  AnalyticsAuthState,
  AnalyticsLoginCredentials,
  AnalyticsAuthResponse,
  AnalyticsTokenPayload,
  AnalyticsPermission,
  AnalyticsUserManagement,
  CreateAnalyticsUserRequest,
  UpdateAnalyticsUserRequest,
  hasPermission
} from '../types/AnalyticsAuth';

export interface AnalyticsAuthServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  accessTokenKey?: string;
  refreshTokenKey?: string;
}

export class AnalyticsAuthService {
  private apiClient: AxiosInstance;
  private accessTokenKey: string;
  private refreshTokenKey: string;
  private authStateListeners: ((state: AnalyticsAuthState) => void)[] = [];
  private currentAuthState: AnalyticsAuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    permissions: [],
  };
  private tokenRefreshPromise: Promise<string | null> | null = null;

  constructor(config: AnalyticsAuthServiceConfig) {
    this.apiClient = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'analytics-dashboard',
        ...config.headers,
      },
    });

    this.accessTokenKey = config.accessTokenKey || 'analytics_access_token';
    this.refreshTokenKey = config.refreshTokenKey || 'analytics_refresh_token';

    // Check for demo mode first
    if (localStorage.getItem('analytics_demo_mode') === 'true') {
      console.log('Demo mode detected, skipping auth service setup');
      this.initializeDemoMode();
    } else {
      this.setupInterceptors();
      this.initializeAuth();
    }
  }

  private initializeDemoMode(): void {
    const mockAuthData = localStorage.getItem('analytics_auth');
    if (mockAuthData) {
      try {
        const mockUser = JSON.parse(mockAuthData);
        console.log('Initializing demo mode with mock user:', mockUser);
        this.updateAuthState({
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          permissions: mockUser.permissions || [],
        });
      } catch (error) {
        console.error('Error parsing mock auth data:', error);
        this.updateAuthState({ isLoading: false });
      }
    } else {
      this.updateAuthState({ isLoading: false });
    }
  }

  async login(credentials: AnalyticsLoginCredentials): Promise<AnalyticsUser> {
    this.updateAuthState({ isLoading: true, error: null });

    // Check if in demo mode and using demo credentials
    if (localStorage.getItem('analytics_demo_mode') === 'true' ||
      credentials.email === 'analytics@example.com') {
      console.log('Demo mode: bypassing login API call');

      const mockUser: AnalyticsUser = {
        id: 'demo-user-123',
        email: 'analytics@example.com',
        firstName: 'Demo',
        lastName: 'User',
        name: 'Demo Analytics User',
        role: 'analytics_admin',
        permissions: ['view_analytics', 'export_data', 'manage_users', 'access_real_time'],
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      };

      // Create proper JWT tokens that can be decoded
      const mockJwtHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const mockJwtPayload = btoa(JSON.stringify({
        userId: 'demo-user-123',
        email: 'analytics@example.com',
        role: 'analytics_admin',
        permissions: ['view_analytics', 'export_data', 'manage_users', 'access_real_time'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
        aud: 'analytics-dashboard',
        iss: 'demo-auth-service'
      }));
      const mockJwtToken = `${mockJwtHeader}.${mockJwtPayload}.mock-signature`;
      
      this.setTokens(mockJwtToken, mockJwtToken);

      this.updateAuthState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: mockUser.permissions,
      });

      return mockUser;
    }

    try {
      const response = await this.apiClient.post('/auth/analytics/login', credentials);
      const authResponse: AnalyticsAuthResponse = response.data;

      this.setTokens(authResponse.accessToken, authResponse.refreshToken);

      this.updateAuthState({
        user: authResponse.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: authResponse.user.permissions,
      });

      return authResponse.user;
    } catch (error: any) {
      const errorMessage = this.getErrorMessage(error);
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
        permissions: [],
      });
      throw new Error(errorMessage);
    }
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        await this.apiClient.post('/auth/analytics/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.clearTokens();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        permissions: [],
      });
    }
  }

  async getCurrentUser(): Promise<AnalyticsUser | null> {
    // Always check for mock auth data first (for demo purposes)
    const mockAuthData = localStorage.getItem('analytics_auth');
    if (mockAuthData) {
      try {
        const mockUser = JSON.parse(mockAuthData);
        console.log('Using mock user from getCurrentUser:', mockUser);
        this.updateAuthState({
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          permissions: mockUser.permissions || [],
        });
        return mockUser;
      } catch (error) {
        console.error('Error parsing mock auth data:', error);
      }
    }

    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const response = await this.apiClient.get('/auth/analytics/me');
      const user: AnalyticsUser = response.data;

      this.updateAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: user.permissions,
      });

      return user;
    } catch (error) {
      this.clearTokens();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        permissions: [],
      });
      return null;
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    // Skip token refresh in demo mode
    if (localStorage.getItem('analytics_demo_mode') === 'true') {
      console.log('Demo mode: skipping token refresh');
      return 'mock-jwt-token';
    }

    // Prevent multiple concurrent refresh attempts
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.performTokenRefresh();
    const result = await this.tokenRefreshPromise;
    this.tokenRefreshPromise = null;

    return result;
  }

  private async performTokenRefresh(): Promise<string | null> {
    // Skip token refresh in demo mode
    if (localStorage.getItem('analytics_demo_mode') === 'true') {
      console.log('Demo mode: skipping performTokenRefresh');
      return 'mock-jwt-token';
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired',
        permissions: [],
      });
      return null;
    }

    try {
      const response = await this.apiClient.post('/auth/analytics/refresh', {
        refreshToken
      });

      const authResponse: AnalyticsAuthResponse = response.data;
      this.setTokens(authResponse.accessToken, authResponse.refreshToken);

      this.updateAuthState({
        user: authResponse.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: authResponse.user.permissions,
      });

      return authResponse.accessToken;
    } catch (error) {
      this.clearTokens();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired',
        permissions: [],
      });
      return null;
    }
  }

  // User Management Methods (for admin users)
  async getAnalyticsUsers(): Promise<AnalyticsUserManagement[]> {
    this.requirePermission('manage_users');

    try {
      const response = await this.apiClient.get('/auth/analytics/users');
      return response.data;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async createAnalyticsUser(userData: CreateAnalyticsUserRequest): Promise<AnalyticsUserManagement> {
    this.requirePermission('manage_users');

    try {
      const response = await this.apiClient.post('/auth/analytics/users', userData);
      return response.data;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async updateAnalyticsUser(userId: string, updates: UpdateAnalyticsUserRequest): Promise<AnalyticsUserManagement> {
    this.requirePermission('manage_users');

    try {
      const response = await this.apiClient.put(`/auth/analytics/users/${userId}`, updates);
      return response.data;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async deactivateAnalyticsUser(userId: string): Promise<void> {
    this.requirePermission('manage_users');

    try {
      await this.apiClient.patch(`/auth/analytics/users/${userId}/deactivate`);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async resetUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
    this.requirePermission('manage_users');

    try {
      const response = await this.apiClient.post(`/auth/analytics/users/${userId}/reset-password`);
      return response.data;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  // Permission checking methods
  hasPermission(permission: AnalyticsPermission): boolean {
    return hasPermission(this.currentAuthState.user, permission);
  }

  requirePermission(permission: AnalyticsPermission): void {
    if (!this.hasPermission(permission)) {
      throw new Error(`Access denied: ${permission} permission required`);
    }
  }

  // JWT Token utilities
  decodeToken(token: string): AnalyticsTokenPayload | null {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload);
      return JSON.parse(decoded) as AnalyticsTokenPayload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  }

  getTokenExpirationTime(token: string): Date | null {
    const payload = this.decodeToken(token);
    if (!payload) return null;

    return new Date(payload.exp * 1000);
  }

  // State management
  getAuthState(): AnalyticsAuthState {
    return this.currentAuthState;
  }

  onAuthStateChange(listener: (state: AnalyticsAuthState) => void): () => void {
    this.authStateListeners.push(listener);
    return () => {
      const index = this.authStateListeners.indexOf(listener);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  private async initializeAuth(): Promise<void> {
    this.updateAuthState({ isLoading: true });

    // Always check for mock auth data first (for demo purposes)
    const mockAuthData = localStorage.getItem('analytics_auth');
    if (mockAuthData) {
      try {
        const mockUser = JSON.parse(mockAuthData);
        console.log('Found mock auth data:', mockUser);
        this.updateAuthState({
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          permissions: mockUser.permissions || [],
        });
        return;
      } catch (error) {
        console.error('Error parsing mock auth data:', error);
      }
    }

    const token = this.getAccessToken();
    if (token && !this.isTokenExpired(token)) {
      await this.getCurrentUser();
    } else if (this.getRefreshToken()) {
      await this.refreshAccessToken();
    } else {
      this.updateAuthState({ isLoading: false });
    }
  }

  private isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' ||
      process.env.REACT_APP_ENVIRONMENT === 'development';
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.apiClient.interceptors.request.use((config) => {
      // Skip interceptors in demo mode
      if (localStorage.getItem('analytics_demo_mode') === 'true') {
        return config;
      }

      const token = this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor to handle token refresh
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Skip token refresh in demo mode
        if (localStorage.getItem('analytics_demo_mode') === 'true') {
          return Promise.reject(error);
        }

        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const newToken = await this.refreshAccessToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.apiClient.request(originalRequest);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.accessTokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  private getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  private clearTokens(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  private updateAuthState(updates: Partial<AnalyticsAuthState>): void {
    this.currentAuthState = { ...this.currentAuthState, ...updates };
    this.authStateListeners.forEach(listener => listener(this.currentAuthState));
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}