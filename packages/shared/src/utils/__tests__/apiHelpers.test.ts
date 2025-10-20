import {
  createApiClient,
  handleApiError,
  buildQueryParams,
  formatApiResponse,
  retryRequest,
  isNetworkError,
  getErrorMessage
} from '../apiHelpers';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  }))
}));

describe('API Helpers', () => {
  describe('createApiClient', () => {
    it('creates axios instance with default config', () => {
      const client = createApiClient();
      expect(client).toBeDefined();
    });

    it('creates axios instance with custom config', () => {
      const config = {
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Authorization': 'Bearer token123'
        }
      };
      
      const client = createApiClient(config);
      expect(client).toBeDefined();
    });

    it('sets up request interceptors', () => {
      const client = createApiClient();
      expect(client.interceptors.request.use).toHaveBeenCalled();
    });

    it('sets up response interceptors', () => {
      const client = createApiClient();
      expect(client.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('handleApiError', () => {
    it('handles network errors', () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      
      const result = handleApiError(networkError);
      expect(result.type).toBe('network');
      expect(result.message).toBe('Network Error');
    });

    it('handles 400 errors', () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Bad Request' }
        }
      };
      
      const result = handleApiError(error);
      expect(result.type).toBe('client');
      expect(result.status).toBe(400);
      expect(result.message).toBe('Bad Request');
    });

    it('handles 401 errors', () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      
      const result = handleApiError(error);
      expect(result.type).toBe('auth');
      expect(result.status).toBe(401);
      expect(result.message).toBe('Unauthorized');
    });

    it('handles 500 errors', () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' }
        }
      };
      
      const result = handleApiError(error);
      expect(result.type).toBe('server');
      expect(result.status).toBe(500);
      expect(result.message).toBe('Internal Server Error');
    });

    it('handles unknown errors', () => {
      const error = new Error('Unknown error');
      
      const result = handleApiError(error);
      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Unknown error');
    });
  });

  describe('buildQueryParams', () => {
    it('builds query params from object', () => {
      const params = {
        page: 1,
        limit: 10,
        search: 'test query'
      };
      
      const result = buildQueryParams(params);
      expect(result).toBe('page=1&limit=10&search=test%20query');
    });

    it('handles array values', () => {
      const params = {
        tags: ['javascript', 'react', 'testing']
      };
      
      const result = buildQueryParams(params);
      expect(result).toBe('tags=javascript&tags=react&tags=testing');
    });

    it('skips null and undefined values', () => {
      const params = {
        page: 1,
        search: null,
        filter: undefined,
        active: true
      };
      
      const result = buildQueryParams(params);
      expect(result).toBe('page=1&active=true');
    });

    it('handles empty object', () => {
      const result = buildQueryParams({});
      expect(result).toBe('');
    });

    it('handles boolean values', () => {
      const params = {
        active: true,
        deleted: false
      };
      
      const result = buildQueryParams(params);
      expect(result).toBe('active=true&deleted=false');
    });

    it('handles date values', () => {
      const date = new Date('2023-01-15T10:00:00Z');
      const params = {
        startDate: date
      };
      
      const result = buildQueryParams(params);
      expect(result).toBe('startDate=2023-01-15T10%3A00%3A00.000Z');
    });
  });

  describe('formatApiResponse', () => {
    it('formats successful response', () => {
      const response = {
        data: { id: 1, name: 'Test' },
        status: 200,
        statusText: 'OK'
      };
      
      const result = formatApiResponse(response);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Test' });
      expect(result.status).toBe(200);
    });

    it('formats error response', () => {
      const response = {
        data: { error: 'Not found' },
        status: 404,
        statusText: 'Not Found'
      };
      
      const result = formatApiResponse(response);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not found');
      expect(result.status).toBe(404);
    });

    it('handles response without data', () => {
      const response = {
        status: 204,
        statusText: 'No Content'
      };
      
      const result = formatApiResponse(response);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.status).toBe(204);
    });
  });

  describe('retryRequest', () => {
    it('succeeds on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retryRequest(mockFn, 3, 100);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await retryRequest(mockFn, 3, 10);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('fails after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retryRequest(mockFn, 2, 10)).rejects.toThrow('Always fails');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('waits between retries', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const start = Date.now();
      await retryRequest(mockFn, 2, 50);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('isNetworkError', () => {
    it('identifies network errors', () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      
      expect(isNetworkError(networkError)).toBe(true);
    });

    it('identifies timeout errors', () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      
      expect(isNetworkError(timeoutError)).toBe(true);
    });

    it('identifies connection errors', () => {
      const connectionError = new Error('connect ECONNREFUSED');
      
      expect(isNetworkError(connectionError)).toBe(true);
    });

    it('does not identify API errors as network errors', () => {
      const apiError = {
        response: {
          status: 400,
          data: { message: 'Bad Request' }
        }
      };
      
      expect(isNetworkError(apiError)).toBe(false);
    });

    it('does not identify generic errors as network errors', () => {
      const genericError = new Error('Something went wrong');
      
      expect(isNetworkError(genericError)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('extracts message from error response', () => {
      const error = {
        response: {
          data: { message: 'Custom error message' }
        }
      };
      
      expect(getErrorMessage(error)).toBe('Custom error message');
    });

    it('extracts error from error response', () => {
      const error = {
        response: {
          data: { error: 'Custom error' }
        }
      };
      
      expect(getErrorMessage(error)).toBe('Custom error');
    });

    it('uses error message property', () => {
      const error = new Error('Direct error message');
      
      expect(getErrorMessage(error)).toBe('Direct error message');
    });

    it('uses default message for unknown errors', () => {
      const error = {};
      
      expect(getErrorMessage(error)).toBe('An unexpected error occurred');
    });

    it('handles string errors', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('handles null/undefined errors', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
    });
  });
});