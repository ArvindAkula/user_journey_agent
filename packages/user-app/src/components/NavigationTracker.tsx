import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { firebaseAnalyticsService } from '../services/FirebaseAnalyticsService';

/**
 * NavigationTracker Component
 * 
 * Tracks navigation events and page views using Firebase Analytics
 */
const NavigationTracker: React.FC = () => {
  const location = useLocation();
  const previousPath = useRef<string>('');

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Track navigation if not the first page load
    if (previousPath.current && previousPath.current !== currentPath) {
      firebaseAnalyticsService.trackNavigation(previousPath.current, currentPath, {
        search: location.search,
        hash: location.hash
      });
    }
    
    // Update previous path
    previousPath.current = currentPath;
  }, [location]);

  return null; // This component doesn't render anything
};

export default NavigationTracker;
