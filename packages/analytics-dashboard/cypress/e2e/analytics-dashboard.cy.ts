describe('Analytics Dashboard E2E Tests', () => {
  beforeEach(() => {
    // Mock analytics API responses
    cy.intercept('GET', '/api/analytics/overview', {
      totalUsers: 1250,
      activeUsers: 89,
      totalSessions: 3420,
      conversionRate: 12.5
    }).as('getOverview');
    
    cy.intercept('GET', '/api/analytics/user-journey', {
      personas: [
        {
          id: 'sarah',
          name: 'Sarah',
          role: 'First-time Homebuyer',
          completionRate: 85,
          journey: [
            { step: 'video_library', duration: 300 },
            { step: 'loan_calculator', duration: 180 }
          ]
        }
      ]
    }).as('getUserJourney');
    
    cy.intercept('GET', '/api/analytics/real-time', {
      activeUsers: 89,
      recentEvents: [
        { type: 'video_start', count: 12, timestamp: new Date().toISOString() },
        { type: 'calculation_complete', count: 8, timestamp: new Date().toISOString() }
      ]
    }).as('getRealTime');
    
    // Mock authentication
    cy.window().then((win) => {
      win.localStorage.setItem('analytics_auth_token', 'mock-token');
      win.localStorage.setItem('analytics_user', JSON.stringify({
        id: 'analyst-123',
        email: 'analyst@example.com',
        role: 'analytics_team',
        permissions: ['view_analytics', 'export_data']
      }));
    });
    
    cy.visit('/');
  });

  it('displays main analytics dashboard with key metrics', () => {
    cy.wait('@getOverview');
    
    cy.get('h1').should('contain', 'Analytics Dashboard');
    cy.get('[data-testid="total-users"]').should('contain', '1,250');
    cy.get('[data-testid="active-users"]').should('contain', '89');
    cy.get('[data-testid="total-sessions"]').should('contain', '3,420');
    cy.get('[data-testid="conversion-rate"]').should('contain', '12.5%');
  });

  it('navigates through all dashboard sections', () => {
    // Main dashboard
    cy.get('[data-testid="nav-dashboard"]').click();
    cy.url().should('include', '/dashboard');
    
    // User Journey
    cy.get('[data-testid="nav-user-journey"]').click();
    cy.url().should('include', '/user-journey');
    cy.wait('@getUserJourney');
    cy.get('[data-testid="persona-card"]').should('be.visible');
    
    // Real-time Monitor
    cy.get('[data-testid="nav-real-time"]').click();
    cy.url().should('include', '/real-time');
    cy.wait('@getRealTime');
    cy.get('[data-testid="real-time-metrics"]').should('be.visible');
    
    // Exports
    cy.get('[data-testid="nav-exports"]').click();
    cy.url().should('include', '/exports');
    cy.get('[data-testid="export-panel"]').should('be.visible');
    
    // Metrics
    cy.get('[data-testid="nav-metrics"]').click();
    cy.url().should('include', '/metrics');
    cy.get('[data-testid="detailed-metrics"]').should('be.visible');
  });

  it('filters data by date range', () => {
    cy.get('[data-testid="date-range-filter"]').select('last-7-days');
    
    // Should trigger new API call with date filter
    cy.intercept('GET', '/api/analytics/overview?dateRange=last-7-days', {
      totalUsers: 890,
      activeUsers: 67,
      totalSessions: 2100,
      conversionRate: 14.2
    }).as('getFilteredOverview');
    
    cy.wait('@getFilteredOverview');
    cy.get('[data-testid="total-users"]').should('contain', '890');
  });

  it('analyzes user journey personas', () => {
    cy.get('[data-testid="nav-user-journey"]').click();
    cy.wait('@getUserJourney');
    
    // Should display persona cards
    cy.get('[data-testid="persona-card"]').should('have.length.at.least', 1);
    cy.get('[data-testid="persona-name"]').should('contain', 'Sarah');
    cy.get('[data-testid="persona-role"]').should('contain', 'First-time Homebuyer');
    cy.get('[data-testid="completion-rate"]').should('contain', '85%');
    
    // Click on persona for detailed view
    cy.get('[data-testid="persona-card"]').first().click();
    cy.get('[data-testid="journey-timeline"]').should('be.visible');
    cy.get('[data-testid="journey-step"]').should('have.length', 2);
  });

  it('monitors real-time analytics', () => {
    cy.get('[data-testid="nav-real-time"]').click();
    cy.wait('@getRealTime');
    
    // Should show real-time metrics
    cy.get('[data-testid="active-users-count"]').should('contain', '89');
    cy.get('[data-testid="connection-status"]').should('contain', 'Connected');
    
    // Should display recent events
    cy.get('[data-testid="recent-events"]').should('be.visible');
    cy.get('[data-testid="event-item"]').should('have.length.at.least', 2);
    cy.get('[data-testid="event-type"]').should('contain', 'video_start');
    cy.get('[data-testid="event-count"]').should('contain', '12');
    
    // Filter events by type
    cy.get('[data-testid="event-filter"]').select('video_start');
    cy.get('[data-testid="event-item"]').should('have.length', 1);
  });

  it('exports analytics data', () => {
    cy.get('[data-testid="nav-exports"]').click();
    
    // Select export format
    cy.get('[data-testid="export-format"]').select('csv');
    
    // Select data types
    cy.get('[data-testid="user-metrics-checkbox"]').check();
    cy.get('[data-testid="event-data-checkbox"]').check();
    
    // Set date range
    cy.get('[data-testid="start-date"]').type('2024-01-01');
    cy.get('[data-testid="end-date"]').type('2024-01-31');
    
    // Mock export API
    cy.intercept('POST', '/api/analytics/export', {
      exportId: 'export-123',
      status: 'completed',
      downloadUrl: '/api/exports/export-123/download'
    }).as('createExport');
    
    // Export data
    cy.get('[data-testid="export-button"]').click();
    cy.wait('@createExport');
    
    // Should show success message
    cy.get('[data-testid="export-success"]').should('contain', 'Export completed');
  });

  it('handles real-time connection issues', () => {
    cy.get('[data-testid="nav-real-time"]').click();
    
    // Mock disconnected state
    cy.intercept('GET', '/api/analytics/real-time', {
      statusCode: 503,
      body: { error: 'Service unavailable' }
    }).as('getRealTimeError');
    
    cy.wait('@getRealTimeError');
    
    // Should show disconnected state
    cy.get('[data-testid="connection-status"]').should('contain', 'Disconnected');
    cy.get('[data-testid="reconnect-button"]').should('be.visible');
    
    // Mock successful reconnection
    cy.intercept('GET', '/api/analytics/real-time', {
      activeUsers: 89,
      recentEvents: []
    }).as('getRealTimeReconnect');
    
    cy.get('[data-testid="reconnect-button"]').click();
    cy.wait('@getRealTimeReconnect');
    
    cy.get('[data-testid="connection-status"]').should('contain', 'Connected');
  });

  it('compares user personas', () => {
    // Mock multiple personas
    cy.intercept('GET', '/api/analytics/user-journey', {
      personas: [
        {
          id: 'sarah',
          name: 'Sarah',
          role: 'First-time Homebuyer',
          completionRate: 85
        },
        {
          id: 'mike',
          name: 'Mike',
          role: 'Refinancing Expert',
          completionRate: 92
        }
      ]
    }).as('getMultiplePersonas');
    
    cy.get('[data-testid="nav-user-journey"]').click();
    cy.wait('@getMultiplePersonas');
    
    // Select personas for comparison
    cy.get('[data-testid="persona-checkbox"]').first().check();
    cy.get('[data-testid="persona-checkbox"]').last().check();
    
    // Compare selected personas
    cy.get('[data-testid="compare-button"]').click();
    
    // Should show comparison view
    cy.get('[data-testid="comparison-view"]').should('be.visible');
    cy.get('[data-testid="completion-rate-diff"]').should('contain', '7%');
  });

  it('handles authentication and permissions', () => {
    // Test with limited permissions
    cy.window().then((win) => {
      win.localStorage.setItem('analytics_user', JSON.stringify({
        id: 'analyst-456',
        email: 'viewer@example.com',
        role: 'analytics_viewer',
        permissions: ['view_analytics'] // No export permissions
      }));
    });
    
    cy.reload();
    
    // Navigate to exports
    cy.get('[data-testid="nav-exports"]').click();
    
    // Should show permission denied
    cy.get('[data-testid="permission-denied"]').should('be.visible');
    cy.get('[data-testid="export-button"]').should('not.exist');
  });

  it('displays error states gracefully', () => {
    // Mock API error
    cy.intercept('GET', '/api/analytics/overview', {
      statusCode: 500,
      body: { error: 'Internal server error' }
    }).as('getOverviewError');
    
    cy.reload();
    cy.wait('@getOverviewError');
    
    // Should show error message
    cy.get('[data-testid="error-message"]').should('contain', 'Failed to load analytics');
    cy.get('[data-testid="retry-button"]').should('be.visible');
    
    // Mock successful retry
    cy.intercept('GET', '/api/analytics/overview', {
      totalUsers: 1250,
      activeUsers: 89
    }).as('getOverviewRetry');
    
    cy.get('[data-testid="retry-button"]').click();
    cy.wait('@getOverviewRetry');
    
    // Should show data
    cy.get('[data-testid="total-users"]').should('contain', '1,250');
  });

  it('schedules recurring exports', () => {
    cy.get('[data-testid="nav-exports"]').click();
    
    // Enable scheduling
    cy.get('[data-testid="schedule-toggle"]').check();
    
    // Configure schedule
    cy.get('[data-testid="frequency-select"]').select('weekly');
    cy.get('[data-testid="email-input"]').type('team@example.com');
    
    // Select data to export
    cy.get('[data-testid="user-metrics-checkbox"]').check();
    
    // Mock schedule API
    cy.intercept('POST', '/api/analytics/schedule-export', {
      scheduleId: 'schedule-123',
      status: 'active'
    }).as('scheduleExport');
    
    cy.get('[data-testid="schedule-button"]').click();
    cy.wait('@scheduleExport');
    
    cy.get('[data-testid="schedule-success"]').should('contain', 'Export scheduled');
  });
});