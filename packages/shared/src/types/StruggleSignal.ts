export interface StruggleSignal {
  userId: string;
  featureId: string;
  detectedAt: Date;
  signalType: 'repeated_attempts' | 'error_pattern' | 'abandonment' | 'help_seeking';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: {
    attemptCount: number;
    timeSpent: number;
    errorsEncountered: string[];
    userActions: string[];
  };
  interventionTriggered: boolean;
  interventionType?: string;
  resolved: boolean;
  resolutionTime?: number;
  sessionId: string;
}

export interface StrugglePattern {
  featureId: string;
  commonErrors: string[];
  avgAttemptCount: number;
  successfulInterventions: string[];
  resolutionRate: number;
}