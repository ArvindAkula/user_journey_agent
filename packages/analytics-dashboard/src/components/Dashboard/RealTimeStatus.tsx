import React from 'react';

interface RealTimeStatusProps {
  isConnected: boolean;
  isLoading: boolean;
  error?: string | null;
  lastUpdate?: Date | null;
  eventCount?: number;
  onReconnect?: () => void;
}

const RealTimeStatus: React.FC<RealTimeStatusProps> = ({
  isConnected,
  isLoading,
  error,
  lastUpdate,
  eventCount = 0,
  onReconnect
}) => {
  const getStatusColor = () => {
    if (error) return '#e53e3e';
    if (isLoading) return '#4299e1';
    if (isConnected) return '#48bb78';
    return '#f56565';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (isLoading) return 'Connecting...';
    if (isConnected) return 'Live';
    return 'Disconnected';
  };

  const formatLastUpdate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="real-time-status">
      <div className="status-main">
        <div 
          className="status-indicator"
          style={{ backgroundColor: getStatusColor() }}
        />
        <span className="status-text">{getStatusText()}</span>
      </div>
      
      {isConnected && (
        <div className="status-details">
          <span className="event-count">{eventCount} events</span>
          {lastUpdate && (
            <span className="last-update">
              Updated {formatLastUpdate(lastUpdate)}
            </span>
          )}
        </div>
      )}
      
      {error && (
        <div className="error-details">
          <span className="error-message">{error}</span>
          {onReconnect && (
            <button onClick={onReconnect} className="reconnect-button">
              Retry
            </button>
          )}
        </div>
      )}
      
      <style>{`
        .real-time-status {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
        }
        
        .status-main {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: ${isConnected ? 'pulse 2s infinite' : 'none'};
        }
        
        .status-text {
          font-weight: 500;
          color: ${getStatusColor()};
        }
        
        .status-details {
          display: flex;
          gap: 12px;
          color: #718096;
          margin-left: 14px;
        }
        
        .event-count {
          font-weight: 500;
        }
        
        .last-update {
          opacity: 0.8;
        }
        
        .error-details {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 14px;
        }
        
        .error-message {
          color: #e53e3e;
          font-size: 11px;
        }
        
        .reconnect-button {
          background: #e53e3e;
          color: white;
          border: none;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        
        .reconnect-button:hover {
          background: #c53030;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RealTimeStatus;