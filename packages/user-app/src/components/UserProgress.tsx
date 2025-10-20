import React, { useEffect } from 'react';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../config';
import './UserProgress.css';

interface UserProgressProps {
  progress: {
    videosWatched: number;
    calculationsCompleted: number;
    documentsUploaded: number;
    strugglesEncountered: number;
  };
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  requirement: number;
  current: number;
}

const UserProgress: React.FC<UserProgressProps> = ({ progress }) => {
  // Create event service instance
  const eventService = new EventService({
    baseURL: config.apiBaseUrl,
    timeout: 5000,
    batchSize: 10,
    flushInterval: 5000
  });

  const { trackFeatureInteraction } = useEventTracking({
    eventService,
    userId: 'demo-user',
    sessionId: `demo-session-${Date.now()}`
  });

  useEffect(() => {
    // Track when user views their progress
    trackFeatureInteraction('user_progress_view', true, {
      attemptCount: 1,
      userContext: {
        deviceType: 'desktop',
        browserInfo: navigator.userAgent,
        persona: 'demo-user',
        userSegment: 'demo',
        sessionStage: 'active',
        previousActions: []
      },
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: 'Browser'
      }
    });
  }, [trackFeatureInteraction]);

  const achievements: Achievement[] = [
    {
      id: 'first-video',
      title: 'Video Learner',
      description: 'Watch your first video',
      icon: '🎬',
      unlocked: progress.videosWatched >= 1,
      requirement: 1,
      current: progress.videosWatched
    },
    {
      id: 'video-enthusiast',
      title: 'Video Enthusiast',
      description: 'Watch 5 videos',
      icon: '📺',
      unlocked: progress.videosWatched >= 5,
      requirement: 5,
      current: progress.videosWatched
    },
    {
      id: 'calculator-user',
      title: 'Calculator Pro',
      description: 'Complete 3 calculations',
      icon: '🧮',
      unlocked: progress.calculationsCompleted >= 3,
      requirement: 3,
      current: progress.calculationsCompleted
    },
    {
      id: 'document-manager',
      title: 'Document Manager',
      description: 'Upload 5 documents',
      icon: '📄',
      unlocked: progress.documentsUploaded >= 5,
      requirement: 5,
      current: progress.documentsUploaded
    },
    {
      id: 'persistent-learner',
      title: 'Persistent Learner',
      description: 'Overcome 3 struggles',
      icon: '💪',
      unlocked: progress.strugglesEncountered >= 3,
      requirement: 3,
      current: progress.strugglesEncountered
    }
  ];

  const totalEngagement = progress.videosWatched + progress.calculationsCompleted + progress.documentsUploaded;
  const engagementLevel = totalEngagement < 5 ? 'Getting Started' : 
                         totalEngagement < 15 ? 'Active User' : 'Power User';
  
  const riskScore = Math.max(0, 100 - (totalEngagement * 10) + (progress.strugglesEncountered * 15));
  const riskLevel = riskScore < 30 ? 'Low' : riskScore < 70 ? 'Medium' : 'High';

  const unlockedAchievements = achievements.filter(a => a.unlocked).length;

  return (
    <div className="user-progress">
      <div className="progress-header">
        <h2>Your Progress</h2>
        <p>Track your learning journey and achievements</p>
      </div>

      <div className="user-info-card">
        <div className="user-details">
          <h3>Demo User</h3>
          <p className="user-email">demo@example.com</p>
          <div className="user-meta">
            <span>Member since: Today</span>
            <span>Last active: Now</span>
          </div>
        </div>
        
        <div className="persona-info">
          <h4>Current Persona</h4>
          <div className="persona-card">
            <div className="persona-header">
              <span className="persona-name">Demo User</span>
            </div>
            <p className="persona-description">
              Exploring the platform and learning about user journey analytics
            </p>
          </div>
        </div>
      </div>

      <div className="analytics-section">
        <h3>Analytics Overview</h3>
        <div className="analytics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <h4>Engagement Level</h4>
              <span className={`score ${engagementLevel.toLowerCase().replace(' ', '-')}`}>
                {engagementLevel}
              </span>
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill engagement" 
                style={{ width: `${Math.min(100, (totalEngagement / 20) * 100)}%` }}
              />
            </div>
            <p className="metric-description">
              Based on your activity across videos, calculations, and document uploads
            </p>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <h4>Exit Risk</h4>
              <span className={`score ${riskLevel.toLowerCase()}-risk`}>
                {riskLevel}
              </span>
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill risk" 
                style={{ width: `${riskScore}%` }}
              />
            </div>
            <p className="metric-description">
              Likelihood of disengagement based on usage patterns and struggles
            </p>
          </div>
        </div>
      </div>

      <div className="activity-summary">
        <h3>Activity Summary</h3>
        <div className="activity-grid">
          <div className="activity-item">
            <div className="activity-icon">🎬</div>
            <div className="activity-details">
              <span className="activity-count">{progress.videosWatched}</span>
              <span className="activity-label">Videos Watched</span>
            </div>
          </div>
          
          <div className="activity-item">
            <div className="activity-icon">🧮</div>
            <div className="activity-details">
              <span className="activity-count">{progress.calculationsCompleted}</span>
              <span className="activity-label">Calculations</span>
            </div>
          </div>
          
          <div className="activity-item">
            <div className="activity-icon">📄</div>
            <div className="activity-details">
              <span className="activity-count">{progress.documentsUploaded}</span>
              <span className="activity-label">Documents</span>
            </div>
          </div>
          
          <div className="activity-item">
            <div className="activity-icon">⚠️</div>
            <div className="activity-details">
              <span className="activity-count">{progress.strugglesEncountered}</span>
              <span className="activity-label">Struggles</span>
            </div>
          </div>
        </div>
      </div>

      <div className="achievements-section">
        <h3>Achievements ({unlockedAchievements}/{achievements.length})</h3>
        <div className="achievements-grid">
          {achievements.map(achievement => (
            <div key={achievement.id} className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
              <div className="achievement-icon">{achievement.icon}</div>
              <div className="achievement-details">
                <h4 className="achievement-title">{achievement.title}</h4>
                <p className="achievement-description">{achievement.description}</p>
                <div className="achievement-progress">
                  Progress: {Math.min(achievement.current, achievement.requirement)}/{achievement.requirement}
                </div>
              </div>
              {achievement.unlocked && <div className="achievement-badge">✓</div>}
            </div>
          ))}
        </div>
        
        <div className="achievements-summary">
          <p>
            Keep exploring to unlock more achievements! Complete activities to improve your engagement score.
          </p>
        </div>
      </div>


    </div>
  );
};

export default UserProgress;