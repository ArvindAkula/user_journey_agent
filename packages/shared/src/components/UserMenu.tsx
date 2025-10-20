import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface UserMenuProps {
  onLogoutSuccess?: () => void;
  className?: string;
  showRole?: boolean;
}

/**
 * UserMenu component that displays user information and logout button.
 * 
 * This component shows the logged-in user's email and role (optional),
 * and provides a logout button. It includes a dropdown menu for better UX.
 * 
 * @example
 * ```tsx
 * import { useNavigate } from 'react-router-dom';
 * 
 * const navigate = useNavigate();
 * 
 * <UserMenu
 *   showRole={true}
 *   onLogoutSuccess={() => navigate('/login')}
 * />
 * ```
 */
export const UserMenu: React.FC<UserMenuProps> = ({
  onLogoutSuccess,
  className = '',
  showRole = true,
}) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setIsOpen(false);
      
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return null;
  }

  const getInitials = (email: string): string => {
    return email.substring(0, 2).toUpperCase();
  };

  const formatRole = (role: string): string => {
    return role.charAt(0) + role.slice(1).toLowerCase();
  };

  return (
    <div className={`user-menu ${className}`} style={styles.container} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.trigger}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <div style={styles.avatar}>
          {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : getInitials(user.email)}
        </div>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{user.displayName || user.email}</span>
          {showRole && user.role && (
            <span style={styles.userRole}>{formatRole(user.role)}</span>
          )}
        </div>
        <svg
          style={{
            ...styles.chevron,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <div style={styles.dropdownEmail}>{user.email}</div>
            {showRole && user.role && (
              <div style={styles.dropdownRole}>Role: {formatRole(user.role)}</div>
            )}
          </div>
          
          <div style={styles.divider} />
          
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              ...styles.logoutButton,
              ...(isLoggingOut ? styles.logoutButtonDisabled : {}),
            }}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  );
};

// Inline styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: '12px',
    color: '#666',
    textTransform: 'capitalize',
  },
  chevron: {
    transition: 'transform 0.2s',
    color: '#666',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    minWidth: '250px',
    zIndex: 1000,
    overflow: 'hidden',
  },
  dropdownHeader: {
    padding: '16px',
    backgroundColor: '#f8f9fa',
  },
  dropdownEmail: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '4px',
    wordBreak: 'break-word',
  },
  dropdownRole: {
    fontSize: '12px',
    color: '#666',
  },
  divider: {
    height: '1px',
    backgroundColor: '#e0e0e0',
  },
  logoutButton: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left',
    fontSize: '14px',
    color: '#dc3545',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontWeight: '500',
  },
  logoutButtonDisabled: {
    color: '#999',
    cursor: 'not-allowed',
  },
};
