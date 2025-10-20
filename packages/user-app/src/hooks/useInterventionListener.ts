import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';

interface InterventionEvent {
  type: string;
  action: string;
  userId: string;
  payload: {
    interventionType: string;
    riskLevel: string;
    riskScore: number;
    context: any;
  };
}

interface UseInterventionListenerReturn {
  showLiveChatPopup: boolean;
  interventionData: InterventionEvent | null;
  dismissIntervention: () => void;
}

/**
 * Hook to listen for intervention events and trigger UI actions
 * In production, this would connect to WebSocket or SNS for real-time events
 */
export const useInterventionListener = (userId: string): UseInterventionListenerReturn => {
  const [showLiveChatPopup, setShowLiveChatPopup] = useState(false);
  const [interventionData, setInterventionData] = useState<InterventionEvent | null>(null);

  console.log('[useInterventionListener] Hook initialized with userId:', userId);

  // Simulate listening for intervention events
  // In production, replace this with actual WebSocket/SNS connection
  useEffect(() => {
    console.log('[useInterventionListener] useEffect triggered, userId:', userId);
    if (!userId) {
      console.log('[useInterventionListener] ❌ No userId provided, polling disabled');
      return;
    }

    // Poll for interventions (in production, use WebSocket)
    const checkForInterventions = async () => {
      try {
        console.log(`[Intervention] Polling for user: ${userId}, URL: ${config.apiBaseUrl}/interventions/${userId}/pending`);
        const response = await fetch(
          `${config.apiBaseUrl}/interventions/${userId}/pending`
        );
        
        console.log(`[Intervention] Response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Intervention] Response data:', data);
          
          if (data.hasPendingIntervention && data.intervention) {
            console.log('[Intervention] ✅ Pending intervention found! Showing popup...');
            handleInterventionEvent(data.intervention);
          } else {
            console.log('[Intervention] No pending interventions');
          }
        }
      } catch (error) {
        console.error('[Intervention] Error checking for interventions:', error);
      }
    };

    // Check every 10 seconds (in production, use WebSocket for real-time)
    const intervalId = setInterval(checkForInterventions, 10000);
    
    // Check immediately on mount
    checkForInterventions();

    return () => clearInterval(intervalId);
  }, [userId]);

  const handleInterventionEvent = useCallback((event: InterventionEvent) => {
    console.log('Intervention event received:', event);
    
    if (event.action === 'show_live_chat_popup') {
      setInterventionData(event);
      setShowLiveChatPopup(true);
      
      // Log intervention display
      logInterventionDisplay(event);
    }
  }, []);

  const dismissIntervention = useCallback(() => {
    setShowLiveChatPopup(false);
    
    // Log intervention dismissal
    if (interventionData) {
      logInterventionDismissal(interventionData);
    }
    
    // Clear after animation
    setTimeout(() => {
      setInterventionData(null);
    }, 300);
  }, [interventionData]);

  const logInterventionDisplay = (event: InterventionEvent) => {
    try {
      fetch(`${config.apiBaseUrl}/interventions/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: event.userId,
          interventionType: event.payload.interventionType,
          action: 'displayed',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error logging intervention display:', error);
    }
  };

  const logInterventionDismissal = (event: InterventionEvent) => {
    try {
      fetch(`${config.apiBaseUrl}/interventions/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: event.userId,
          interventionType: event.payload.interventionType,
          action: 'dismissed',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error logging intervention dismissal:', error);
    }
  };

  return {
    showLiveChatPopup,
    interventionData,
    dismissIntervention
  };
};
