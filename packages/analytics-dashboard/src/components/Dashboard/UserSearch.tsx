import React, { useState, useEffect } from 'react';
import './UserSearch.css';

interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  lastActive?: string;
  eventCount?: number;
}

interface UserSearchProps {
  onUserSelect: (userId: string) => void;
  selectedUserId?: string;
}

const UserSearch: React.FC<UserSearchProps> = ({ onUserSelect, selectedUserId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch users from backend and auto-select first user
  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-select first user when users are loaded
  useEffect(() => {
    if (Array.isArray(users) && users.length > 0 && !selectedUserId) {
      const firstUser = users[0];
      onUserSelect(firstUser.userId);
      setSearchQuery(firstUser.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, selectedUserId]);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(user => 
        user.email.toLowerCase().includes(query) ||
        user.userId.toLowerCase().includes(query) ||
        (user.firstName && user.firstName.toLowerCase().includes(query)) ||
        (user.lastName && user.lastName.toLowerCase().includes(query))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/analytics/users');
      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array
        const usersArray = Array.isArray(data) ? data : [];
        setUsers(usersArray);
        setFilteredUsers(usersArray);
      } else {
        console.error('Failed to fetch users:', response.status);
        setUsers([]);
        setFilteredUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    onUserSelect(userId);
    setIsDropdownOpen(false);
    
    // Update search query to show selected user
    const selectedUser = Array.isArray(users) ? users.find(u => u.userId === userId) : undefined;
    if (selectedUser) {
      setSearchQuery(selectedUser.email);
    }
  };

  const handleClearSelection = () => {
    onUserSelect('');
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const selectedUser = Array.isArray(users) && selectedUserId ? users.find(u => u.userId === selectedUserId) : undefined;

  return (
    <div className="user-search-container">
      <div className="user-search-header">
        <h3>👤 Selected User</h3>
        <p>Viewing analytics for the selected user</p>
      </div>

      <div className="search-box">
        <div className="search-input-wrapper">
          <span className="search-icon">🔎</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by email, name, or user ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            autoComplete="off"
          />
          {selectedUserId && (
            <button className="clear-button" onClick={handleClearSelection}>
              ✕
            </button>
          )}
        </div>

        {isDropdownOpen && Array.isArray(filteredUsers) && filteredUsers.length > 0 && (
          <div className="search-dropdown">
            <div className="dropdown-header">
              <span>{filteredUsers.length} user(s) found</span>
            </div>
            <div className="user-list">
              {filteredUsers.map((user) => (
                <div
                  key={user.userId}
                  className={`user-item ${user.userId === selectedUserId ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(user.userId)}
                >
                  <div className="user-avatar">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <div className="user-name">
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user.email}
                    </div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-meta">
                      <span className="user-id">ID: {user.userId}</span>
                      {user.eventCount !== undefined && (
                        <span className="event-count">• {user.eventCount} events</span>
                      )}
                    </div>
                  </div>
                  {user.userId === selectedUserId && (
                    <span className="selected-badge">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isDropdownOpen && Array.isArray(filteredUsers) && filteredUsers.length === 0 && searchQuery && (
          <div className="search-dropdown">
            <div className="no-results">
              <span className="no-results-icon">🔍</span>
              <p>No users found matching "{searchQuery}"</p>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="selected-user-card">
          <div className="card-header">
            <span className="card-icon">👤</span>
            <span className="card-title">Selected User</span>
          </div>
          <div className="card-content">
            <div className="user-detail">
              <span className="detail-label">Name:</span>
              <span className="detail-value">
                {selectedUser.firstName && selectedUser.lastName
                  ? `${selectedUser.firstName} ${selectedUser.lastName}`
                  : 'N/A'}
              </span>
            </div>
            <div className="user-detail">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{selectedUser.email}</span>
            </div>
            <div className="user-detail">
              <span className="detail-label">User ID:</span>
              <span className="detail-value">{selectedUser.userId}</span>
            </div>
            {selectedUser.eventCount !== undefined && (
              <div className="user-detail">
                <span className="detail-label">Total Events:</span>
                <span className="detail-value">{selectedUser.eventCount}</span>
              </div>
            )}
            {selectedUser.lastActive && (
              <div className="user-detail">
                <span className="detail-label">Last Active:</span>
                <span className="detail-value">{selectedUser.lastActive}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Loading users...</span>
        </div>
      )}
    </div>
  );
};

export default UserSearch;
