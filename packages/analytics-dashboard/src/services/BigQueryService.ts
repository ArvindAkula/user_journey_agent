import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

/**
 * BigQuery Service
 * 
 * Provides methods to query historical analytics data from BigQuery
 * through the backend API. This enables cost-effective long-term
 * analytics queries while keeping real-time data on DynamoDB.
 */
class BigQueryService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/bigquery`;
  }

  /**
   * Get authentication headers with JWT token
   */
  private getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Check if BigQuery is available
   */
  async checkStatus(): Promise<{ available: boolean; message: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/status`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error checking BigQuery status:', error);
      return { available: false, message: 'Failed to check BigQuery status' };
    }
  }

  /**
   * Get historical events for a user
   */
  async getUserHistoricalEvents(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/events/user/${userId}`,
        {
          ...this.getAuthHeaders(),
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching user historical events:', error);
      throw error;
    }
  }

  /**
   * Analyze user journey
   */
  async analyzeUserJourney(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/journey/user/${userId}`,
        {
          ...this.getAuthHeaders(),
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error analyzing user journey:', error);
      throw error;
    }
  }

  /**
   * Get event count aggregations
   */
  async getEventAggregations(
    startDate: string,
    endDate: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/events/aggregations`,
        {
          ...this.getAuthHeaders(),
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching event aggregations:', error);
      throw error;
    }
  }

  /**
   * Get calculator statistics
   */
  async getCalculatorStatistics(
    startDate: string,
    endDate: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/calculator/statistics`,
        {
          ...this.getAuthHeaders(),
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching calculator statistics:', error);
      throw error;
    }
  }

  /**
   * Get video engagement metrics
   */
  async getVideoEngagementMetrics(
    startDate: string,
    endDate: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/video/engagement`,
        {
          ...this.getAuthHeaders(),
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching video engagement metrics:', error);
      throw error;
    }
  }

  /**
   * Format date for API calls (YYYY-MM-DD)
   */
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get date range for common periods
   */
  getDateRange(period: 'last7days' | 'last30days' | 'last90days' | 'lastYear'): { startDate: string; endDate: string } {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'last7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'lastYear':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  }
}

// Export singleton instance
export const bigQueryService = new BigQueryService();
export default bigQueryService;
