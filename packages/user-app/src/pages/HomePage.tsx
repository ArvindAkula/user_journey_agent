import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@aws-agent/shared';
import { useProductionEventTracking } from '../hooks/useProductionEventTracking';
import { firebaseAnalyticsService } from '../services/FirebaseAnalyticsService';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { trackPageView, trackFeatureInteraction } = useProductionEventTracking();

  useEffect(() => {
    // Track page view when component mounts (AWS)
    trackPageView('home');
    console.log('📊 Tracked page view: home');
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackPageView('Home Page', { page_name: 'home' });
  }, [trackPageView]);

  const handleFeatureClick = (feature: string) => {
    // Track in AWS
    trackFeatureInteraction(feature, 'click', true);
    console.log(`📊 Tracked feature interaction: ${feature}`);
    
    // Also track in Firebase Analytics
    firebaseAnalyticsService.trackFeatureInteraction(feature, 'click', { success: true });
  };

  return (
    <div className="home-page">
      <section className="hero-section">
        <h1>Welcome to Mortgage Agent</h1>
        <p className="hero-subtitle">
          Your intelligent mortgage assistant with advanced analytics and interactive tools
        </p>
        <div className="hero-actions">
          <Link to="/demo" onClick={() => handleFeatureClick('demo_button')}>
            <Button variant="primary" size="large">
              Start Demo
            </Button>
          </Link>
          <Link to="/videos" onClick={() => handleFeatureClick('videos_button')}>
            <Button variant="secondary" size="large">
              Watch Videos
            </Button>
          </Link>
        </div>
      </section>

      <section className="features-section">
        <h2>Explore Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Interactive Demo</h3>
            <p>Experience real-world scenarios with our interactive demonstration platform.</p>
            <Link 
              to="/demo" 
              className="feature-link"
              onClick={() => handleFeatureClick('demo_card')}
            >
              Try Demo →
            </Link>
          </div>
          
          <div className="feature-card">
            <h3>Video Library</h3>
            <p>Access comprehensive video tutorials and learning materials.</p>
            <Link 
              to="/videos" 
              className="feature-link"
              onClick={() => handleFeatureClick('videos_card')}
            >
              Browse Videos →
            </Link>
          </div>
          
          <div className="feature-card">
            <h3>Calculator Tools</h3>
            <p>Use our interactive calculators for various business scenarios.</p>
            <Link 
              to="/calculator" 
              className="feature-link"
              onClick={() => handleFeatureClick('calculator_card')}
            >
              Open Calculator →
            </Link>
          </div>
          
          <div className="feature-card">
            <h3>Document Management</h3>
            <p>Upload and manage your documents with intelligent processing.</p>
            <Link 
              to="/documents" 
              className="feature-link"
              onClick={() => handleFeatureClick('documents_card')}
            >
              Manage Documents →
            </Link>
          </div>
        </div>
      </section>

      <section className="getting-started">
        <h2>Getting Started</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Explore the Demo</h4>
              <p>Start with our interactive demo to understand the platform capabilities.</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Watch Learning Videos</h4>
              <p>Enhance your understanding with our comprehensive video library.</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Use Interactive Tools</h4>
              <p>Apply your knowledge with our calculators and document tools.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;