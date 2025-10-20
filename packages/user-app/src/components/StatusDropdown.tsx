import React, { useState, useEffect, useRef } from 'react';
import './StatusDropdown.css';

const StatusDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [backendInfo, setBackendInfo] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/health');
        if (response.ok) {
          const data = await response.json();
          setBackendInfo(data);
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (error) {
        console.error('Backend connection error:', error);
        setBackendStatus('error');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getStatusIcon = () => {
    switch (backendStatus) {
      case 'checking':
        return '⏳';
      case 'connected':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'checking':
        return 'Checking';
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
    }
  };

  const getStatusClass = () => {
    switch (backendStatus) {
      case 'checking':
        return 'status-checking';
      case 'connected':
        return 'status-connected';
      case 'error':
        return 'status-error';
    }
  };

  return (
    <div className="status-dropdown" ref={dropdownRef}>
      <button
        className={`status-trigger ${getStatusClass()}`}
        onClick={() => setIsOpen(!isOpen)}
        title="System Status"
      >
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="status-dropdown-menu">
          <div className="dropdown-header">
            <span className="dropdown-title">System Status</span>
          </div>

          <div className="dropdown-content">
            <div className="status-item">
              <span className="item-label">Backend:</span>
              <span className={`item-value ${getStatusClass()}`}>
                {getStatusIcon()} {getStatusText()}
              </span>
            </div>

            {backendInfo && (
              <>
                <div className="status-divider"></div>
                <div className="status-item">
                  <span className="item-label">Service:</span>
                  <span className="item-value">{backendInfo.service}</span>
                </div>
                <div className="status-item">
                  <span className="item-label">Version:</span>
                  <span className="item-value">{backendInfo.version}</span>
                </div>
                <div className="status-item">
                  <span className="item-label">Status:</span>
                  <span className="item-value">{backendInfo.status}</span>
                </div>
                <div className="status-item">
                  <span className="item-label">Real-time:</span>
                  <span className="item-value">{backendInfo.realTimeEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="status-item">
                  <span className="item-label">Uptime:</span>
                  <span className="item-value">{backendInfo.uptime}</span>
                </div>
              </>
            )}

            <div className="status-divider"></div>
            <div className="demo-notice">
              <span className="notice-icon">ℹ️</span>
              <span className="notice-text">Demo Mode Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusDropdown;
