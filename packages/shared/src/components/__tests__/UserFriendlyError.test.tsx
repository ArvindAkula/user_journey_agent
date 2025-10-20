import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserFriendlyError, useUserFriendlyError, withUserFriendlyError } from '../UserFriendlyError';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
});

describe('UserFriendlyError Component', () => {
  const mockError = new Error('Test error message');
  mockError.stack = 'Error: Test error message\n    at test.js:1:1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders generic error by default', () => {
    render(<UserFriendlyError error={mockError} />);

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('renders network error type', () => {
    render(<UserFriendlyError error={mockError} errorType="network" />);

    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    expect(screen.getByText(/trouble connecting to our servers/)).toBeInTheDocument();
    expect(screen.getByText('🌐')).toBeInTheDocument();
  });

  it('renders auth error type', () => {
    render(<UserFriendlyError error={mockError} errorType="auth" />);

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText(/need to sign in/)).toBeInTheDocument();
    expect(screen.getByText('🔐')).toBeInTheDocument();
  });

  it('renders validation error type', () => {
    render(<UserFriendlyError error={mockError} errorType="validation" />);

    expect(screen.getByText('Invalid Input')).toBeInTheDocument();
    expect(screen.getByText(/information you entered is not valid/)).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('renders permission error type', () => {
    render(<UserFriendlyError error={mockError} errorType="permission" />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/don't have permission/)).toBeInTheDocument();
    expect(screen.getByText('🚫')).toBeInTheDocument();
  });

  it('displays context when provided', () => {
    render(
      <UserFriendlyError 
        error={mockError} 
        context="uploading a file" 
      />
    );

    expect(screen.getByText('What you were doing:')).toBeInTheDocument();
    expect(screen.getByText('uploading a file')).toBeInTheDocument();
  });

  it('shows suggestions for each error type', () => {
    render(<UserFriendlyError error={mockError} errorType="network" />);

    expect(screen.getByText('What you can try:')).toBeInTheDocument();
    expect(screen.getByText('Check your internet connection')).toBeInTheDocument();
    expect(screen.getByText('Try refreshing the page')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    render(<UserFriendlyError error={mockError} onRetry={onRetry} />);

    fireEvent.click(screen.getByTestId('retry-button'));

    expect(onRetry).toHaveBeenCalled();
  });

  it('calls onReportIssue when report issue button is clicked', () => {
    const onReportIssue = jest.fn();
    render(<UserFriendlyError error={mockError} onReportIssue={onReportIssue} />);

    fireEvent.click(screen.getByTestId('report-issue-button'));

    expect(onReportIssue).toHaveBeenCalled();
  });

  it('reloads page when refresh button is clicked', () => {
    const mockReload = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });

    render(<UserFriendlyError error={mockError} />);

    fireEvent.click(screen.getByTestId('refresh-page-button'));

    expect(mockReload).toHaveBeenCalled();
  });

  it('shows technical details when showDetails is true', () => {
    render(<UserFriendlyError error={mockError} showDetails={true} />);

    expect(screen.getByTestId('toggle-details-button')).toBeInTheDocument();
    expect(screen.getByText('Show Technical Details')).toBeInTheDocument();
  });

  it('toggles technical details visibility', () => {
    render(<UserFriendlyError error={mockError} showDetails={true} />);

    const toggleButton = screen.getByTestId('toggle-details-button');
    
    // Initially hidden
    expect(screen.queryByText('Error Message:')).not.toBeInTheDocument();

    // Show details
    fireEvent.click(toggleButton);
    expect(screen.getByText('Error Message:')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('Hide Technical Details')).toBeInTheDocument();

    // Hide details
    fireEvent.click(toggleButton);
    expect(screen.queryByText('Error Message:')).not.toBeInTheDocument();
    expect(screen.getByText('Show Technical Details')).toBeInTheDocument();
  });

  it('displays technical details when shown', () => {
    render(<UserFriendlyError error={mockError} showDetails={true} />);

    fireEvent.click(screen.getByTestId('toggle-details-button'));

    expect(screen.getByText('Error Message:')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
    expect(screen.getByText('Browser:')).toBeInTheDocument();
    expect(screen.getByText('URL:')).toBeInTheDocument();
    expect(screen.getByText('Timestamp:')).toBeInTheDocument();
  });

  it('copies error details to clipboard', async () => {
    render(<UserFriendlyError error={mockError} showDetails={true} />);

    fireEvent.click(screen.getByTestId('toggle-details-button'));
    fireEvent.click(screen.getByTestId('copy-error-button'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Test error message')
    );
  });

  it('renders with custom className', () => {
    render(<UserFriendlyError error={mockError} className="custom-error" />);

    expect(screen.getByTestId('user-friendly-error')).toHaveClass('custom-error');
  });

  it('has proper accessibility attributes', () => {
    render(<UserFriendlyError error={mockError} />);

    const errorElement = screen.getByTestId('user-friendly-error');
    expect(errorElement).toHaveAttribute('role', 'alert');
    expect(errorElement).toHaveAttribute('aria-live', 'assertive');
  });
});

describe('useUserFriendlyError Hook', () => {
  const TestComponent: React.FC = () => {
    const { getErrorType, createErrorProps } = useUserFriendlyError();

    const networkError = new Error('Network connection failed');
    const authError = new Error('Unauthorized access');
    const validationError = new Error('Invalid email format');
    const permissionError = new Error('Access denied');
    const genericError = new Error('Something went wrong');

    return (
      <div>
        <div data-testid="network-type">{getErrorType(networkError)}</div>
        <div data-testid="auth-type">{getErrorType(authError)}</div>
        <div data-testid="validation-type">{getErrorType(validationError)}</div>
        <div data-testid="permission-type">{getErrorType(permissionError)}</div>
        <div data-testid="generic-type">{getErrorType(genericError)}</div>
      </div>
    );
  };

  it('correctly identifies error types', () => {
    render(<TestComponent />);

    expect(screen.getByTestId('network-type')).toHaveTextContent('network');
    expect(screen.getByTestId('auth-type')).toHaveTextContent('auth');
    expect(screen.getByTestId('validation-type')).toHaveTextContent('validation');
    expect(screen.getByTestId('permission-type')).toHaveTextContent('permission');
    expect(screen.getByTestId('generic-type')).toHaveTextContent('generic');
  });
});

describe('withUserFriendlyError HOC', () => {
  const TestComponent: React.FC<{ error?: Error }> = ({ error }) => {
    if (error) throw error;
    return <div>No error</div>;
  };

  it('renders component when no error', () => {
    const WrappedComponent = withUserFriendlyError(TestComponent);
    render(<WrappedComponent />);

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error UI when error is provided', () => {
    const WrappedComponent = withUserFriendlyError(TestComponent);
    const error = new Error('Test error');

    render(<WrappedComponent error={error} />);

    expect(screen.getByTestId('user-friendly-error')).toBeInTheDocument();
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
  });

  it('passes custom error props', () => {
    const WrappedComponent = withUserFriendlyError(TestComponent, {
      errorType: 'network',
      context: 'loading data'
    });
    const error = new Error('Test error');

    render(<WrappedComponent error={error} />);

    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    expect(screen.getByText('loading data')).toBeInTheDocument();
  });
});