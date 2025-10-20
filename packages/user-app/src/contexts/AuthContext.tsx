import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth, getFirebaseErrorMessage, isFirebaseConfigured } from '../config/firebase';
import { AuthService } from '@aws-agent/shared';
import { User, AuthState, LoginCredentials, RegisterData } from '@aws-agent/shared';
import config from '../config';

interface AuthContextType {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  firebaseUser: FirebaseUser | null;
  isFirebaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize AuthService
const authService = new AuthService({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
  tokenStorageKey: 'user_app_auth_token'
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // In development mode, start with isLoading: false to avoid hanging
  const initialState = config.environment === 'development' 
    ? { isAuthenticated: false, user: null, isLoading: false, error: null }
    : authService.getAuthState();
    
  const [authState, setAuthState] = useState<AuthState>(initialState);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    // Listen to AuthService state changes
    const unsubscribeAuthService = authService.onAuthStateChange((state) => {
      setAuthState(state);
    });

    // Listen to Firebase auth state changes (only if Firebase is available)
    let unsubscribeFirebase = () => {};
    if (auth && isFirebaseConfigured()) {
      unsubscribeFirebase = onAuthStateChanged(auth, async (user) => {
        setFirebaseUser(user);
        
        // In production, sync Firebase auth state with backend
        if (config.environment === 'production' && user) {
          try {
            // Get fresh ID token and sync with backend
            const idToken = await user.getIdToken(true);
            // This could trigger a backend sync if needed
            console.log('Firebase user authenticated, token refreshed');
          } catch (error) {
            console.error('Error refreshing Firebase token:', error);
          }
        }
      });
    } else if (config.environment === 'development') {
      // In development mode without Firebase, create a mock user
      const mockUser = {
        uid: 'dev-user-123',
        email: 'dev@example.com',
        displayName: 'Development User'
      } as FirebaseUser;
      setFirebaseUser(mockUser);
      
      // Set auth state to not loading since we're in dev mode
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
    }

    return () => {
      unsubscribeAuthService();
      unsubscribeFirebase();
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    try {
      if (auth && isFirebaseConfigured()) {
        // Production mode: authenticate with Firebase first
        const firebaseCredential = await signInWithEmailAndPassword(
          auth, 
          credentials.email, 
          credentials.password
        );
        
        // Get Firebase ID token
        const idToken = await firebaseCredential.user.getIdToken();
        
        // Then authenticate with our backend using the Firebase token
        const user = await authService.login({
          ...credentials,
          firebaseToken: idToken
        } as any);
        
        return user;
      } else {
        // Development mode: skip Firebase and use mock authentication
        console.log('Development mode: skipping Firebase authentication');
        const mockUser: User = {
          id: 'dev-user-123',
          email: credentials.email,
          firstName: 'Development',
          lastName: 'User',
          name: 'Development User',
          createdAt: new Date(),
          lastLoginAt: new Date()
        };
        
        // Update auth state to logged in
        setAuthState({
          isAuthenticated: true,
          user: mockUser,
          isLoading: false,
          error: null
        });
        
        return mockUser;
      }
    } catch (error: any) {
      // If Firebase auth fails, throw the error
      if (error.code) {
        throw new Error(getFirebaseErrorMessage(error.code));
      }
      throw error;
    }
  };

  const register = async (data: RegisterData): Promise<User> => {
    try {
      if (auth && isFirebaseConfigured()) {
        // Production mode: create user in Firebase first
        const firebaseCredential = await createUserWithEmailAndPassword(
          auth,
          data.email,
          data.password
        );
        
        // Get Firebase ID token
        const idToken = await firebaseCredential.user.getIdToken();
        
        // Then register with our backend
        const user = await authService.register({
          ...data,
          firebaseToken: idToken
        } as any);
        
        return user;
      } else {
        // Development mode: skip Firebase and use mock registration
        console.log('Development mode: skipping Firebase registration');
        const mockUser: User = {
          id: 'dev-user-123',
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          name: data.name || `${data.firstName} ${data.lastName}`,
          createdAt: new Date(),
          lastLoginAt: new Date()
        };
        
        // Update auth state to logged in
        setAuthState({
          isAuthenticated: true,
          user: mockUser,
          isLoading: false,
          error: null
        });
        
        return mockUser;
      }
    } catch (error: any) {
      // If Firebase registration fails, throw the error
      if (error.code) {
        throw new Error(getFirebaseErrorMessage(error.code));
      }
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (auth && isFirebaseConfigured()) {
        // Production mode: logout from Firebase
        await signOut(auth);
        
        // Logout from our backend
        await authService.logout();
      } else {
        // Development mode: just clear local state
        console.log('Development mode: clearing mock authentication');
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null
        });
        setFirebaseUser(null);
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if logout fails, clear local state
      if (auth && isFirebaseConfigured()) {
        await authService.logout();
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null
        });
        setFirebaseUser(null);
      }
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    if (!auth || !isFirebaseConfigured()) {
      throw new Error('Password reset is not available in development mode');
    }

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      if (error.code) {
        throw new Error(getFirebaseErrorMessage(error.code));
      }
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!auth || !isFirebaseConfigured() || !firebaseUser) {
      throw new Error('Password change is not available');
    }

    try {
      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(firebaseUser.email!, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      
      // Update password
      await updatePassword(firebaseUser, newPassword);
    } catch (error: any) {
      if (error.code) {
        throw new Error(getFirebaseErrorMessage(error.code));
      }
      throw error;
    }
  };

  const refreshToken = async (): Promise<void> => {
    if (auth && isFirebaseConfigured() && firebaseUser) {
      try {
        // Force refresh Firebase token
        await firebaseUser.getIdToken(true);
        
        // Refresh backend token
        await authService.refreshToken();
      } catch (error) {
        console.error('Error refreshing tokens:', error);
        throw error;
      }
    } else if (config.environment === 'development') {
      // In development, just refresh backend token
      await authService.refreshToken();
    }
  };

  const value: AuthContextType = {
    authState,
    login,
    register,
    logout,
    resetPassword,
    changePassword,
    refreshToken,
    firebaseUser,
    isFirebaseConfigured: isFirebaseConfigured()
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Note: getFirebaseErrorMessage is now imported from firebase config