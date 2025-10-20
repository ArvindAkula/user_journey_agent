import React from 'react';
import { Link } from 'react-router-dom';
import './TabNavigation.css';

interface TabNavigationProps {
  currentPath: string;
}

interface NavItem {
  path: string;
  label: string;
  description: string;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Home',
    description: 'Welcome & Overview'
  },
  {
    path: '/demo',
    label: 'Demo',
    description: 'Interactive Scenarios'
  },
  {
    path: '/videos',
    label: 'Videos',
    description: 'Learning Content'
  },
  {
    path: '/calculator',
    label: 'Calculator',
    description: 'Interactive Tools'
  },
  {
    path: '/documents',
    label: 'Documents',
    description: 'File Management'
  }
];

const TabNavigation: React.FC<TabNavigationProps> = ({ currentPath }) => {
  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <nav className="tab-navigation">
      <ul className="nav-tabs">
        {navItems.map((item) => (
          <li key={item.path} className="nav-tab">
            <Link
              to={item.path}
              className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
              title={item.description}
            >
              <span className="nav-label">{item.label}</span>
              <span className="nav-description">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TabNavigation;