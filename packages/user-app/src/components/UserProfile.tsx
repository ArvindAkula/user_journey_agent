import React, { useState, useRef, useEffect } from 'react';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../config';
import './UserProfile.css';

interface UserProfileProps {
  onProfileUpdated: () => void;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  avatar?: string;
  bio?: string;
  preferences: UserPreferences;
  createdAt: Date;
  lastLoginAt: Date;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  language: string;
  timezone: string;
  currency: string;
  privacy: {
    profileVisibility: 'public' | 'private';
    dataSharing: boolean;
    analytics: boolean;
  };
}

const UserProfile: React.FC<UserProfileProps> = ({ onProfileUpdated }) => {
  // Create event service instance
  const eventService = new EventService({
    baseURL: config.apiBaseUrl,
    timeout: 5000,
    batchSize: 5,
    flushInterval: 3000,
    maxRetries: 3,
    retryDelay: 1000,
    enableOfflineQueue: true,
    maxOfflineEvents: 500
  });

  const { 
    trackFeatureInteraction, 
    trackUserAction, 
    trackError,
    trackFormInteraction,
    trackButtonClick
  } = useEventTracking({
    eventService,
    userId: 'demo-user',
    sessionId: `demo-session-${Date.now()}`,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  const [profile, setProfile] = useState<UserProfile>({
    id: 'demo-user-123',
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@example.com',
    phone: '+1 (555) 123-4567',
    dateOfBirth: '1990-01-01',
    bio: 'Exploring financial planning tools and learning about user journey analytics.',
    preferences: {
      theme: 'light',
      notifications: {
        email: true,
        push: false,
        marketing: false
      },
      language: 'en',
      timezone: 'America/New_York',
      currency: 'USD',
      privacy: {
        profileVisibility: 'private',
        dataSharing: false,
        analytics: true
      }
    },
    createdAt: new Date('2024-01-15'),
    lastLoginAt: new Date()
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'privacy'>('profile');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile from localStorage on component mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        const profileData = {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          lastLoginAt: new Date(parsed.lastLoginAt)
        };
        setProfile(profileData);
        setEditedProfile(profileData);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }

    // Track profile page view
    trackFeatureInteraction('user_profile_view', true, {
      attemptCount: 1
    });

    trackUserAction('profile_page_view', {
      profileComplete: isProfileComplete(profile),
      hasAvatar: !!profile.avatar,
      memberSince: profile.createdAt.toISOString()
    });
  }, []);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(profile));
  }, [profile]);

  const isProfileComplete = (userProfile: UserProfile): boolean => {
    return !!(
      userProfile.firstName &&
      userProfile.lastName &&
      userProfile.email &&
      userProfile.phone &&
      userProfile.dateOfBirth
    );
  };

  const validateProfile = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedProfile.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!editedProfile.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!editedProfile.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedProfile.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (editedProfile.phone && !/^\+?[\d\s\-\(\)]+$/.test(editedProfile.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (editedProfile.dateOfBirth) {
      const birthDate = new Date(editedProfile.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 13 || age > 120) {
        newErrors.dateOfBirth = 'Please enter a valid date of birth';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setErrors({ avatar: 'Avatar image must be less than 5MB' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrors({ avatar: 'Please select an image file' });
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const avatarUrl = e.target?.result as string;
      setEditedProfile(prev => ({ ...prev, avatar: avatarUrl }));
      setShowAvatarUpload(false);
      setErrors(prev => ({ ...prev, avatar: '' }));
      
      trackUserAction('avatar_uploaded', {
        fileSize: file.size,
        fileType: file.type,
        hasExistingAvatar: !!profile.avatar
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) {
      trackUserAction('profile_validation_failed', {
        errors: Object.keys(errors),
        errorCount: Object.keys(errors).length
      });
      return;
    }

    setIsSaving(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      const updatedProfile = {
        ...editedProfile,
        lastLoginAt: new Date()
      };

      setProfile(updatedProfile);
      setIsEditing(false);
      setIsSaving(false);

      trackFeatureInteraction('profile_update_success', true, {
        profileComplete: isProfileComplete(updatedProfile),
        hasAvatar: !!updatedProfile.avatar,
        changedFields: getChangedFields(profile, updatedProfile)
      });

      onProfileUpdated();

    } catch (error) {
      setIsSaving(false);
      setErrors({ general: 'Failed to save profile. Please try again.' });
      
      trackError('Profile save failed', {
        component: 'UserProfile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const getChangedFields = (original: UserProfile, updated: UserProfile): string[] => {
    const changed: string[] = [];
    if (original.firstName !== updated.firstName) changed.push('firstName');
    if (original.lastName !== updated.lastName) changed.push('lastName');
    if (original.email !== updated.email) changed.push('email');
    if (original.phone !== updated.phone) changed.push('phone');
    if (original.dateOfBirth !== updated.dateOfBirth) changed.push('dateOfBirth');
    if (original.bio !== updated.bio) changed.push('bio');
    if (original.avatar !== updated.avatar) changed.push('avatar');
    return changed;
  };

  const handleCancelEdit = () => {
    setEditedProfile(profile);
    setIsEditing(false);
    setErrors({});
    setShowAvatarUpload(false);
    
    trackUserAction('profile_edit_cancelled', {
      hadChanges: JSON.stringify(profile) !== JSON.stringify(editedProfile)
    });
  };

  const getProfileCompletionPercentage = (): number => {
    const fields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'bio', 'avatar'];
    const completed = fields.filter(field => {
      const value = profile[field as keyof UserProfile];
      return value && value.toString().trim() !== '';
    }).length;
    return Math.round((completed / fields.length) * 100);
  };

  const formatMemberSince = (date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays <= 7) return `${diffDays} days ago`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h2>User Profile</h2>
        <p>Manage your account information and preferences</p>
      </div>

      <div className="profile-completion">
        <div className="completion-bar">
          <div 
            className="completion-fill" 
            style={{ width: `${getProfileCompletionPercentage()}%` }}
          />
        </div>
        <span className="completion-text">
          Profile {getProfileCompletionPercentage()}% complete
        </span>
      </div>

      <div className="profile-tabs">
        <button
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('profile');
            trackButtonClick('profile-tab', 'Profile Tab');
          }}
        >
          👤 Profile
        </button>
        <button
          className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('preferences');
            trackButtonClick('preferences-tab', 'Preferences Tab');
          }}
        >
          ⚙️ Preferences
        </button>
        <button
          className={`tab-button ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('privacy');
            trackButtonClick('privacy-tab', 'Privacy Tab');
          }}
        >
          🔒 Privacy
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="profile-content">
          <div className="profile-card">
            <div className="profile-avatar-section">
              <div className="avatar-container">
                {(isEditing ? editedProfile.avatar : profile.avatar) ? (
                  <img 
                    src={isEditing ? editedProfile.avatar : profile.avatar} 
                    alt="Profile Avatar"
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    <span className="avatar-initials">
                      {profile.firstName[0]}{profile.lastName[0]}
                    </span>
                  </div>
                )}
                
                {isEditing && (
                  <button
                    className="avatar-edit-button"
                    onClick={() => {
                      setShowAvatarUpload(true);
                      trackButtonClick('avatar-edit', 'Edit Avatar');
                    }}
                  >
                    📷
                  </button>
                )}
              </div>
              
              {!isEditing && (
                <div className="profile-summary">
                  <h3>{profile.firstName} {profile.lastName}</h3>
                  <p className="profile-email">{profile.email}</p>
                  <p className="member-since">Member since {formatMemberSince(profile.createdAt)}</p>
                </div>
              )}
            </div>

            {showAvatarUpload && (
              <div className="avatar-upload-modal">
                <div className="modal-overlay" onClick={() => setShowAvatarUpload(false)} />
                <div className="avatar-upload-content">
                  <h3>Upload Avatar</h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="upload-button"
                  >
                    Choose Image
                  </button>
                  <p className="upload-hint">Max size: 5MB. Supported: JPG, PNG, GIF</p>
                  {errors.avatar && <span className="error-text">{errors.avatar}</span>}
                  <button
                    onClick={() => setShowAvatarUpload(false)}
                    className="cancel-button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="profile-form">
              {errors.general && (
                <div className="error-message">{errors.general}</div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    value={isEditing ? editedProfile.firstName : profile.firstName}
                    onChange={(e) => {
                      if (isEditing) {
                        setEditedProfile(prev => ({ ...prev, firstName: e.target.value }));
                        trackFormInteraction('user-profile', 'firstName', 'change', e.target.value);
                      }
                    }}
                    disabled={!isEditing}
                    className={errors.firstName ? 'error' : ''}
                  />
                  {errors.firstName && <span className="error-text">{errors.firstName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    value={isEditing ? editedProfile.lastName : profile.lastName}
                    onChange={(e) => {
                      if (isEditing) {
                        setEditedProfile(prev => ({ ...prev, lastName: e.target.value }));
                        trackFormInteraction('user-profile', 'lastName', 'change', e.target.value);
                      }
                    }}
                    disabled={!isEditing}
                    className={errors.lastName ? 'error' : ''}
                  />
                  {errors.lastName && <span className="error-text">{errors.lastName}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  value={isEditing ? editedProfile.email : profile.email}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditedProfile(prev => ({ ...prev, email: e.target.value }));
                      trackFormInteraction('user-profile', 'email', 'change', e.target.value);
                    }
                  }}
                  disabled={!isEditing}
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    value={isEditing ? (editedProfile.phone || '') : (profile.phone || '')}
                    onChange={(e) => {
                      if (isEditing) {
                        setEditedProfile(prev => ({ ...prev, phone: e.target.value }));
                        trackFormInteraction('user-profile', 'phone', 'change', e.target.value);
                      }
                    }}
                    disabled={!isEditing}
                    className={errors.phone ? 'error' : ''}
                    placeholder="+1 (555) 123-4567"
                  />
                  {errors.phone && <span className="error-text">{errors.phone}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="dateOfBirth">Date of Birth</label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    value={isEditing ? (editedProfile.dateOfBirth || '') : (profile.dateOfBirth || '')}
                    onChange={(e) => {
                      if (isEditing) {
                        setEditedProfile(prev => ({ ...prev, dateOfBirth: e.target.value }));
                        trackFormInteraction('user-profile', 'dateOfBirth', 'change', e.target.value);
                      }
                    }}
                    disabled={!isEditing}
                    className={errors.dateOfBirth ? 'error' : ''}
                  />
                  {errors.dateOfBirth && <span className="error-text">{errors.dateOfBirth}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  value={isEditing ? (editedProfile.bio || '') : (profile.bio || '')}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditedProfile(prev => ({ ...prev, bio: e.target.value }));
                      trackFormInteraction('user-profile', 'bio', 'change', e.target.value);
                    }
                  }}
                  disabled={!isEditing}
                  rows={3}
                  placeholder="Tell us a bit about yourself..."
                />
              </div>

              <div className="profile-actions">
                {!isEditing ? (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      trackButtonClick('edit-profile', 'Edit Profile');
                    }}
                    className="edit-button"
                  >
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="save-button"
                    >
                      {isSaving ? 'Saving...' : '💾 Save Changes'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="preferences-content">
          <div className="preferences-card">
            <h3>Display Preferences</h3>
            
            <div className="preference-group">
              <label htmlFor="theme">Theme</label>
              <select
                id="theme"
                value={editedProfile.preferences.theme}
                onChange={(e) => {
                  const newTheme = e.target.value as 'light' | 'dark' | 'auto';
                  setEditedProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, theme: newTheme }
                  }));
                  trackFormInteraction('user-profile', 'theme', 'change', newTheme);
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>

            <div className="preference-group">
              <label htmlFor="language">Language</label>
              <select
                id="language"
                value={editedProfile.preferences.language}
                onChange={(e) => {
                  setEditedProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, language: e.target.value }
                  }));
                  trackFormInteraction('user-profile', 'language', 'change', e.target.value);
                }}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <div className="preference-group">
              <label htmlFor="timezone">Timezone</label>
              <select
                id="timezone"
                value={editedProfile.preferences.timezone}
                onChange={(e) => {
                  setEditedProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, timezone: e.target.value }
                  }));
                  trackFormInteraction('user-profile', 'timezone', 'change', e.target.value);
                }}
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div className="preference-group">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                value={editedProfile.preferences.currency}
                onChange={(e) => {
                  setEditedProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, currency: e.target.value }
                  }));
                  trackFormInteraction('user-profile', 'currency', 'change', e.target.value);
                }}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </div>
          </div>

          <div className="preferences-card">
            <h3>Notification Preferences</h3>
            
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedProfile.preferences.notifications.email}
                  onChange={(e) => {
                    setEditedProfile(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        notifications: {
                          ...prev.preferences.notifications,
                          email: e.target.checked
                        }
                      }
                    }));
                    trackFormInteraction('user-profile', 'emailNotifications', 'change', e.target.checked.toString());
                  }}
                />
                <span>Email Notifications</span>
              </label>
              <p className="checkbox-description">Receive important updates via email</p>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedProfile.preferences.notifications.push}
                  onChange={(e) => {
                    setEditedProfile(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        notifications: {
                          ...prev.preferences.notifications,
                          push: e.target.checked
                        }
                      }
                    }));
                    trackFormInteraction('user-profile', 'pushNotifications', 'change', e.target.checked.toString());
                  }}
                />
                <span>Push Notifications</span>
              </label>
              <p className="checkbox-description">Receive real-time notifications in your browser</p>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedProfile.preferences.notifications.marketing}
                  onChange={(e) => {
                    setEditedProfile(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        notifications: {
                          ...prev.preferences.notifications,
                          marketing: e.target.checked
                        }
                      }
                    }));
                    trackFormInteraction('user-profile', 'marketingNotifications', 'change', e.target.checked.toString());
                  }}
                />
                <span>Marketing Communications</span>
              </label>
              <p className="checkbox-description">Receive tips, updates, and promotional content</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="privacy-content">
          <div className="privacy-card">
            <h3>Privacy Settings</h3>
            
            <div className="privacy-group">
              <label htmlFor="profileVisibility">Profile Visibility</label>
              <select
                id="profileVisibility"
                value={editedProfile.preferences.privacy.profileVisibility}
                onChange={(e) => {
                  const visibility = e.target.value as 'public' | 'private';
                  setEditedProfile(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      privacy: {
                        ...prev.preferences.privacy,
                        profileVisibility: visibility
                      }
                    }
                  }));
                  trackFormInteraction('user-profile', 'profileVisibility', 'change', visibility);
                }}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <p className="privacy-description">
                Control who can see your profile information
              </p>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedProfile.preferences.privacy.dataSharing}
                  onChange={(e) => {
                    setEditedProfile(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        privacy: {
                          ...prev.preferences.privacy,
                          dataSharing: e.target.checked
                        }
                      }
                    }));
                    trackFormInteraction('user-profile', 'dataSharing', 'change', e.target.checked.toString());
                  }}
                />
                <span>Allow Data Sharing</span>
              </label>
              <p className="checkbox-description">
                Share anonymized usage data to help improve our services
              </p>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedProfile.preferences.privacy.analytics}
                  onChange={(e) => {
                    setEditedProfile(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        privacy: {
                          ...prev.preferences.privacy,
                          analytics: e.target.checked
                        }
                      }
                    }));
                    trackFormInteraction('user-profile', 'analytics', 'change', e.target.checked.toString());
                  }}
                />
                <span>Analytics Tracking</span>
              </label>
              <p className="checkbox-description">
                Allow us to track your usage for analytics and personalization
              </p>
            </div>
          </div>

          <div className="privacy-card">
            <h3>Data Management</h3>
            
            <div className="data-action">
              <h4>Export Your Data</h4>
              <p>Download a copy of all your data in JSON format</p>
              <button
                onClick={() => {
                  const dataBlob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(dataBlob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `user-data-${profile.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  
                  trackButtonClick('export-data', 'Export User Data');
                }}
                className="export-button"
              >
                📥 Export Data
              </button>
            </div>

            <div className="data-action danger">
              <h4>Delete Account</h4>
              <p>Permanently delete your account and all associated data</p>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                    trackButtonClick('delete-account', 'Delete Account Confirmed');
                    alert('Account deletion requested. This is a demo, so no actual deletion occurred.');
                  }
                }}
                className="delete-button"
              >
                🗑️ Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'preferences' || activeTab === 'privacy') && (
        <div className="preferences-actions">
          <button
            onClick={() => {
              setProfile(editedProfile);
              trackButtonClick('save-preferences', 'Save Preferences', { activeTab });
              onProfileUpdated();
            }}
            className="save-preferences-button"
          >
            💾 Save Preferences
          </button>
          <button
            onClick={() => {
              setEditedProfile(profile);
              trackButtonClick('reset-preferences', 'Reset Preferences', { activeTab });
            }}
            className="reset-preferences-button"
          >
            Reset Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;