describe('Loan Calculator Feature', () => {
  beforeEach(() => {
    cy.mockApi('POST', '/api/calculator/loan', {
      monthlyPayment: 1073.64,
      totalInterest: 186510.40,
      totalAmount: 386510.40,
      paymentSchedule: [
        { paymentNumber: 1, principalPayment: 240.31, interestPayment: 833.33, remainingBalance: 199759.69 },
        { paymentNumber: 2, principalPayment: 241.31, interestPayment: 832.33, remainingBalance: 199518.38 }
      ]
    });
    cy.mockApi('POST', '/api/calculator/loan/save', { id: 'calc-123', success: true });
    cy.mockApi('GET', '/api/calculator/loan/history/*', []);
    cy.mockApi('POST', '/api/events/track', { success: true });
    
    cy.login('test@example.com', 'password123');
    cy.visit('/calculator');
    cy.waitForPageLoad();
  });

  it('displays loan calculator interface', () => {
    cy.get('h1').should('contain', 'Loan Payment Calculator');
    cy.get('[data-testid="loan-amount-input"]').should('be.visible');
    cy.get('[data-testid="interest-rate-input"]').should('be.visible');
    cy.get('[data-testid="loan-term-input"]').should('be.visible');
    cy.get('[data-testid="calculate-button"]').should('be.visible');
  });

  it('calculates loan payments correctly', () => {
    // Fill in loan details
    cy.get('[data-testid="loan-amount-input"]').clear().type('200000');
    cy.get('[data-testid="interest-rate-input"]').clear().type('5.0');
    cy.get('[data-testid="loan-term-input"]').clear().type('30');
    
    // Calculate
    cy.get('[data-testid="calculate-button"]').click();
    
    // Verify API call
    cy.wait('@apiPOST_api_calculator_loan');
    
    // Verify results display
    cy.get('[data-testid="monthly-payment"]').should('contain', '$1,073.64');
    cy.get('[data-testid="total-interest"]').should('contain', '$186,510.40');
    cy.get('[data-testid="total-amount"]').should('contain', '$386,510.40');
  });

  it('validates input fields', () => {
    // Try to calculate without inputs
    cy.get('[data-testid="calculate-button"]').click();
    
    // Should show validation errors
    cy.get('[data-testid="loan-amount-error"]').should('contain', 'Loan amount is required');
    cy.get('[data-testid="interest-rate-error"]').should('contain', 'Interest rate is required');
    cy.get('[data-testid="loan-term-error"]').should('contain', 'Loan term is required');
    
    // Test invalid values
    cy.get('[data-testid="loan-amount-input"]').type('-1000');
    cy.get('[data-testid="interest-rate-input"]').type('150');
    cy.get('[data-testid="loan-term-input"]').type('0');
    
    cy.get('[data-testid="calculate-button"]').click();
    
    cy.get('[data-testid="loan-amount-error"]').should('contain', 'Amount must be positive');
    cy.get('[data-testid="interest-rate-error"]').should('contain', 'Rate must be between 0 and 100');
    cy.get('[data-testid="loan-term-error"]').should('contain', 'Term must be positive');
  });

  it('displays amortization schedule', () => {
    // Fill in and calculate
    cy.get('[data-testid="loan-amount-input"]').clear().type('200000');
    cy.get('[data-testid="interest-rate-input"]').clear().type('5.0');
    cy.get('[data-testid="loan-term-input"]').clear().type('30');
    cy.get('[data-testid="calculate-button"]').click();
    
    cy.wait('@apiPOST_api_calculator_loan');
    
    // View amortization schedule
    cy.get('[data-testid="view-schedule-button"]').click();
    
    // Verify schedule table
    cy.get('[data-testid="amortization-table"]').should('be.visible');
    cy.get('[data-testid="payment-row"]').should('have.length.at.least', 2);
    
    // Check first payment details
    cy.get('[data-testid="payment-row"]').first().within(() => {
      cy.get('[data-testid="payment-number"]').should('contain', '1');
      cy.get('[data-testid="principal-payment"]').should('contain', '$240.31');
      cy.get('[data-testid="interest-payment"]').should('contain', '$833.33');
      cy.get('[data-testid="remaining-balance"]').should('contain', '$199,759.69');
    });
  });

  it('saves calculation results', () => {
    // Calculate loan
    cy.get('[data-testid="loan-amount-input"]').clear().type('200000');
    cy.get('[data-testid="interest-rate-input"]').clear().type('5.0');
    cy.get('[data-testid="loan-term-input"]').clear().type('30');
    cy.get('[data-testid="calculate-button"]').click();
    
    cy.wait('@apiPOST_api_calculator_loan');
    
    // Save calculation
    cy.get('[data-testid="save-calculation-button"]').click();
    
    // Fill save form
    cy.get('[data-testid="calculation-name-input"]').type('My Home Loan');
    cy.get('[data-testid="save-confirm-button"]').click();
    
    // Verify save API call
    cy.wait('@apiPOST_api_calculator_loan_save');
    
    // Should show success message
    cy.get('[data-testid="save-success"]').should('contain', 'Calculation saved successfully');
  });

  it('loads calculation history', () => {
    // Mock calculation history
    cy.mockApi('GET', '/api/calculator/loan/history/*', [
      {
        id: 'calc-1',
        name: 'Home Loan',
        principal: 200000,
        interestRate: 5.0,
        termYears: 30,
        monthlyPayment: 1073.64,
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'calc-2',
        name: 'Car Loan',
        principal: 25000,
        interestRate: 4.5,
        termYears: 5,
        monthlyPayment: 465.42,
        createdAt: '2024-01-02T00:00:00Z'
      }
    ]);
    
    // View history
    cy.get('[data-testid="view-history-button"]').click();
    
    // Verify history display
    cy.get('[data-testid="calculation-history"]').should('be.visible');
    cy.get('[data-testid="history-item"]').should('have.length', 2);
    
    // Check first calculation
    cy.get('[data-testid="history-item"]').first().within(() => {
      cy.get('[data-testid="calculation-name"]').should('contain', 'Home Loan');
      cy.get('[data-testid="calculation-amount"]').should('contain', '$200,000');
      cy.get('[data-testid="calculation-payment"]').should('contain', '$1,073.64');
    });
    
    // Load a saved calculation
    cy.get('[data-testid="history-item"]').first().within(() => {
      cy.get('[data-testid="load-calculation-button"]').click();
    });
    
    // Verify form is populated
    cy.get('[data-testid="loan-amount-input"]').should('have.value', '200000');
    cy.get('[data-testid="interest-rate-input"]').should('have.value', '5.0');
    cy.get('[data-testid="loan-term-input"]').should('have.value', '30');
  });

  it('compares different loan scenarios', () => {
    // Calculate first scenario
    cy.get('[data-testid="loan-amount-input"]').clear().type('200000');
    cy.get('[data-testid="interest-rate-input"]').clear().type('5.0');
    cy.get('[data-testid="loan-term-input"]').clear().type('30');
    cy.get('[data-testid="calculate-button"]').click();
    
    cy.wait('@apiPOST_api_calculator_loan');
    
    // Add to comparison
    cy.get('[data-testid="add-to-comparison-button"]').click();
    
    // Calculate second scenario
    cy.get('[data-testid="interest-rate-input"]').clear().type('4.5');
    cy.get('[data-testid="calculate-button"]').click();
    
    cy.wait('@apiPOST_api_calculator_loan');
    
    // Add to comparison
    cy.get('[data-testid="add-to-comparison-button"]').click();
    
    // View comparison
    cy.get('[data-testid="view-comparison-button"]').click();
    
    // Verify comparison table
    cy.get('[data-testid="comparison-table"]').should('be.visible');
    cy.get('[data-testid="comparison-row"]').should('have.length', 2);
    
    // Should show difference in payments
    cy.get('[data-testid="payment-difference"]').should('be.visible');
    cy.get('[data-testid="interest-savings"]').should('be.visible');
  });

  it('exports calculation results', () => {
    // Calculate loan
    cy.get('[data-testid="loan-amount-input"]').clear().type('200000');
    cy.get('[data-testid="interest-rate-input"]').clear().type('5.0');
    cy.get('[data-testid="loan-term-input"]').clear().type('30');
    cy.get('[data-testid="calculate-button"]').click();
    
    cy.wait('@apiPOST_api_calculator_loan');
    
    // Export as PDF
    cy.get('[data-testid="export-pdf-button"]').click();
    
    // Should trigger download
    cy.get('[data-testid="export-success"]').should('contain', 'PDF exported successfully');
    
    // Export as CSV
    cy.get('[data-testid="export-csv-button"]').click();
    
    cy.get('[data-testid="export-success"]').should('contain', 'CSV exported successfully');
  });

  it('handles calculation errors gracefully', () => {
    // Mock API error
    cy.mockApi('POST', '/api/calculator/loan', { statusCode: 500, body: { error: 'Calculation failed' } });
    
    // Try to calculate
    cy.get('[data-testid="loan-amount-input"]').clear().type('200000');
    cy.get('[data-testid="interest-rate-input"]').clear().type('5.0');
    cy.get('[data-testid="loan-term-input"]').clear().type('30');
    cy.get('[data-testid="calculate-button"]').click();
    
    // Should show error message
    cy.get('[data-testid="calculation-error"]').should('contain', 'Failed to calculate loan payment');
    cy.get('[data-testid="retry-calculation"]').should('be.visible');
  });
});