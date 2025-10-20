import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAnalyticsAuth } from '../../contexts/AnalyticsAuthContext';
import { PermissionGuard } from '../Auth/PermissionGuard';
import './DashboardHeader.css';

const DashboardHeader: React.FC = () => {
  const location = useLocation();
  const { user, logout, hasPermission } = useAnalyticsAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', permission: 'view_analytics' },
    { path: '/metrics', label: 'Metrics', icon: '📈', permission: 'view_analytics' },
    { path: '/user-journey', label: 'Customer Journey', icon: '🛤️', permission: 'view_analytics' },
    { path: '/realtime', label: 'Real-time', icon: '⚡', permission: 'access_real_time' },
    { path: '/exports', label: 'Exports', icon: '📤', permission: 'export_data' },
    { path: '/users', label: 'Users', icon: '👥', permission: 'manage_users' },
  ];

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const visibleNavigationItems = navigationItems.filter(item => 
    !item.permission || hasPermission(item.permission as any)
  );

  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="header-brand">
          <h1>Mortgage Analytics Dashboard</h1>
          <span className="header-subtitle">Smart Lending Insights</span>
        </div>
        
        <nav className="header-navigation">
          <ul className="nav-list">
            {visibleNavigationItems.map((item) => (
              <li key={item.path} className="nav-item">
                <Link
                  to={item.path}
                  className={`nav-link ${isActivePath(item.path) ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <PermissionGuard permission="access_real_time" showFallback={false}>
            <button className="header-button">
              <span>🔄</span>
              Refresh
            </button>
          </PermissionGuard>
          
          <div className="user-menu-container">
            <button 
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <span className="user-avatar">👤</span>
              <span className="user-name">{user?.firstName || 'User'}</span>
              <span className="user-role">({user?.role?.replace(/_/g, ' ') || 'Unknown'})</span>
              <span className="dropdown-arrow">▼</span>
            </button>
            
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <div className="user-menu-header">
                  <div className="user-info">
                    <strong>{user?.firstName} {user?.lastName}</strong>
                    <small>{user?.email}</small>
                    <small>{user?.role?.replace(/_/g, ' ').toUpperCase()}</small>
                  </div>
                </div>
                <div className="user-menu-divider"></div>
                <div className="user-menu-items">
                  <button className="user-menu-item">
                    <span>⚙️</span>
                    Settings
                  </button>
                  <button className="user-menu-item">
                    <span>🔑</span>
                    Change Password
                  </button>
                  <div className="user-menu-divider"></div>
                  <button 
                    className="user-menu-item logout"
                    onClick={handleLogout}
                  >
                    <span>🚪</span>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Click outside to close menu */}
      {showUserMenu && (
        <div 
          className="user-menu-overlay"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};

export default DashboardHeader;