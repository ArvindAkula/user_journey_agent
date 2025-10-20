import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner Component', () => {
  it('renders loading spinner with default props', () => {
    render(<LoadingSpinner />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('animate-spin', 'h-8', 'w-8');
  });

  it('renders with custom size', () => {
    const { rerender } = render(<LoadingSpinner size="small" />);
    expect(document.querySelector('svg')).toHaveClass('h-4', 'w-4');

    rerender(<LoadingSpinner size="medium" />);
    expect(document.querySelector('svg')).toHaveClass('h-8', 'w-8');

    rerender(<LoadingSpinner size="large" />);
    expect(document.querySelector('svg')).toHaveClass('h-12', 'w-12');
  });

  it('renders with custom color', () => {
    render(<LoadingSpinner color="red" />);
    const svg = document.querySelector('svg');
    const circle = svg?.querySelector('circle');
    const path = svg?.querySelector('path');
    expect(circle).toHaveAttribute('stroke', 'red');
    expect(path).toHaveAttribute('fill', 'red');
  });

  it('renders with loading message when provided', () => {
    render(<LoadingSpinner message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-spinner" />);
    expect(document.querySelector('svg')).toHaveClass('custom-spinner');
  });

  it('renders container with proper structure', () => {
    render(<LoadingSpinner />);
    const container = document.querySelector('.flex.flex-col.items-center.justify-center');
    expect(container).toBeInTheDocument();
  });

  it('renders message with proper styling', () => {
    render(<LoadingSpinner message="Loading..." />);
    const message = screen.getByText('Loading...');
    expect(message).toHaveClass('mt-2', 'text-sm', 'text-gray-600');
  });

  it('uses currentColor as default color', () => {
    render(<LoadingSpinner />);
    const svg = document.querySelector('svg');
    const circle = svg?.querySelector('circle');
    const path = svg?.querySelector('path');
    expect(circle).toHaveAttribute('stroke', 'currentColor');
    expect(path).toHaveAttribute('fill', 'currentColor');
  });

  it('renders SVG with proper viewBox and attributes', () => {
    render(<LoadingSpinner />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('fill', 'none');
  });

  it('renders without message by default', () => {
    render(<LoadingSpinner />);
    const container = document.querySelector('.flex.flex-col.items-center.justify-center');
    expect(container?.children).toHaveLength(1); // Only SVG, no message
  });
});