import { TimeRange } from './UserEvent';

export interface VideoEngagement {
  userId: string;
  videoId: string;
  engagementData: {
    viewCount: number;
    totalWatchTime: number;
    completionRate: number;
    segmentsReplayed: TimeRange[];
    pausePoints: number[];
    skipSegments: TimeRange[];
    playbackSpeed: number;
  };
  contextData: {
    accessedFrom: string;
    deviceType: string;
    sessionStage: string;
    postViewActions: string[];
  };
  intelligenceMetrics: {
    interestScore: number;
    comprehensionIndicators: string[];
    readinessSignals: string[];
  };
  timestamp: Date;
  sessionId: string;
}