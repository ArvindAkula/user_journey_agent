import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InteractiveCalculator from '../InteractiveCalculator';
import { useEventTracking } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useEventTracking: jest.fn()
}));

describe('InteractiveCalculator Component', () => {
  const mockTrackEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
  });

  it('renders calculator interface', () => {
    render(<InteractiveCalculator />);
    
    expect(screen.getByTestId('calculator-display')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-buttons')).toBeInTheDocument();
  });

  it('displays numbers when clicked', () => {
    render(<InteractiveCalculator />);
    
    const button1 = screen.getByText('1');
    const button2 = screen.getByText('2');
    const display = screen.getByTestId('calculator-display');
    
    fireEvent.click(button1);
    fireEvent.click(button2);
    
    expect(display).toHaveTextContent('12');
  });

  it('performs basic arithmetic operations', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    // Test addition: 5 + 3 = 8
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    expect(display).toHaveTextContent('8');
  });

  it('performs subtraction', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    // Test subtraction: 10 - 4 = 6
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('-'));
    fireEvent.click(screen.getByText('4'));
    fireEvent.click(screen.getByText('='));
    
    expect(display).toHaveTextContent('6');
  });

  it('performs multiplication', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    // Test multiplication: 6 * 7 = 42
    fireEvent.click(screen.getByText('6'));
    fireEvent.click(screen.getByText('×'));
    fireEvent.click(screen.getByText('7'));
    fireEvent.click(screen.getByText('='));
    
    expect(display).toHaveTextContent('42');
  });

  it('performs division', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    // Test division: 15 / 3 = 5
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('÷'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    expect(display).toHaveTextContent('5');
  });

  it('handles decimal numbers', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('.'));
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('4'));
    
    expect(display).toHaveTextContent('3.14');
  });

  it('clears display when C is clicked', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    // Enter some numbers
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    
    expect(display).toHaveTextContent('123');
    
    // Clear
    fireEvent.click(screen.getByText('C'));
    
    expect(display).toHaveTextContent('0');
  });

  it('handles division by zero', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('÷'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('='));
    
    expect(display).toHaveTextContent('Error');
  });

  it('tracks calculation events', async () => {
    render(<InteractiveCalculator />);
    
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'feature_interaction',
        feature: 'calculator',
        eventData: {
          action: 'calculation_performed',
          operation: 'addition',
          result: 5,
          success: true
        }
      });
    });
  });

  it('tracks error events', async () => {
    render(<InteractiveCalculator />);
    
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('÷'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('='));
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        eventType: 'struggle_signal',
        feature: 'calculator',
        eventData: {
          action: 'calculation_error',
          error: 'division_by_zero',
          success: false
        }
      });
    });
  });

  it('handles keyboard input', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    const calculator = screen.getByTestId('calculator-container');
    
    // Focus the calculator
    calculator.focus();
    
    // Type numbers using keyboard
    fireEvent.keyDown(calculator, { key: '1' });
    fireEvent.keyDown(calculator, { key: '2' });
    
    expect(display).toHaveTextContent('12');
  });

  it('handles complex calculations', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    
    // Test: 2 + 3 * 4 = 14 (should follow order of operations)
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('×'));
    fireEvent.click(screen.getByText('4'));
    fireEvent.click(screen.getByText('='));
    
    expect(display).toHaveTextContent('14');
  });

  it('maintains calculation history', () => {
    render(<InteractiveCalculator />);
    
    // Perform first calculation
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    
    // Check if history is displayed
    expect(screen.getByTestId('calculation-history')).toBeInTheDocument();
    expect(screen.getByText('2 + 3 = 5')).toBeInTheDocument();
  });

  it('renders with accessibility attributes', () => {
    render(<InteractiveCalculator />);
    
    const calculator = screen.getByTestId('calculator-container');
    expect(calculator).toHaveAttribute('role', 'application');
    expect(calculator).toHaveAttribute('aria-label', 'Interactive Calculator');
    
    const display = screen.getByTestId('calculator-display');
    expect(display).toHaveAttribute('aria-live', 'polite');
    expect(display).toHaveAttribute('aria-label', 'Calculator display');
  });

  it('handles rapid button clicks', () => {
    render(<InteractiveCalculator />);
    
    const display = screen.getByTestId('calculator-display');
    const button1 = screen.getByText('1');
    
    // Rapidly click the same button
    for (let i = 0; i < 5; i++) {
      fireEvent.click(button1);
    }
    
    expect(display).toHaveTextContent('11111');
  });
});