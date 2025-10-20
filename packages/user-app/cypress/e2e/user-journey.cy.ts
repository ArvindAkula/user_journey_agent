describe('Complete User Journey', () => {
  beforeEach(() => {
    // Mock API responses
    cy.mockApi('GET', '/api/videos', { fixture: 'videos.json' });
    cy.mockApi('GET', '/api/videos/categories', ['Financial Planning', 'Loan Management', 'Investment Basics']);
    cy.mockApi('POST', '/api/events/track', { success: true });
    cy.mockApi('GET', '/api/users/profile', {
      id: 'user-123',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com'
    });
    
    // Login user
    cy.login('test@example.com', 'password123');
  });

  it('completes full user journey through all features', () => {
    // Start at home page
    cy.visit('/');
    cy.waitForPageLoad();
    
    cy.get('h1').should('contain', 'Welcome to AWS Agent');
    cy.get('[data-testid="user-header"]').should('contain', 'Test User');

    // Navigate to Video Library
    cy.get('[data-testid="tab-videos"]').click();
    cy.url().should('include', '/videos');
    
    // Verify video library loads
    cy.get('h1').should('contain', 'Video Library');
    cy.get('[data-testid="video-card"]').should('have.length.at.least', 1);
    
    // Click on a video
    cy.get('[data-testid="video-card"]').first().click();
    cy.get('[data-testid="video-player"]').should('be.visible');

    // Navigate to Calculator
    cy.get('[data-testid="tab-calculator"]').click();
    cy.url().should('include', '/calculator');
    
    // Use loan calculator
    cy.get('h1').should('contain', 'Loan Payment Calculator');
    cy.get('[data-testid="loan-amount-input"]').type('200000');
    cy.get('[data-testid="interest-rate-input"]').type('5.5');
    cy.get('[data-testid="loan-term-input"]').type('30');
    cy.get('[data-testid="calculate-button"]').click();
    
    // Verify calculation results
    cy.get('[data-testid="monthly-payment"]').should('be.visible');
    cy.get('[data-testid="total-interest"]').should('be.visible');

    // Navigate to Documents
    cy.get('[data-testid="tab-documents"]').click();
    cy.url().should('include', '/documents');
    
    // Upload a document
    cy.get('h1').should('contain', 'Document Center');
    cy.uploadFile('[data-testid="file-input"]', 'test.pdf');
    cy.get('[data-testid="upload-button"]').click();
    
    // Verify upload success
    cy.get('[data-testid="upload-success"]').should('be.visible');

    // Navigate to Profile
    cy.get('[data-testid="tab-profile"]').click();
    cy.url().should('include', '/profile');
    
    // Verify profile page
    cy.get('h1').should('contain', 'User Profile');
    cy.get('[data-testid="user-info"]').should('contain', 'Test User');
    cy.get('[data-testid="user-email"]').should('contain', 'test@example.com');
  });

  it('handles navigation between features smoothly', () => {
    cy.visit('/');
    
    // Test tab navigation
    const tabs = ['videos', 'calculator', 'documents', 'profile'];
    
    tabs.forEach((tab) => {
      cy.get(`[data-testid="tab-${tab}"]`).click();
      cy.url().should('include', `/${tab}`);
      cy.waitForPageLoad();
    });
    
    // Return to home
    cy.get('[data-testid="tab-demo"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('maintains user session across page refreshes', () => {
    cy.visit('/profile');
    cy.waitForPageLoad();
    
    // Verify user is logged in
    cy.get('[data-testid="user-info"]').should('contain', 'Test User');
    
    // Refresh page
    cy.reload();
    cy.waitForPageLoad();
    
    // Verify user is still logged in
    cy.get('[data-testid="user-info"]').should('contain', 'Test User');
  });
});