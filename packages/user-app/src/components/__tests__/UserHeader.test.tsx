import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import UserHeader from '../UserHeader';
import { useAuth } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn()
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  avatar: 'https://example.com/avatar.jpg'
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('UserHeader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header with logo and navigation when user is logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      loading: false
    });
    
    renderWithRouter(<UserHeader />);
    
    expect(screen.getByText(/aws agent/i)).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /videos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /calculator/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /documents/i })).toBeInTheDocument();
  });

  it('renders login button when user is not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      logout: jest.fn(),
      loading: false
    });
    
    renderWithRouter(<UserHeader />);
    
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('displays user avatar when available', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      loading: false
    });
    
    renderWithRouter(<UserHeader />);
    
    const avatar = screen.getByRole('img', { name: /user avatar/i });
    expect(avatar).toHaveAttribute('src', mockUser.avatar);
  });

  it('shows user menu when clicking on user info', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      loading: false
    });
    
    renderWithRouter(<UserHeader />);
    
    const userInfo = screen.getByText('John Doe');
    await user.click(userInfo);
    
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('handles logout functionality', async () => {
    const user = userEvent.setup();
    const mockLogout = jest.fn();
    
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      loading: false
    });
    
    renderWithRouter(<UserHeader />);
    
    const userInfo = screen.getByText('John Doe');
    await user.click(userInfo);
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    await user.click(logoutButton);
    
    expect(mockLogout).toHaveBeenCalled();
  });

  it('highlights active navigation link', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      loading: false
    });
    
    // Mock current location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/videos' },
      writable: true
    });
    
    renderWithRouter(<UserHeader />);
    
    const videosLink = screen.getByRole('link', { name: /videos/i });
    expect(videosLink).toHaveClass('active');
  });

  it('handles mobile menu toggle', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      loading: false
    });
    
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500
    });
    
    renderWithRouter(<UserHeader />);
    
    const menuToggle = screen.getByRole('button', { name: /menu/i });
    await user.click(menuToggle);
    
    expect(screen.getByRole('navigation')).toHaveClass('mobile-open');
  });

  it('displays loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      logout: jest.fn(),
      loading: true
    });
    
    renderWithRouter(<UserHeader />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      loading: false
    });
    
    renderWithRouter(<UserHeader />);
    
    const userInfo = screen.getByText('John Doe');
    
    // Focus and press Enter
    userInfo.focus();
    await user.keyboard('{Enter}');
    
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('closes user menu when clicking outside', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      loading: false
    });
    
    renderWithRouter(<UserHeader />);
    
    const userInfo = screen.getByText('John Doe');
    await user.click(userInfo);
    
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
    
    // Click outside
    await user.click(document.body);
    
    expect(screen.queryByRole('link', { name: /profile/i })).not.toBeInTheDocument();
  });
});