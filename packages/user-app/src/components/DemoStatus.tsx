import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DemoStatus.css';

const DemoStatus: React.FC = () => {
    const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
    const [backendInfo, setBackendInfo] = useState<any>(null);

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
    }, []);

    const getStatusBadge = () => {
        switch (backendStatus) {
            case 'checking':
                return <span className="status-badge status-checking">⏳ Checking...</span>;
            case 'connected':
                return <span className="status-badge status-connected">✅ Connected</span>;
            case 'error':
                return <span className="status-badge status-error">❌ Connection Error</span>;
        }
    };

    return (
        <div className="demo-status-container">
            <div className="demo-status-header">
                <h2>
                    <span>🚀</span>
                    <span>User Journey Analytics - Demo Mode</span>
                </h2>
            </div>

            <div className="demo-status-content">
                <div className="status-section">
                    <div className="section-title">Backend Status</div>
                    {getStatusBadge()}
                </div>

                {backendInfo && (
                    <div className="status-section">
                        <div className="section-title">Backend Info</div>
                        <div className="backend-info-grid">
                            <div className="info-item">
                                <span className="info-label">Service:</span>
                                <span className="info-value">{backendInfo.service}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Version:</span>
                                <span className="info-value">{backendInfo.version}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Status:</span>
                                <span className="info-value">{backendInfo.status}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Real-time:</span>
                                <span className="info-value">{backendInfo.realTimeEnabled ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Uptime:</span>
                                <span className="info-value">{backendInfo.uptime}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="status-section">
                    <div className="section-title">Available Features</div>
                    <div className="features-grid">
                        <Link to="/videos" className="feature-link">
                            <span className="feature-icon">📹</span>
                            <span className="feature-text">Video Library</span>
                        </Link>
                        <Link to="/calculator" className="feature-link">
                            <span className="feature-icon">🧮</span>
                            <span className="feature-text">Financial Calculator</span>
                        </Link>
                        <Link to="/documents" className="feature-link">
                            <span className="feature-icon">📄</span>
                            <span className="feature-text">Document Upload</span>
                        </Link>
                        <Link to="/profile" className="feature-link">
                            <span className="feature-icon">👤</span>
                            <span className="feature-text">User Profile</span>
                        </Link>
                    </div>
                </div>

                <div className="demo-mode-notice">
                    <span className="notice-icon">ℹ️</span>
                    <div className="notice-content">
                        <div className="notice-title">Demo Mode</div>
                        <p className="notice-text">
                            Authentication disabled, analytics disabled, but backend connections are working for core functionality.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoStatus;