import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CalculatorPage from '../CalculatorPage';
import { useAuth, useEventTracking } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn(),
  useEventTracking: jest.fn()
}));

// Mock the InteractiveCalculator component
jest.mock('../components/InteractiveCalculator', () => {
  return function MockInteractiveCalculator() {
    return <div data-testid="interactive-calculator">Interactive Calculator</div>;
  };
});

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe'
};

const mockTrackEvent = jest.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('CalculatorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false
    });
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
  });

  it('renders calculator page with header and calculator component', () => {
    renderWithRouter(<CalculatorPage />);
    
    expect(screen.getByText(/loan payment calculator/i)).toBeInTheDocument();
    expect(screen.getByText(/calculate your monthly payments/i)).toBeInTheDocument();
    expect(screen.getByTestId('interactive-calculator')).toBeInTheDocument();
  });

  it('tracks page view event on mount', () => {
    renderWithRouter(<CalculatorPage />);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('page_view', {
      page: 'calculator',
      userId: 'user-123'
    });
  });

  it('displays calculator features and benefits', () => {
    renderWithRouter(<CalculatorPage />);
    
    expect(screen.getByText(/monthly payment calculation/i)).toBeInTheDocument();
    expect(screen.getByText(/total interest calculation/i)).toBeInTheDocument();
    expect(screen.getByText(/amortization schedule/i)).toBeInTheDocument();
    expect(screen.getByText(/save calculations/i)).toBeInTheDocument();
  });

  it('shows calculator instructions', () => {
    renderWithRouter(<CalculatorPage />);
    
    expect(screen.getByText(/enter loan amount/i)).toBeInTheDocument();
    expect(screen.getByText(/select interest rate/i)).toBeInTheDocument();
    expect(screen.getByText(/choose loan term/i)).toBeInTheDocument();
  });

  it('handles user not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false
    });
    
    renderWithRouter(<CalculatorPage />);
    
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    expect(screen.queryByTestId('interactive-calculator')).not.toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true
    });
    
    renderWithRouter(<CalculatorPage />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('includes helpful tips section', () => {
    renderWithRouter(<CalculatorPage />);
    
    expect(screen.getByText(/helpful tips/i)).toBeInTheDocument();
    expect(screen.getByText(/consider your budget/i)).toBeInTheDocument();
    expect(screen.getByText(/compare different scenarios/i)).toBeInTheDocument();
  });

  it('has proper page structure and accessibility', () => {
    renderWithRouter(<CalculatorPage />);
    
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('tracks feature interaction events', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CalculatorPage />);
    
    const helpButton = screen.getByRole('button', { name: /help/i });
    await user.click(helpButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('feature_interaction', {
      feature: 'calculator_help',
      action: 'click'
    });
  });

  it('displays calculator history link when user has calculations', async () => {
    // Mock API response for user calculations
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'calc-1', principal: 200000, createdAt: '2024-01-01' }
      ])
    });
    
    renderWithRouter(<CalculatorPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/view calculation history/i)).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
    
    renderWithRouter(<CalculatorPage />);
    
    await waitFor(() => {
      expect(screen.queryByText(/view calculation history/i)).not.toBeInTheDocument();
    });
  });
});