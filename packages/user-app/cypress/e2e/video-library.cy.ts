describe('Video Library Feature', () => {
  beforeEach(() => {
    cy.mockApi('GET', '/api/videos', { fixture: 'videos.json' });
    cy.mockApi('GET', '/api/videos/categories', ['Financial Planning', 'Loan Management', 'Investment Basics']);
    cy.mockApi('POST', '/api/videos/*/engagement', { success: true });
    cy.mockApi('POST', '/api/events/track', { success: true });
    
    cy.login('test@example.com', 'password123');
    cy.visit('/videos');
    cy.waitForPageLoad();
  });

  it('displays video library with all videos', () => {
    cy.get('h1').should('contain', 'Video Library');
    cy.get('[data-testid="video-card"]').should('have.length', 3);
    
    // Check video details
    cy.get('[data-testid="video-card"]').first().within(() => {
      cy.get('[data-testid="video-title"]').should('contain', 'Introduction to Personal Finance');
      cy.get('[data-testid="video-duration"]').should('contain', '5:00');
      cy.get('[data-testid="video-thumbnail"]').should('be.visible');
    });
  });

  it('filters videos by category', () => {
    // Click on Financial Planning category
    cy.get('[data-testid="category-filter"]').contains('Financial Planning').click();
    
    // Should show only Financial Planning videos
    cy.get('[data-testid="video-card"]').should('have.length', 1);
    cy.get('[data-testid="video-title"]').should('contain', 'Introduction to Personal Finance');
    
    // Clear filter
    cy.get('[data-testid="clear-filters"]').click();
    cy.get('[data-testid="video-card"]').should('have.length', 3);
  });

  it('searches videos by title', () => {
    cy.get('[data-testid="search-input"]').type('loan');
    
    // Should show only loan-related videos
    cy.get('[data-testid="video-card"]').should('have.length', 1);
    cy.get('[data-testid="video-title"]').should('contain', 'Understanding Loan Types');
    
    // Clear search
    cy.get('[data-testid="search-input"]').clear();
    cy.get('[data-testid="video-card"]').should('have.length', 3);
  });

  it('plays video and tracks engagement', () => {
    // Click on first video
    cy.get('[data-testid="video-card"]').first().click();
    
    // Video player should open
    cy.get('[data-testid="video-player"]').should('be.visible');
    cy.get('[data-testid="video-title"]').should('contain', 'Introduction to Personal Finance');
    
    // Play video
    cy.get('[data-testid="play-button"]').click();
    
    // Verify engagement tracking
    cy.wait('@apiPOST_api_videos_*_engagement');
    
    // Pause video
    cy.get('[data-testid="pause-button"]').click();
    
    // Close video player
    cy.get('[data-testid="close-player"]').click();
    cy.get('[data-testid="video-player"]').should('not.exist');
  });

  it('sorts videos by different criteria', () => {
    // Sort by duration
    cy.get('[data-testid="sort-select"]').select('duration');
    
    // Verify sorting (shortest first)
    cy.get('[data-testid="video-card"]').first().within(() => {
      cy.get('[data-testid="video-title"]').should('contain', 'Introduction to Personal Finance');
    });
    
    // Sort by title
    cy.get('[data-testid="sort-select"]').select('title');
    
    // Verify alphabetical sorting
    cy.get('[data-testid="video-card"]').first().within(() => {
      cy.get('[data-testid="video-title"]').should('contain', 'Introduction to Personal Finance');
    });
  });

  it('displays video progress for watched videos', () => {
    // Mock watched videos API
    cy.mockApi('GET', '/api/videos/progress', {
      'video-1': { watchTime: 150, completed: false },
      'video-2': { watchTime: 450, completed: true }
    });
    
    cy.reload();
    cy.waitForPageLoad();
    
    // First video should show progress
    cy.get('[data-testid="video-card"]').first().within(() => {
      cy.get('[data-testid="progress-bar"]').should('be.visible');
      cy.get('[data-testid="progress-percentage"]').should('contain', '50%');
    });
    
    // Second video should show completed
    cy.get('[data-testid="video-card"]').eq(1).within(() => {
      cy.get('[data-testid="completed-badge"]').should('be.visible');
    });
  });

  it('bookmarks videos', () => {
    cy.mockApi('POST', '/api/videos/*/bookmark', { success: true });
    cy.mockApi('DELETE', '/api/videos/*/bookmark', { success: true });
    
    // Bookmark first video
    cy.get('[data-testid="video-card"]').first().within(() => {
      cy.get('[data-testid="bookmark-button"]').click();
    });
    
    // Verify bookmark API call
    cy.wait('@apiPOST_api_videos_*_bookmark');
    
    // Bookmark icon should be filled
    cy.get('[data-testid="video-card"]').first().within(() => {
      cy.get('[data-testid="bookmark-button"]').should('have.class', 'bookmarked');
    });
    
    // Remove bookmark
    cy.get('[data-testid="video-card"]').first().within(() => {
      cy.get('[data-testid="bookmark-button"]').click();
    });
    
    cy.wait('@apiDELETE_api_videos_*_bookmark');
  });

  it('handles video loading errors gracefully', () => {
    // Mock API error
    cy.mockApi('GET', '/api/videos', { statusCode: 500, body: { error: 'Server error' } });
    
    cy.reload();
    
    // Should show error message
    cy.get('[data-testid="error-message"]').should('contain', 'Failed to load videos');
    cy.get('[data-testid="retry-button"]').should('be.visible');
    
    // Retry should work
    cy.mockApi('GET', '/api/videos', { fixture: 'videos.json' });
    cy.get('[data-testid="retry-button"]').click();
    
    cy.waitForPageLoad();
    cy.get('[data-testid="video-card"]').should('have.length', 3);
  });

  it('displays empty state when no videos match filter', () => {
    cy.get('[data-testid="search-input"]').type('nonexistent video');
    
    cy.get('[data-testid="empty-state"]').should('be.visible');
    cy.get('[data-testid="empty-message"]').should('contain', 'No videos found');
    cy.get('[data-testid="clear-search"]').should('be.visible');
  });
});