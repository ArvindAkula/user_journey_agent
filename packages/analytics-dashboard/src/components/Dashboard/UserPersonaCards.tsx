import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '@aws-agent/shared';
import './UserPersonaCards.css';

interface UserPersona {
  id: string;
  name: string;
  description: string;
  avatar: string;
  behaviorProfile: {
    engagementLevel: 'low' | 'medium' | 'high';
    techSavviness: 'beginner' | 'intermediate' | 'advanced';
    riskProfile: 'low' | 'medium' | 'high';
    preferredContentType: string[];
    typicalStruggles: string[];
  };
  analytics: {
    totalSessions: number;
    averageSessionDuration: number;
    conversionRate: number;
    strugglesCount: number;
    lastActive: string;
    engagementTrend: 'increasing' | 'stable' | 'decreasing';
  };
}

interface UserPersonaCardsProps {
  selectedPersona: string | null;
  onPersonaSelect: (personaId: string) => void;
  filters?: any;
  realTimeData?: any;
}

interface AutomationState {
  isRunning: boolean;
  selectedPersona: string | null;
  currentStep: number;
  steps: string[];
}

const UserPersonaCards: React.FC<UserPersonaCardsProps> = ({
  selectedPersona,
  onPersonaSelect,
  filters,
  realTimeData
}) => {
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [automation, setAutomation] = useState<AutomationState>({
    isRunning: false,
    selectedPersona: null,
    currentStep: 0,
    steps: []
  });

  useEffect(() => {
    fetchPersonaAnalytics();
  }, [filters]);

  const startAutomation = (personaId: string) => {
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return;

    const steps = [
      'Follow Recommended Path',
      'Browse Getting Started',
      'Complete Video Series',
      'Take Notes (Pause/Replay)',
      'Practice Interactive Demo',
      'Progress to Next Level'
    ];

    setAutomation({
      isRunning: true,
      selectedPersona: personaId,
      currentStep: 0,
      steps
    });

    // Simulate automation progress
    let stepIndex = 0;
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        setAutomation(prev => ({ ...prev, isRunning: false }));
      } else {
        setAutomation(prev => ({ ...prev, currentStep: stepIndex }));
      }
    }, 2000);
  };

  const stopAutomation = () => {
    setAutomation({
      isRunning: false,
      selectedPersona: null,
      currentStep: 0,
      steps: []
    });
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'high': return '#28a745';
      case 'medium': return '#ffc107';
      case 'low': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return '#28a745';
      case 'medium': return '#ffc107';
      case 'high': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const fetchPersonaAnalytics = async () => {
    try {
      setIsLoading(true);
      
      // Mock data for demo - in real implementation, this would come from API
      const mockPersonas: UserPersona[] = [
        {
          id: 'sarah-new-user',
          name: 'Sarah - New User',
          description: 'First-time user, needs guidance and support',
          avatar: '👩',
          behaviorProfile: {
            engagementLevel: 'medium',
            techSavviness: 'beginner',
            riskProfile: 'high',
            preferredContentType: ['tutorials', 'getting-started'],
            typicalStruggles: ['navigation', 'document-upload', 'form-completion']
          },
          analytics: {
            totalSessions: 23,
            averageSessionDuration: 4.2,
            conversionRate: 12.5,
            strugglesCount: 8,
            lastActive: '2 hours ago',
            engagementTrend: 'increasing'
          }
        },
        {
          id: 'mike-power-user',
          name: 'Mike - Power User',
          description: 'Experienced user, high engagement, explores advanced features',
          avatar: '👨',
          behaviorProfile: {
            engagementLevel: 'high',
            techSavviness: 'advanced',
            riskProfile: 'low',
            preferredContentType: ['advanced-configuration', 'integration-issues'],
            typicalStruggles: ['advanced-configuration', 'integration-issues']
          },
          analytics: {
            totalSessions: 156,
            averageSessionDuration: 12.8,
            conversionRate: 78.3,
            strugglesCount: 2,
            lastActive: '30 minutes ago',
            engagementTrend: 'stable'
          }
        },
        {
          id: 'jenny-at-risk',
          name: 'Jenny - At Risk User',
          description: 'Showing signs of disengagement, potential churn risk',
          avatar: '👩‍🦱',
          behaviorProfile: {
            engagementLevel: 'low',
            techSavviness: 'intermediate',
            riskProfile: 'high',
            preferredContentType: ['motivation', 'value-realization'],
            typicalStruggles: ['motivation', 'value-realization', 'feature-discovery']
          },
          analytics: {
            totalSessions: 8,
            averageSessionDuration: 2.1,
            conversionRate: 5.2,
            strugglesCount: 15,
            lastActive: '3 days ago',
            engagementTrend: 'decreasing'
          }
        },
        {
          id: 'alex-engaged-learner',
          name: 'Alex - Engaged Learner',
          description: 'Highly engaged, follows recommended learning paths',
          avatar: '👨‍💻',
          behaviorProfile: {
            engagementLevel: 'high',
            techSavviness: 'intermediate',
            riskProfile: 'low',
            preferredContentType: ['advanced-concepts', 'best-practices'],
            typicalStruggles: ['advanced-concepts', 'best-practices']
          },
          analytics: {
            totalSessions: 89,
            averageSessionDuration: 9.7,
            conversionRate: 65.4,
            strugglesCount: 3,
            lastActive: '1 hour ago',
            engagementTrend: 'increasing'
          }
        }
      ];

      setPersonas(mockPersonas);
    } catch (error) {
      console.error('Failed to fetch persona analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="persona-cards-loading">
        <div className="loading-spinner"></div>
        <p>Loading persona analytics...</p>
      </div>
    );
  }

  return (
    <div className="user-persona-cards">
      <div className="personas-grid">
        {personas.map(persona => (
          <div
            key={persona.id}
            className={`persona-card ${selectedPersona === persona.id ? 'selected' : ''}`}
            onClick={() => onPersonaSelect(persona.id)}
          >
            <div className="persona-header">
              <div className="persona-avatar-section">
                <span className="persona-avatar">{persona.avatar}</span>
              </div>
              <div className="persona-info">
                <h4 className="persona-name">{persona.name}</h4>
                <p className="persona-description">{persona.description}</p>
              </div>
            </div>

            <div className="persona-metrics">
              <div className="metric-row">
                <span className="metric-label">Engagement:</span>
                <span 
                  className="metric-value"
                  style={{ color: getEngagementColor(persona.behaviorProfile.engagementLevel) }}
                >
                  {persona.behaviorProfile.engagementLevel.charAt(0).toUpperCase() + persona.behaviorProfile.engagementLevel.slice(1)}
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Tech Level:</span>
                <span className="metric-value">{persona.behaviorProfile.techSavviness}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Risk:</span>
                <span 
                  className="metric-value"
                  style={{ color: getRiskColor(persona.behaviorProfile.riskProfile) }}
                >
                  {persona.behaviorProfile.riskProfile.charAt(0).toUpperCase() + persona.behaviorProfile.riskProfile.slice(1)}
                </span>
              </div>
            </div>

            <div className="persona-struggles">
              <span className="struggles-label">Typical Struggles:</span>
              <ul className="struggles-list">
                {persona.behaviorProfile.typicalStruggles.map((struggle, index) => (
                  <li key={index}>{struggle}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Automation Section */}
      <div className="automation-section">
        <h3>Automated Behavior for {selectedPersona ? personas.find(p => p.id === selectedPersona)?.name.split(' - ')[0] : 'Alex'} - Engaged Learner</h3>
        
        <div className="automation-controls">
          {!automation.isRunning ? (
            <button 
              className="start-automation-btn"
              onClick={() => startAutomation(selectedPersona || 'alex-engaged-learner')}
            >
              Start Automation
            </button>
          ) : (
            <button 
              className="stop-automation-btn"
              onClick={stopAutomation}
            >
              Stop
            </button>
          )}
        </div>

        {automation.isRunning && (
          <div className="automation-progress">
            <div className="progress-steps">
              {automation.steps.map((step, index) => (
                <div 
                  key={index}
                  className={`progress-step ${index <= automation.currentStep ? 'completed' : ''} ${index === automation.currentStep ? 'active' : ''}`}
                >
                  <div className="step-indicator">
                    {index < automation.currentStep ? '✓' : index + 1}
                  </div>
                  <div className="step-content">
                    <span className="step-title">{step}</span>
                    {index === automation.currentStep && (
                      <span className="step-status">In Progress...</span>
                    )}
                    {index < automation.currentStep && (
                      <span className="step-status">Completed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPersonaCards;