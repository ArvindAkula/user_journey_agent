import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TabNavigation from '../TabNavigation';
import { useEventTracking } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useEventTracking: jest.fn()
}));

const mockTrackEvent = jest.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('TabNavigation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
  });

  it('renders all navigation tabs', () => {
    renderWithRouter(<TabNavigation />);
    
    expect(screen.getByRole('tab', { name: /demo/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /videos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /calculator/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument();
  });

  it('highlights active tab based on current route', () => {
    // Mock current location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/videos' },
      writable: true
    });
    
    renderWithRouter(<TabNavigation />);
    
    const videosTab = screen.getByRole('tab', { name: /videos/i });
    expect(videosTab).toHaveAttribute('aria-selected', 'true');
    expect(videosTab).toHaveClass('active');
  });

  it('tracks navigation events when tabs are clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<TabNavigation />);
    
    const calculatorTab = screen.getByRole('tab', { name: /calculator/i });
    await user.click(calculatorTab);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('navigation', {
      from: '/',
      to: '/calculator',
      method: 'tab_click'
    });
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithRouter(<TabNavigation />);
    
    const demoTab = screen.getByRole('tab', { name: /demo/i });
    demoTab.focus();
    
    // Navigate with arrow keys
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /videos/i })).toHaveFocus();
    
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /calculator/i })).toHaveFocus();
    
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /videos/i })).toHaveFocus();
  });

  it('wraps around when navigating with keyboard', async () => {
    const user = userEvent.setup();
    renderWithRouter(<TabNavigation />);
    
    const profileTab = screen.getByRole('tab', { name: /profile/i });
    profileTab.focus();
    
    // Navigate past the last tab
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /demo/i })).toHaveFocus();
    
    // Navigate before the first tab
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveFocus();
  });

  it('activates tab with Enter or Space key', async () => {
    const user = userEvent.setup();
    renderWithRouter(<TabNavigation />);
    
    const videosTab = screen.getByRole('tab', { name: /videos/i });
    videosTab.focus();
    
    await user.keyboard('{Enter}');
    
    expect(mockTrackEvent).toHaveBeenCalledWith('navigation', {
      from: '/',
      to: '/videos',
      method: 'keyboard'
    });
  });

  it('displays tab icons correctly', () => {
    renderWithRouter(<TabNavigation />);
    
    const demoTab = screen.getByRole('tab', { name: /demo/i });
    const videosTab = screen.getByRole('tab', { name: /videos/i });
    const calculatorTab = screen.getByRole('tab', { name: /calculator/i });
    
    expect(demoTab.querySelector('.icon')).toBeInTheDocument();
    expect(videosTab.querySelector('.icon')).toBeInTheDocument();
    expect(calculatorTab.querySelector('.icon')).toBeInTheDocument();
  });

  it('handles tab hover states', async () => {
    const user = userEvent.setup();
    renderWithRouter(<TabNavigation />);
    
    const videosTab = screen.getByRole('tab', { name: /videos/i });
    
    await user.hover(videosTab);
    expect(videosTab).toHaveClass('hover');
    
    await user.unhover(videosTab);
    expect(videosTab).not.toHaveClass('hover');
  });

  it('maintains accessibility attributes', () => {
    renderWithRouter(<TabNavigation />);
    
    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveAttribute('aria-label', 'Main navigation');
    
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab, index) => {
      expect(tab).toHaveAttribute('tabindex');
      expect(tab).toHaveAttribute('aria-selected');
    });
  });

  it('updates active state when route changes', () => {
    const { rerender } = renderWithRouter(<TabNavigation />);
    
    // Initially on home
    expect(screen.getByRole('tab', { name: /demo/i })).toHaveAttribute('aria-selected', 'true');
    
    // Change route
    Object.defineProperty(window, 'location', {
      value: { pathname: '/calculator' },
      writable: true
    });
    
    rerender(
      <BrowserRouter>
        <TabNavigation />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('tab', { name: /calculator/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /demo/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('handles disabled tabs appropriately', () => {
    // Mock a scenario where profile tab might be disabled
    renderWithRouter(<TabNavigation disabled={['profile']} />);
    
    const profileTab = screen.getByRole('tab', { name: /profile/i });
    expect(profileTab).toHaveAttribute('aria-disabled', 'true');
    expect(profileTab).toHaveClass('disabled');
  });
});