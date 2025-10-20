import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, UserMenu, UserRole } from '@aws-agent/shared';
import './DashboardHeader.css';

const DashboardHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', requiredRole: UserRole.ANALYST },
    { path: '/metrics', label: 'Metrics', icon: '📈', requiredRole: UserRole.ANALYST },
    { path: '/user-journey', label: 'Customer Journey', icon: '🛤️', requiredRole: UserRole.ANALYST },
    { path: '/realtime', label: 'Real-time', icon: '⚡', requiredRole: UserRole.ANALYST },
    { path: '/exports', label: 'Exports', icon: '📤', requiredRole: UserRole.ANALYST },
    { path: '/users', label: 'Users', icon: '👥', requiredRole: UserRole.ADMIN },
  ];

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  const visibleNavigationItems = navigationItems.filter(item => 
    !item.requiredRole || hasRole(item.requiredRole)
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
          <UserMenu
            showRole={true}
            onLogoutSuccess={() => navigate('/login')}
            className="dashboard-user-menu"
          />
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;