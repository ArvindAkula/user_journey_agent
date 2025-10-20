import React, { useState } from 'react';
import ExportPanel from '../components/Dashboard/ExportPanel';
import FilterPanel from '../components/Dashboard/FilterPanel';
import AmazonQChat from '../components/Dashboard/AmazonQChat';
import RealTimeMonitor from '../components/Dashboard/RealTimeMonitor';

const ExportsPage: React.FC = () => {
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAmazonQ, setShowAmazonQ] = useState(false);
  const [showRealTimeMonitor, setShowRealTimeMonitor] = useState(false);

  const defaultFilters = {
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    userSegments: [],
    platforms: [],
    features: []
  };

  return (
    <div className="exports-page">
      <div className="page-header">
        <h2>Advanced Analytics Tools</h2>
        <p>Export data, configure filters, and access AI-powered insights</p>
      </div>
      
      <div className="dashboard-grid">
        <div className="grid-item grid-item-6">
          <div className="widget">
            <div className="widget-header">
              <h3 className="widget-title">Data Export</h3>
            </div>
            <div className="widget-content">
              <p>Export your analytics data in multiple formats for further analysis and reporting.</p>
              <div style={{ marginTop: '16px' }}>
                <button 
                  className="action-button primary"
                  onClick={() => setShowExportPanel(true)}
                >
                  📤 Export Data
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-item grid-item-6">
          <div className="widget">
            <div className="widget-header">
              <h3 className="widget-title">Advanced Filters</h3>
            </div>
            <div className="widget-content">
              <p>Configure advanced filtering options to focus on specific data segments and time periods.</p>
              <div style={{ marginTop: '16px' }}>
                <button 
                  className="action-button secondary"
                  onClick={() => setShowFilterPanel(true)}
                >
                  🔍 Configure Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-item grid-item-6">
          <div className="widget">
            <div className="widget-header">
              <h3 className="widget-title">Amazon Q Assistant</h3>
            </div>
            <div className="widget-content">
              <p>Get AI-powered insights and answers about your analytics data using natural language queries.</p>
              <div style={{ marginTop: '16px' }}>
                <button 
                  className="action-button ai"
                  onClick={() => setShowAmazonQ(true)}
                >
                  🤖 Ask Amazon Q
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-item grid-item-6">
          <div className="widget">
            <div className="widget-header">
              <h3 className="widget-title">Real-Time Monitor</h3>
            </div>
            <div className="widget-content">
              <p>Monitor live analytics data with real-time updates and streaming event feeds.</p>
              <div style={{ marginTop: '16px' }}>
                <button 
                  className="action-button realtime"
                  onClick={() => setShowRealTimeMonitor(true)}
                >
                  📊 Live Monitor
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-item grid-item-12">
          <div className="widget">
            <div className="widget-header">
              <h3 className="widget-title">Export History</h3>
            </div>
            <div className="widget-content">
              <div className="export-history">
                <div className="history-item">
                  <div className="history-info">
                    <div className="history-name">User Journey Analytics - January 2024</div>
                    <div className="history-details">CSV • 2.3 MB • Exported 2 hours ago</div>
                  </div>
                  <button className="download-btn">⬇️ Download</button>
                </div>
                <div className="history-item">
                  <div className="history-info">
                    <div className="history-name">Video Engagement Report - Q4 2023</div>
                    <div className="history-details">PDF • 1.8 MB • Exported yesterday</div>
                  </div>
                  <button className="download-btn">⬇️ Download</button>
                </div>
                <div className="history-item">
                  <div className="history-info">
                    <div className="history-name">Struggle Signals Analysis - December 2023</div>
                    <div className="history-details">JSON • 890 KB • Exported 3 days ago</div>
                  </div>
                  <button className="download-btn">⬇️ Download</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showExportPanel && (
        <ExportPanel
          filters={defaultFilters}
          onClose={() => setShowExportPanel(false)}
        />
      )}

      {showFilterPanel && (
        <FilterPanel
          filters={defaultFilters}
          onFiltersChange={(filters) => {
            console.log('Filters updated:', filters);
            setShowFilterPanel(false);
          }}
          onClose={() => setShowFilterPanel(false)}
        />
      )}

      {showAmazonQ && (
        <AmazonQChat
          filters={defaultFilters}
          onClose={() => setShowAmazonQ(false)}
        />
      )}

      {showRealTimeMonitor && (
        <RealTimeMonitor
          onClose={() => setShowRealTimeMonitor(false)}
        />
      )}

      <style>{`
        .action-button {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .action-button.primary {
          background: #667eea;
          color: white;
        }

        .action-button.primary:hover {
          background: #5a67d8;
          transform: translateY(-1px);
        }

        .action-button.secondary {
          background: #48bb78;
          color: white;
        }

        .action-button.secondary:hover {
          background: #38a169;
          transform: translateY(-1px);
        }

        .action-button.ai {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .action-button.ai:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .action-button.realtime {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }

        .action-button.realtime:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);
        }

        .export-history {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .history-info {
          flex: 1;
        }

        .history-name {
          font-weight: 500;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .history-details {
          font-size: 14px;
          color: #718096;
        }

        .download-btn {
          padding: 8px 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .download-btn:hover {
          background: #5a67d8;
        }

        @media (max-width: 768px) {
          .history-item {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .download-btn {
            align-self: stretch;
          }
        }
      `}</style>
    </div>
  );
};

export default ExportsPage;