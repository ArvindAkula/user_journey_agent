import React, { useState, useEffect } from 'react';
import { useAnalyticsAuth } from '../../contexts/AnalyticsAuthContext';
import { PermissionGuard } from './PermissionGuard';
import { 
  AnalyticsUserManagement, 
  CreateAnalyticsUserRequest, 
  UpdateAnalyticsUserRequest,
  AnalyticsRole,
  ROLE_PERMISSIONS 
} from '@aws-agent/shared';
import './AnalyticsAuth.css';

export const UserManagement: React.FC = () => {
  const { getUsers, createUser, updateUser, deactivateUser, resetUserPassword } = useAnalyticsAuth();
  const [users, setUsers] = useState<AnalyticsUserManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersData = await getUsers();
      setUsers(usersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData: CreateAnalyticsUserRequest) => {
    try {
      await createUser(userData);
      await loadUsers(); // Refresh the list
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      await deactivateUser(userId);
      await loadUsers(); // Refresh the list
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate user');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!window.confirm('Are you sure you want to reset this user\'s password?')) {
      return;
    }

    try {
      const result = await resetUserPassword(userId);
      alert(`Temporary password: ${result.temporaryPassword}\nPlease share this securely with the user.`);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
  };

  if (loading) {
    return <div className="user-management-container">Loading users...</div>;
  }

  return (
    <PermissionGuard permission="manage_users">
      <div className="user-management-container">
        <div className="user-management-header">
          <h2>User Management</h2>
          <button 
            className="add-user-button"
            onClick={() => setShowCreateForm(true)}
          >
            Add New User
          </button>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>
            {error}
            <button 
              onClick={() => setError(null)}
              style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {showCreateForm && (
          <CreateUserForm 
            onSubmit={handleCreateUser}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.firstName} {user.lastName}</td>
                <td>{user.email}</td>
                <td>{user.role.replace(/_/g, ' ').toUpperCase()}</td>
                <td>{user.department || '-'}</td>
                <td>
                  <span className={`user-status ${user.isActive ? 'active' : 'inactive'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
                <td>
                  <div className="user-actions">
                    <button 
                      className="user-action-button edit"
                      onClick={() => {/* TODO: Implement edit */}}
                    >
                      Edit
                    </button>
                    {user.isActive && (
                      <button 
                        className="user-action-button deactivate"
                        onClick={() => handleDeactivateUser(user.id)}
                      >
                        Deactivate
                      </button>
                    )}
                    <button 
                      className="user-action-button reset"
                      onClick={() => handleResetPassword(user.id)}
                    >
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
            No users found
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};

interface CreateUserFormProps {
  onSubmit: (userData: CreateAnalyticsUserRequest) => void;
  onCancel: () => void;
}

const CreateUserForm: React.FC<CreateUserFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<CreateAnalyticsUserRequest>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'analytics_viewer',
    department: '',
    temporaryPassword: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div style={{ 
      background: 'white', 
      padding: '24px', 
      borderRadius: '8px', 
      marginBottom: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Create New User</h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label htmlFor="firstName">First Name</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="lastName">Last Name</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="analytics_viewer">Analytics Viewer</option>
            <option value="analytics_analyst">Analytics Analyst</option>
            <option value="analytics_manager">Analytics Manager</option>
            <option value="analytics_admin">Analytics Admin</option>
            <option value="system_admin">System Admin</option>
          </select>
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="department">Department (Optional)</label>
          <input
            type="text"
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="e.g., Marketing, Product, Engineering"
          />
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ 
            padding: '10px 20px', 
            background: '#f7fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: '6px',
            cursor: 'pointer'
          }}>
            Cancel
          </button>
          <button type="submit" className="add-user-button">
            Create User
          </button>
        </div>
      </form>

      <div style={{ marginTop: '16px', padding: '12px', background: '#f7fafc', borderRadius: '6px' }}>
        <strong>Role Permissions:</strong>
        <ul style={{ marginTop: '8px', marginBottom: 0 }}>
          {ROLE_PERMISSIONS[formData.role as AnalyticsRole]?.map(permission => (
            <li key={permission} style={{ fontSize: '14px', color: '#4a5568' }}>
              {permission.replace(/_/g, ' ').toUpperCase()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};