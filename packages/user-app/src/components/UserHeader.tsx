import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TabNavigation from './TabNavigation';
import StatusDropdown from './StatusDropdown';
import './UserHeader.css';

const UserHeader: React.FC = () => {
  const location = useLocation();
  const { authState, logout, firebaseUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getUserDisplayName = () => {
    if (authState.user?.firstName && authState.user?.lastName) {
      return `${authState.user.firstName} ${authState.user.lastName}`;
    }
    if (firebaseUser?.displayName) {
      return firebaseUser.displayName;
    }
    if (firebaseUser?.email) {
      return firebaseUser.email.split('@')[0];
    }
    return 'User';
  };

  return (
    <header className="user-header">
      <div className="header-container">
        <div className="header-brand">
          <Link to="/" className="brand-link">
            <h1>Mortgage Agent</h1>
            <span className="app-subtitle">Smart Lending Platform</span>
          </Link>
        </div>
        
        <nav className="header-nav">
          <TabNavigation currentPath={location.pathname} />
        </nav>
        
        <div className="header-actions">
          <StatusDropdown />
          <div className="user-menu">
            <span className="user-greeting">
              Hello, {getUserDisplayName()}
            </span>
            <Link to="/profile" className="profile-link">
              Profile
            </Link>
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="logout-button"
            >
              {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default UserHeader;