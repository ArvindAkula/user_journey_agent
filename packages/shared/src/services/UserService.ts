import axios, { AxiosInstance } from 'axios';
import { UserProfile, User, UserPersona } from '../types';

export interface UserServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class UserService {
  private apiClient: AxiosInstance;

  constructor(config: UserServiceConfig) {
    this.apiClient = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const response = await this.apiClient.get(`/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await this.apiClient.put(`/users/${userId}/profile`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async updateUserPreferences(
    userId: string, 
    preferences: UserProfile['preferences']
  ): Promise<UserProfile> {
    try {
      const response = await this.apiClient.put(`/users/${userId}/preferences`, preferences);
      return response.data;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  async getUserPersona(userId: string): Promise<UserPersona> {
    try {
      const response = await this.apiClient.get(`/users/${userId}/persona`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user persona:', error);
      throw error;
    }
  }

  async updateUserPersona(userId: string, persona: UserPersona): Promise<UserPersona> {
    try {
      const response = await this.apiClient.put(`/users/${userId}/persona`, persona);
      return response.data;
    } catch (error) {
      console.error('Error updating user persona:', error);
      throw error;
    }
  }

  async getUserRiskAssessment(userId: string): Promise<UserProfile['riskFactors']> {
    try {
      const response = await this.apiClient.get(`/users/${userId}/risk-assessment`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user risk assessment:', error);
      throw error;
    }
  }

  async updateUserContext(userId: string, context: any): Promise<void> {
    try {
      await this.apiClient.post(`/users/${userId}/context`, context);
    } catch (error) {
      console.error('Error updating user context:', error);
      // Don't throw error to avoid disrupting user experience
    }
  }

  async getInterventionHistory(userId: string): Promise<UserProfile['interventionHistory']> {
    try {
      const response = await this.apiClient.get(`/users/${userId}/interventions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching intervention history:', error);
      throw error;
    }
  }

  async recordIntervention(
    userId: string, 
    intervention: Omit<UserProfile['interventionHistory'][0], 'interventionId' | 'triggeredAt'>
  ): Promise<void> {
    try {
      await this.apiClient.post(`/users/${userId}/interventions`, intervention);
    } catch (error) {
      console.error('Error recording intervention:', error);
      throw error;
    }
  }

  async getUserBehaviorMetrics(userId: string): Promise<UserProfile['behaviorMetrics']> {
    try {
      const response = await this.apiClient.get(`/users/${userId}/behavior-metrics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user behavior metrics:', error);
      throw error;
    }
  }

  async getUsersBySegment(segment: string): Promise<User[]> {
    try {
      const response = await this.apiClient.get(`/users/segment/${segment}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching users by segment:', error);
      throw error;
    }
  }

  async searchUsers(query: string, filters?: any): Promise<User[]> {
    try {
      const response = await this.apiClient.post('/users/search', { query, filters });
      return response.data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }
}