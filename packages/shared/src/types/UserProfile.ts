export interface InterventionRecord {
  interventionId: string;
  triggeredAt: Date;
  interventionType: 'tooltip' | 'tutorial' | 'notification' | 'live_chat' | 'phone_outreach';
  context: string;
  effectiveness?: 'resolved' | 'partially_resolved' | 'not_resolved';
  userResponse?: string;
}

export interface UserProfile {
  userId: string;
  createdAt: Date;
  lastActiveAt: Date;
  userSegment: 'new_user' | 'active_user' | 'at_risk' | 'churned';
  preferences: {
    contentCategories: string[];
    videoTopics: string[];
    preferredInteractionStyle: 'guided' | 'self_service' | 'assisted';
  };
  behaviorMetrics: {
    totalSessions: number;
    avgSessionDuration: number;
    featureAdoptionRate: number;
    supportInteractionCount: number;
  };
  riskFactors: {
    exitRiskScore: number;
    lastRiskAssessment: Date;
    riskContributors: string[];
  };
  interventionHistory: InterventionRecord[];
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string; // Full name, can be derived from firstName + lastName
  persona?: UserPersona;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserPersona {
  id: string;
  name: string;
  description: string;
  behaviorPattern: 'engaged' | 'struggling' | 'explorer' | 'impatient';
  preferredContent: string[];
  struggleTriggers: string[];
  videoPreferences: {
    preferredDuration: 'short' | 'medium' | 'long';
    topics: string[];
    completionRate: number;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  name?: string; // Optional, can be derived from firstName + lastName
  persona?: UserPersona;
}