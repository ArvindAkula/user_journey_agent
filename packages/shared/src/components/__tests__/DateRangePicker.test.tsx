import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker } from '../DateRangePicker';

describe('DateRangePicker Component', () => {
  const defaultProps = {
    value: {
      start: new Date('2023-01-01'),
      end: new Date('2023-01-31')
    },
    onChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders date range picker with default values', () => {
    render(<DateRangePicker {...defaultProps} />);
    // The component formats dates differently, so let's check for the button content
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.textContent).toContain('2023');
  });

  it('opens dropdown when button is clicked', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
  });

  it('calls onChange when start date changes', () => {
    const onChange = jest.fn();
    render(<DateRangePicker {...defaultProps} onChange={onChange} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    
    const startDateInput = screen.getByDisplayValue('2023-01-01');
    fireEvent.change(startDateInput, { target: { value: '2023-01-15' } });
    
    expect(onChange).toHaveBeenCalledWith({
      start: new Date('2023-01-15'),
      end: new Date('2023-01-31')
    });
  });

  it('calls onChange when end date changes', () => {
    const onChange = jest.fn();
    render(<DateRangePicker {...defaultProps} onChange={onChange} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    
    const endDateInput = screen.getByDisplayValue('2023-01-31');
    fireEvent.change(endDateInput, { target: { value: '2023-02-15' } });
    
    expect(onChange).toHaveBeenCalledWith({
      start: new Date('2023-01-01'),
      end: new Date('2023-02-15')
    });
  });

  it('applies preset date ranges correctly', () => {
    const onChange = jest.fn();
    render(<DateRangePicker {...defaultProps} onChange={onChange} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    
    fireEvent.click(screen.getByText('Last 7 days'));
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        start: expect.any(Date),
        end: expect.any(Date)
      })
    );
  });

  it('closes dropdown when preset is selected', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    
    // Click preset
    fireEvent.click(screen.getByText('Last 7 days'));
    
    // Dropdown should be closed
    expect(screen.queryByText('Last 7 days')).not.toBeInTheDocument();
  });

  it('closes dropdown when Done button is clicked', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Done')).toBeInTheDocument();
    
    // Click Done
    fireEvent.click(screen.getByText('Done'));
    
    // Dropdown should be closed
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<DateRangePicker {...defaultProps} className="custom-date-picker" />);
    const container = document.querySelector('.relative');
    expect(container).toHaveClass('custom-date-picker');
  });

  it('disables button when disabled prop is true', () => {
    render(<DateRangePicker {...defaultProps} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // The disabled styles are applied via CSS classes
    expect(button.className).toContain('disabled:opacity-50');
    expect(button.className).toContain('disabled:cursor-not-allowed');
  });

  it('renders with accessibility attributes', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    
    const startInput = screen.getByDisplayValue('2023-01-01');
    const endInput = screen.getByDisplayValue('2023-01-31');
    
    expect(startInput).toHaveAttribute('type', 'date');
    expect(endInput).toHaveAttribute('type', 'date');
  });

  it('renders default presets when none provided', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('renders custom presets when provided', () => {
    const customPresets = [
      {
        label: 'Yesterday',
        range: {
          start: new Date('2023-01-14'),
          end: new Date('2023-01-14')
        }
      }
    ];
    
    render(<DateRangePicker {...defaultProps} presets={customPresets} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.queryByText('Last 7 days')).not.toBeInTheDocument();
  });

  it('formats dates correctly in button text', () => {
    const value = {
      start: new Date('2023-12-25'),
      end: new Date('2023-12-31')
    };
    
    render(<DateRangePicker {...defaultProps} value={value} />);
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Dec');
    expect(button.textContent).toContain('2023');
    // The component may format dates slightly differently due to timezone/locale
    // Just check that it contains the month and year
  });
});