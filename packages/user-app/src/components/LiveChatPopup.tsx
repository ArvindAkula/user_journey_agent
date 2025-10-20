import React, { useState, useEffect } from 'react';

interface LiveChatPopupProps {
  userId: string;
  riskScore?: number;
  context?: any;
  onClose?: () => void;
  onAccept?: () => void;
}

const LiveChatPopup: React.FC<LiveChatPopupProps> = ({
  userId,
  riskScore,
  context,
  onClose,
  onAccept
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Auto-show popup when component mounts
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
    // In a real implementation, this would open the actual chat interface
    console.log('Opening live chat for user:', userId);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div className="live-chat-popup-overlay" onClick={handleClose} />
      <div className={`live-chat-popup ${isMinimized ? 'minimized' : ''}`}>
        <div className="popup-header">
          <div className="header-content">
            <div className="support-icon">💬</div>
            <div className="header-text">
              <h3>Need Help?</h3>
              {!isMinimized && <p>We're here to assist you</p>}
            </div>
          </div>
          <div className="header-actions">
            <button className="minimize-btn" onClick={handleMinimize} title="Minimize">
              {isMinimized ? '▲' : '▼'}
            </button>
            <button className="close-btn" onClick={handleClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="popup-body">
            <div className="message-content">
              <p className="main-message">
                👋 Hi there! We noticed you might be having some difficulty. 
                Would you like to chat with one of our support specialists?
              </p>
              
              {riskScore && riskScore > 70 && (
                <div className="urgency-indicator">
                  <span className="urgency-icon">⚠️</span>
                  <span className="urgency-text">Priority Support Available</span>
                </div>
              )}

              <div className="benefits-list">
                <div className="benefit-item">
                  <span className="check-icon">✓</span>
                  <span>Instant answers to your questions</span>
                </div>
                <div className="benefit-item">
                  <span className="check-icon">✓</span>
                  <span>Personalized guidance</span>
                </div>
                <div className="benefit-item">
                  <span className="check-icon">✓</span>
                  <span>No wait time - connect now</span>
                </div>
              </div>
            </div>

            <div className="popup-actions">
              <button className="accept-btn" onClick={handleAccept}>
                <span className="btn-icon">💬</span>
                Start Live Chat
              </button>
              <button className="decline-btn" onClick={handleClose}>
                Maybe Later
              </button>
            </div>

            <div className="alternative-options">
              <p className="options-label">Or choose another option:</p>
              <div className="option-buttons">
                <button className="option-btn">
                  📚 View Help Articles
                </button>
                <button className="option-btn">
                  📞 Request Callback
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .live-chat-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
          z-index: 9998;
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .live-chat-popup {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 420px;
          max-width: calc(100vw - 48px);
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.1);
          z-index: 9999;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          transition: all 0.3s ease;
          overflow: hidden;
        }

        .live-chat-popup.minimized {
          width: 300px;
        }

        .popup-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
        }

        .support-icon {
          font-size: 36px;
          line-height: 1;
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        .header-text {
          flex: 1;
        }

        .header-text h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }

        .header-text p {
          margin: 4px 0 0 0;
          font-size: 14px;
          opacity: 0.95;
          font-weight: 400;
        }

        .header-actions {
          display: flex;
          gap: 6px;
          margin-left: 12px;
        }

        .minimize-btn,
        .close-btn {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .minimize-btn:hover,
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.05);
        }

        .popup-body {
          padding: 28px 24px 24px;
        }

        .message-content {
          margin-bottom: 24px;
        }

        .main-message {
          font-size: 15px;
          line-height: 1.7;
          color: #2d3748;
          margin: 0 0 20px 0;
          text-align: center;
        }

        .urgency-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
          border-left: 4px solid #fc8181;
          border-radius: 10px;
          margin-bottom: 20px;
        }

        .urgency-icon {
          font-size: 20px;
          line-height: 1;
        }

        .urgency-text {
          font-size: 14px;
          font-weight: 700;
          color: #c53030;
          letter-spacing: -0.2px;
        }

        .benefits-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 20px;
        }

        .benefit-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: #4a5568;
          padding-left: 4px;
        }

        .check-icon {
          color: #48bb78;
          font-weight: bold;
          font-size: 18px;
          line-height: 1;
          flex-shrink: 0;
        }

        .popup-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .accept-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 16px 24px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s;
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          letter-spacing: -0.2px;
        }

        .accept-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.5);
        }

        .accept-btn:active {
          transform: translateY(0);
        }

        .btn-icon {
          font-size: 20px;
          line-height: 1;
        }

        .decline-btn {
          background: #f7fafc;
          color: #718096;
          border: 1px solid #e2e8f0;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .decline-btn:hover {
          background: #edf2f7;
          border-color: #cbd5e0;
          color: #4a5568;
        }

        .alternative-options {
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }

        .options-label {
          font-size: 13px;
          color: #a0aec0;
          margin: 0 0 12px 0;
          text-align: center;
          font-weight: 500;
        }

        .option-buttons {
          display: flex;
          gap: 10px;
        }

        .option-btn {
          flex: 1;
          background: white;
          border: 1.5px solid #e2e8f0;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 13px;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .option-btn:hover {
          background: #f7fafc;
          border-color: #cbd5e0;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        @media (max-width: 480px) {
          .live-chat-popup {
            width: calc(100% - 32px);
            right: 16px;
            bottom: 16px;
          }

          .live-chat-popup.minimized {
            width: 280px;
            left: auto;
          }

          .popup-header {
            padding: 18px 20px;
          }

          .popup-body {
            padding: 24px 20px 20px;
          }

          .option-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
};

export default LiveChatPopup;
