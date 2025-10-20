import axios, { AxiosInstance } from 'axios';
import { User, LoginCredentials, RegisterData, AuthState } from '../types';

export interface AuthServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  tokenStorageKey?: string;
}

export class AuthService {
  private apiClient: AxiosInstance;
  private tokenStorageKey: string;
  private authStateListeners: ((state: AuthState) => void)[] = [];
  private currentAuthState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };

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
    this.setupInterceptors();
    this.initializeAuth();
  }

  async login(credentials: LoginCredentials): Promise<User> {
    this.updateAuthState({ isLoading: true, error: null });

    try {
      const response = await this.apiClient.post('/auth/login', credentials);
      const { user, token } = response.data;

      this.setToken(token);
      this.updateAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return user;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }

  async register(data: RegisterData): Promise<User> {
    this.updateAuthState({ isLoading: true, error: null });

    try {
      const response = await this.apiClient.post('/auth/register', data);
      const { user, token } = response.data;

      this.setToken(token);
      this.updateAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return user;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }  
async logout(): Promise<void> {
    try {
      await this.apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.clearToken();
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
    if (!token) return null;

    try {
      const response = await this.apiClient.get('/auth/me');
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
    try {
      const response = await this.apiClient.post('/auth/refresh');
      const { token } = response.data;
      this.setToken(token);
      return token;
    } catch (error) {
      this.clearToken();
      this.updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired',
      });
      return null;
    }
  }

  getAuthState(): AuthState {
    return this.currentAuthState;
  }

  onAuthStateChange(listener: (state: AuthState) => void): () => void {
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
    await this.getCurrentUser();
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
        if (error.response?.status === 401) {
          const refreshed = await this.refreshToken();
          if (refreshed && error.config) {
            error.config.headers.Authorization = `Bearer ${refreshed}`;
            return this.apiClient.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenStorageKey, token);
  }

  private getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  private clearToken(): void {
    localStorage.removeItem(this.tokenStorageKey);
  }

  private updateAuthState(updates: Partial<AuthState>): void {
    this.currentAuthState = { ...this.currentAuthState, ...updates };
    this.authStateListeners.forEach(listener => listener(this.currentAuthState));
  }
}