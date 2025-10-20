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

export enum UserRole {
  ADMIN = 'ADMIN',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER'
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: Date;
  lastLoginAt?: Date;
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