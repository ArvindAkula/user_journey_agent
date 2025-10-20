import { UserService } from '../UserService';
import { UserProfile } from '../../types/UserProfile';

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

describe('UserService', () => {
  let userService: UserService;
  let mockAxios: any;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
    mockAxios = (userService as any).api;
  });

  describe('getUserProfile', () => {
    it('fetches user profile successfully', async () => {
      const mockProfile: UserProfile = {
        id: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        persona: 'beginner',
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en'
        },
        createdAt: new Date('2023-01-01'),
        lastLoginAt: new Date('2023-01-15')
      };
      
      mockAxios.get.mockResolvedValue({ data: mockProfile });

      const result = await userService.getUserProfile('user123');
      
      expect(mockAxios.get).toHaveBeenCalledWith('/users/user123');
      expect(result).toEqual(mockProfile);
    });

    it('handles user not found error', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'User not found' }
        }
      };
      mockAxios.get.mockRejectedValue(error);

      await expect(userService.getUserProfile('nonexistent'))
        .rejects.toThrow();
    });
  });

  describe('updateUserProfile', () => {
    it('updates user profile successfully', async () => {
      const userId = 'user123';
      const updates = {
        displayName: 'Updated Name',
        persona: 'advanced' as const,
        preferences: {
          theme: 'dark' as const,
          notifications: false,
          language: 'es'
        }
      };
      
      const updatedProfile: UserProfile = {
        id: userId,
        email: 'test@example.com',
        ...updates,
        createdAt: new Date('2023-01-01'),
        lastLoginAt: new Date('2023-01-15')
      };
      
      mockAxios.put.mockResolvedValue({ data: updatedProfile });

      const result = await userService.updateUserProfile(userId, updates);
      
      expect(mockAxios.put).toHaveBeenCalledWith(`/users/${userId}`, updates);
      expect(result).toEqual(updatedProfile);
    });

    it('handles validation errors', async () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Invalid profile data' }
        }
      };
      mockAxios.put.mockRejectedValue(error);

      await expect(userService.updateUserProfile('user123', {}))
        .rejects.toThrow();
    });
  });

  describe('createUserProfile', () => {
    it('creates new user profile successfully', async () => {
      const profileData = {
        id: 'newuser123',
        email: 'newuser@example.com',
        displayName: 'New User',
        persona: 'beginner' as const
      };
      
      const createdProfile: UserProfile = {
        ...profileData,
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en'
        },
        createdAt: new Date(),
        lastLoginAt: new Date()
      };
      
      mockAxios.post.mockResolvedValue({ data: createdProfile });

      const result = await userService.createUserProfile(profileData);
      
      expect(mockAxios.post).toHaveBeenCalledWith('/users', profileData);
      expect(result).toEqual(createdProfile);
    });

    it('handles duplicate user error', async () => {
      const error = {
        response: {
          status: 409,
          data: { message: 'User already exists' }
        }
      };
      mockAxios.post.mockRejectedValue(error);

      const profileData = {
        id: 'existing123',
        email: 'existing@example.com',
        displayName: 'Existing User',
        persona: 'beginner' as const
      };

      await expect(userService.createUserProfile(profileData))
        .rejects.toThrow();
    });
  });

  describe('deleteUserProfile', () => {
    it('deletes user profile successfully', async () => {
      mockAxios.delete.mockResolvedValue({ data: { success: true } });

      await userService.deleteUserProfile('user123');
      
      expect(mockAxios.delete).toHaveBeenCalledWith('/users/user123');
    });

    it('handles user not found during deletion', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'User not found' }
        }
      };
      mockAxios.delete.mockRejectedValue(error);

      await expect(userService.deleteUserProfile('nonexistent'))
        .rejects.toThrow();
    });
  });

  describe('getUserProgress', () => {
    it('fetches user progress successfully', async () => {
      const mockProgress = {
        userId: 'user123',
        completedFeatures: ['calculator', 'video_library'],
        totalInteractions: 150,
        strugglesResolved: 5,
        lastActivity: new Date('2023-01-15'),
        progressPercentage: 0.75
      };
      
      mockAxios.get.mockResolvedValue({ data: mockProgress });

      const result = await userService.getUserProgress('user123');
      
      expect(mockAxios.get).toHaveBeenCalledWith('/users/user123/progress');
      expect(result).toEqual(mockProgress);
    });
  });

  describe('updateUserProgress', () => {
    it('updates user progress successfully', async () => {
      const userId = 'user123';
      const progressUpdate = {
        feature: 'document_upload',
        completed: true,
        interactions: 10
      };
      
      const updatedProgress = {
        userId,
        completedFeatures: ['calculator', 'video_library', 'document_upload'],
        totalInteractions: 160,
        strugglesResolved: 5,
        lastActivity: new Date(),
        progressPercentage: 0.85
      };
      
      mockAxios.post.mockResolvedValue({ data: updatedProgress });

      const result = await userService.updateUserProgress(userId, progressUpdate);
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        `/users/${userId}/progress`,
        progressUpdate
      );
      expect(result).toEqual(updatedProgress);
    });
  });

  describe('getUserPreferences', () => {
    it('fetches user preferences successfully', async () => {
      const mockPreferences = {
        theme: 'dark' as const,
        notifications: true,
        language: 'en',
        autoSave: true,
        analyticsOptIn: false
      };
      
      mockAxios.get.mockResolvedValue({ data: mockPreferences });

      const result = await userService.getUserPreferences('user123');
      
      expect(mockAxios.get).toHaveBeenCalledWith('/users/user123/preferences');
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('updateUserPreferences', () => {
    it('updates user preferences successfully', async () => {
      const userId = 'user123';
      const preferences = {
        theme: 'dark' as const,
        notifications: false,
        language: 'es'
      };
      
      mockAxios.put.mockResolvedValue({ data: preferences });

      const result = await userService.updateUserPreferences(userId, preferences);
      
      expect(mockAxios.put).toHaveBeenCalledWith(
        `/users/${userId}/preferences`,
        preferences
      );
      expect(result).toEqual(preferences);
    });
  });

  describe('error handling', () => {
    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      mockAxios.get.mockRejectedValue(networkError);

      await expect(userService.getUserProfile('user123'))
        .rejects.toThrow('Network Error');
    });

    it('handles unauthorized errors', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      mockAxios.get.mockRejectedValue(error);

      await expect(userService.getUserProfile('user123'))
        .rejects.toThrow();
    });

    it('handles server errors', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      };
      mockAxios.get.mockRejectedValue(error);

      await expect(userService.getUserProfile('user123'))
        .rejects.toThrow();
    });
  });
});