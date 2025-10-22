import React, { useState, useEffect } from 'react';
import InteractiveCalculator from '../components/InteractiveCalculator';
import { useProductionEventTracking } from '../hooks/useProductionEventTracking';
import { useInterventionListener } from '../hooks/useInterventionListener';
import LiveChatPopup from '../components/LiveChatPopup';
import { firebaseAnalyticsService } from '../services/FirebaseAnalyticsService';

const CalculatorPage: React.FC = () => {
  const [calculationsCompleted, setCalculationsCompleted] = useState(0);
  const [strugglesDetected, setStrugglesDetected] = useState(0);
  const { trackPageView, trackFeatureInteraction, trackStruggleSignal, trackEvent, flushQueue } = useProductionEventTracking({
    batchSize: 1,  // Send immediately, don't wait for batch
    flushInterval: 1000  // Flush every 1 second
  });
  
  // Intervention listener for high-risk users
  const { showLiveChatPopup, interventionData, dismissIntervention } = useInterventionListener('anonymous');

  useEffect(() => {
    // Track page view when component mounts (AWS)
    trackPageView('calculator');
    console.log('📊 Tracked page view: calculator');
    
    // 🤖 TRIGGER AI ANALYSIS: Send pricing_page_view event
    console.log('🚀 [FRONTEND] Sending pricing_page_view event to backend...');
    console.log('🚀 [FRONTEND] Event data:', {
      eventType: 'pricing_page_view',
      page: '/calculator',
      action: 'viewed_calculator',
      feature: 'calculator'
    });
    
    trackEvent('pricing_page_view', {
      page: '/calculator',
      action: 'viewed_calculator',
      feature: 'calculator'
    });
    
    console.log('✅ [FRONTEND] pricing_page_view event queued for sending');
    
    // Force immediate flush for pricing_page_view events
    setTimeout(() => {
      console.log('🔄 [FRONTEND] Forcing immediate flush...');
      flushQueue();
    }, 100);
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackPageView('Calculator', { page_name: 'calculator' });
  }, [trackPageView, trackEvent, flushQueue]);

  const handleCalculationComplete = () => {
    setCalculationsCompleted(prev => prev + 1);
    
    // Track in AWS
    trackFeatureInteraction('calculator', 'calculation_complete', true);
    console.log('📊 Tracked calculation completion');
    
    // 🤖 TRIGGER AI ANALYSIS: Send pricing_page_view event for calculation
    console.log('🚀 [FRONTEND] Sending pricing_page_view event (calculation) to backend...');
    console.log('🚀 [FRONTEND] Event data:', {
      eventType: 'pricing_page_view',
      page: '/calculator',
      action: 'calculated_loan',
      feature: 'calculator',
      calculationsCompleted: calculationsCompleted + 1
    });
    
    trackEvent('pricing_page_view', {
      page: '/calculator',
      action: 'calculated_loan',
      feature: 'calculator',
      calculationsCompleted: calculationsCompleted + 1
    });
    
    console.log('✅ [FRONTEND] pricing_page_view event (calculation) queued for sending');
    
    // Force immediate flush for pricing_page_view events
    setTimeout(() => {
      console.log('🔄 [FRONTEND] Forcing immediate flush...');
      flushQueue();
    }, 100);
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackCalculatorEvent('calculation_complete', {
      calculationType: 'loan_calculator',
      success: true
    });
  };

  const handleStruggleDetected = () => {
    setStrugglesDetected(prev => prev + 1);
    
    // Track in AWS
    trackStruggleSignal('calculator_struggle', { feature: 'calculator' });
    console.log('📊 Tracked struggle signal');
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackStruggleSignal('calculator', {
      attemptCount: strugglesDetected + 1,
      timeSpent: 0,
      severity: 'medium'
    });
  };

  return (
    <div className="calculator-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <InteractiveCalculator
        onCalculationComplete={handleCalculationComplete}
        onStruggleDetected={handleStruggleDetected}
      />
      
      {/* Live Chat Popup - Shows when exit risk > 70 */}
      {showLiveChatPopup && interventionData && (
        <LiveChatPopup
          userId="anonymous"
          riskScore={interventionData.payload.riskScore}
          context={interventionData.payload.context}
          onClose={dismissIntervention}
          onAccept={() => {
            console.log('User accepted live chat offer');
            trackEvent('user_action', { action: 'live_chat_accepted' });
            dismissIntervention();
          }}
        />
      )}
    </div>
  );
};

export default CalculatorPage;