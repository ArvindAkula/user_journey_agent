/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login a user
       * @example cy.login('test@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>;
      
      /**
       * Custom command to mock API responses
       * @example cy.mockApi('GET', '/api/videos', { fixture: 'videos.json' })
       */
      mockApi(method: string, url: string, response: any): Chainable<void>;
      
      /**
       * Custom command to wait for page to load
       * @example cy.waitForPageLoad()
       */
      waitForPageLoad(): Chainable<void>;
      
      /**
       * Custom command to upload a file
       * @example cy.uploadFile('input[type="file"]', 'test.pdf')
       */
      uploadFile(selector: string, fileName: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/');
  
  // Mock authentication
  cy.window().then((win) => {
    win.localStorage.setItem('auth_token', 'mock-token');
    win.localStorage.setItem('user', JSON.stringify({
      id: 'user-123',
      email: email,
      firstName: 'Test',
      lastName: 'User'
    }));
  });
  
  cy.reload();
});

Cypress.Commands.add('mockApi', (method: string, url: string, response: any) => {
  cy.intercept(method, url, response).as(`api${method}${url.replace(/\//g, '_')}`);
});

Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-testid="loading"]', { timeout: 1000 }).should('not.exist');
  cy.get('body').should('be.visible');
});

Cypress.Commands.add('uploadFile', (selector: string, fileName: string) => {
  cy.fixture(fileName, 'base64').then((fileContent) => {
    cy.get(selector).selectFile({
      contents: Cypress.Buffer.from(fileContent, 'base64'),
      fileName: fileName,
      mimeType: 'application/pdf'
    }, { force: true });
  });
});