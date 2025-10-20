import axios, { AxiosInstance } from 'axios';
import { User, LoginCredentials, AuthState, UserRole } from '../types';

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
  expiresIn: number;
}

export interface TokenResponse {
  token: string;
  expiresIn: number;
}

export interface AuthServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  tokenStorageKey?: string;
  refreshTokenKey?: string;
}

export class AuthService {
  private apiClient: AxiosInstance;
  private tokenStorageKey: string;
  private refreshTokenKey: string;
  private authStateListeners: ((state: AuthState) => void)[] = [];
  private currentAuthState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: AuthServiceConfig) {
    this.apiClient = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.tokenStorageKey = config.tokenStorageKey || 'auth_token';
    this.refreshTokenKey = config.refreshTokenKey || 'refresh_token';
    this.setupInterceptors();
    this.initializeAuth();
  }

  async login(credentials: LoginCredentials): Promise<User> {
    this.updateAuthState({ isLoading: true, error: null });

    try {
      const response = await this.apiClient.post<AuthResponse>('/api/auth/login', credentials);
      const { user, token, refreshToken } = response.data;

      this.setToken(token);
      if (refreshToken) {
        this.setRefreshToken(refreshToken);
      }
      
      this.updateAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return user;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Invalid email or password';
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }  async logout(): Promise<void> {
    const token = this.getToken();
    
    try {
      if (token) {
        await this.apiClient.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.clearToken();
      this.clearRefreshToken();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const token = this.getToken();
    if (!token) {
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return null;
    }

    try {
      const response = await this.apiClient.get<User>('/api/auth/me');
      const user = response.data;
      
      this.updateAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return user;
    } catch (error) {
      this.clearToken();
      this.clearRefreshToken();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return null;
    }
  }

  async refreshToken(): Promise<string | null> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._refreshToken();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    return result;
  }

  private async _refreshToken(): Promise<string | null> {
    const currentToken = this.getToken();
    if (!currentToken) {
      return null;
    }

    try {
      const response = await this.apiClient.post<TokenResponse>('/api/auth/refresh', {}, {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });
      const { token } = response.data;
      this.setToken(token);
      return token;
    } catch (error) {
      this.clearToken();
      this.clearRefreshToken();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired',
      });
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenStorageKey, token);
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenStorageKey);
  }

  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Decode JWT token to check expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < expirationTime;
    } catch (error) {
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.currentAuthState.isAuthenticated && this.isTokenValid();
  }

  getUserRole(): UserRole | null {
    return this.currentAuthState.user?.role || null;
  }

  hasRole(role: UserRole): boolean {
    const userRole = this.getUserRole();
    if (!userRole) return false;

    // Role hierarchy: ADMIN > ANALYST > VIEWER
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.ADMIN]: 3,
      [UserRole.ANALYST]: 2,
      [UserRole.VIEWER]: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[role];
  }

  getAuthState(): AuthState {
    return this.currentAuthState;
  }

  onAuthStateChange(listener: (state: AuthState) => void): () => void {
    this.authStateListeners.push(listener);
    // Immediately call listener with current state
    listener(this.currentAuthState);
    
    return () => {
      const index = this.authStateListeners.indexOf(listener);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  private async initializeAuth(): Promise<void> {
    this.updateAuthState({ isLoading: true });
    
    // Check if token exists and is valid
    if (this.isTokenValid()) {
      await this.getCurrentUser();
    } else {
      this.updateAuthState({ isLoading: false });
    }
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.apiClient.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor to handle token refresh
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          const refreshed = await this.refreshToken();
          if (refreshed) {
            originalRequest.headers.Authorization = `Bearer ${refreshed}`;
            return this.apiClient.request(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem(this.refreshTokenKey, token);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  private clearRefreshToken(): void {
    localStorage.removeItem(this.refreshTokenKey);
  }

  private updateAuthState(updates: Partial<AuthState>): void {
    this.currentAuthState = { ...this.currentAuthState, ...updates };
    this.authStateListeners.forEach(listener => listener(this.currentAuthState));
  }
}