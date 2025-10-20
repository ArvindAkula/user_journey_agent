import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    
    const overlay = document.querySelector('.fixed.inset-0');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    
    fireEvent.click(screen.getByText('Modal content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when closeOnEscape is false', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} closeOnEscape={false} />);
    
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on overlay click when closeOnOverlayClick is false', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false} />);
    
    const overlay = document.querySelector('.fixed.inset-0');
    fireEvent.click(overlay!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies custom size classes', () => {
    const { rerender } = render(<Modal {...defaultProps} size="small" />);
    const modalContent = document.querySelector('.bg-white.rounded-lg');
    expect(modalContent).toHaveClass('max-w-md');

    rerender(<Modal {...defaultProps} size="medium" />);
    expect(modalContent).toHaveClass('max-w-lg');

    rerender(<Modal {...defaultProps} size="large" />);
    expect(modalContent).toHaveClass('max-w-4xl');

    rerender(<Modal {...defaultProps} size="full" />);
    expect(modalContent).toHaveClass('max-w-full');
  });

  it('renders without title when not provided', () => {
    render(<Modal {...defaultProps} title={undefined} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Modal {...defaultProps} className="custom-modal" />);
    const modalContent = document.querySelector('.bg-white.rounded-lg');
    expect(modalContent).toHaveClass('custom-modal');
  });

  it('hides close button when showCloseButton is false', () => {
    render(<Modal {...defaultProps} showCloseButton={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders title as heading when provided', () => {
    render(<Modal {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Test Modal');
    expect(heading).toHaveClass('text-xl', 'font-semibold', 'text-gray-900');
  });

  it('sets body overflow to hidden when modal is open', () => {
    render(<Modal {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when modal is closed', () => {
    const { rerender } = render(<Modal {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(<Modal {...defaultProps} isOpen={false} />);
    expect(document.body.style.overflow).toBe('unset');
  });

  it('renders overlay with correct classes', () => {
    render(<Modal {...defaultProps} />);
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).toHaveClass('z-50', 'flex', 'items-center', 'justify-center', 'bg-black', 'bg-opacity-50');
  });

  it('renders modal content with correct classes', () => {
    render(<Modal {...defaultProps} />);
    const modalContent = document.querySelector('.bg-white.rounded-lg');
    expect(modalContent).toHaveClass('shadow-xl', 'w-full', 'max-h-screen', 'overflow-y-auto');
  });
});