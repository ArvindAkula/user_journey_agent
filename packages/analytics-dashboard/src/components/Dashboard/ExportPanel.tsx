import React, { useState } from 'react';
import { AnalyticsFilter } from '@aws-agent/shared';

interface ExportData {
  format: 'csv' | 'json' | 'pdf';
  data: {
    types: string[];
    filters: AnalyticsFilter;
    timestamp: string;
  };
  filename: string;
}

interface ExportPanelProps {
  filters: AnalyticsFilter;
  onClose: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ filters, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [selectedData, setSelectedData] = useState<string[]>(['userJourney']);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const dataOptions = [
    { key: 'userJourney', label: 'User Journey Metrics', description: 'Conversion rates, session data, drop-off points' },
    { key: 'videoEngagement', label: 'Video Engagement', description: 'Watch time, completion rates, top videos' },
    { key: 'struggleSignals', label: 'Struggle Signals', description: 'User friction points and intervention data' },
    { key: 'userSegments', label: 'User Segments', description: 'Segment distribution and performance' },
    { key: 'timeSeries', label: 'Time Series Data', description: 'Historical trends and patterns' },
    { key: 'realTimeMetrics', label: 'Real-time Metrics', description: 'Live analytics and current performance' }
  ];

  const formatOptions = [
    { key: 'csv' as const, label: 'CSV', description: 'Comma-separated values for spreadsheet analysis', icon: '📊' },
    { key: 'json' as const, label: 'JSON', description: 'Structured data for API integration', icon: '🔗' },
    { key: 'pdf' as const, label: 'PDF', description: 'Formatted report for presentations', icon: '📄' }
  ];

  const handleDataToggle = (dataKey: string, checked: boolean) => {
    setSelectedData(prev => 
      checked 
        ? [...prev, dataKey]
        : prev.filter(key => key !== dataKey)
    );
  };

  const handleSelectAll = () => {
    setSelectedData(dataOptions.map(option => option.key));
  };

  const handleDeselectAll = () => {
    setSelectedData([]);
  };

  const handleExport = async () => {
    if (selectedData.length === 0) {
      alert('Please select at least one data type to export.');
      return;
    }

    const maxRecords = parseInt(process.env.REACT_APP_EXPORT_MAX_RECORDS || '10000');
    
    setIsExporting(true);
    setExportStatus('idle');

    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const exportConfig: ExportData = {
        format: selectedFormat,
        data: {
          types: selectedData,
          filters: filters,
          timestamp: new Date().toISOString()
        },
        filename: `analytics-export-${new Date().toISOString().split('T')[0]}.${selectedFormat}`
      };

      // Generate mock export data
      const mockData = generateMockExportData(exportConfig);
      const blob = new Blob([mockData], { 
        type: selectedFormat === 'csv' ? 'text/csv' : 
             selectedFormat === 'json' ? 'application/json' : 
             'application/pdf' 
      });

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportConfig.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('success');
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  const generateMockExportData = (config: ExportData): string => {
    if (config.format === 'csv') {
      let csvContent = 'Date,Metric,Value,Segment,Platform,Feature\n';
      
      // Generate sample data based on selected types
      const sampleData = [
        '2024-01-01,Active Users,890,All,Web,Dashboard',
        '2024-01-01,Conversion Rate,68.5,All,Web,Calculator',
        '2024-01-01,Video Completion,72.8,All,Mobile,Video Library',
        '2024-01-02,Active Users,912,New Users,Web,Document Upload',
        '2024-01-02,Conversion Rate,69.2,Active Users,Mobile,Profile',
        '2024-01-02,Video Completion,74.1,Power Users,Web,Demo'
      ];
      
      csvContent += sampleData.join('\n');
      return csvContent;
    } else if (config.format === 'json') {
      return JSON.stringify({
        exportMetadata: {
          exportDate: new Date().toISOString(),
          filters: config.data.filters,
          dataTypes: config.data.types,
          recordCount: 1250
        },
        data: {
          userJourney: selectedData.includes('userJourney') ? {
            totalUsers: 1250,
            activeUsers: 890,
            conversionRate: 68.5,
            averageSessionDuration: 4.2,
            dropOffRate: 31.5
          } : undefined,
          videoEngagement: selectedData.includes('videoEngagement') ? {
            totalViews: 5420,
            averageWatchTime: 4.2,
            completionRate: 72.8,
            topVideos: [
              { title: 'Getting Started', views: 1200, completion: 85 },
              { title: 'Advanced Features', views: 890, completion: 72 }
            ]
          } : undefined,
          struggleSignals: selectedData.includes('struggleSignals') ? {
            totalSignals: 89,
            criticalSignals: 12,
            resolvedSignals: 67,
            topIssues: ['Calculator timeout', 'Upload failure', 'Login issues']
          } : undefined
        }
      }, null, 2);
    } else {
      return `Analytics Export Report
Generated: ${new Date().toLocaleDateString()}
Export Format: PDF Report

Data Types Included: ${config.data.types.join(', ')}

Filters Applied:
- Date Range: ${config.data.filters.dateRange.start.toLocaleDateString()} to ${config.data.filters.dateRange.end.toLocaleDateString()}
- User Segments: ${config.data.filters.userSegments.join(', ') || 'All'}
- Platforms: ${config.data.filters.platforms.join(', ') || 'All'}
- Features: ${config.data.filters.features.join(', ') || 'All'}

Summary:
This export contains comprehensive analytics data for the specified time period and filters.
Data includes user journey metrics, engagement statistics, and performance indicators.

Generated by Analytics Dashboard v1.0.0`;
    }
  };

  const getEstimatedFileSize = () => {
    const baseSize = selectedData.length * 75; // KB per data type
    const formatMultiplier = selectedFormat === 'pdf' ? 3 : selectedFormat === 'json' ? 1.5 : 1;
    return Math.round(baseSize * formatMultiplier);
  };

  return (
    <div className="export-panel-overlay">
      <div className="export-panel">
        <div className="panel-header">
          <h2 className="panel-title">Export Analytics Data</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="panel-content">
          {/* Format Selection */}
          <div className="section">
            <h3 className="section-title">Export Format</h3>
            <div className="format-options">
              {formatOptions.map(format => (
                <label key={format.key} className="format-option">
                  <input
                    type="radio"
                    name="format"
                    value={format.key}
                    checked={selectedFormat === format.key}
                    onChange={(e) => setSelectedFormat(e.target.value as any)}
                    className="format-radio"
                  />
                  <div className="format-content">
                    <div className="format-header">
                      <span className="format-icon">{format.icon}</span>
                      <span className="format-label">{format.label}</span>
                    </div>
                    <p className="format-description">{format.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Data Selection */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">
                Data to Export
                {selectedData.length > 0 && (
                  <span className="selection-count">({selectedData.length} selected)</span>
                )}
              </h3>
              <div className="selection-controls">
                <button className="control-btn" onClick={handleSelectAll}>Select All</button>
                <button className="control-btn" onClick={handleDeselectAll}>Clear All</button>
              </div>
            </div>
            <div className="data-options">
              {dataOptions.map(option => (
                <label key={option.key} className="data-option">
                  <input
                    type="checkbox"
                    checked={selectedData.includes(option.key)}
                    onChange={(e) => handleDataToggle(option.key, e.target.checked)}
                    className="data-checkbox"
                  />
                  <div className="data-content">
                    <div className="data-label">{option.label}</div>
                    <p className="data-description">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Export Summary */}
          <div className="section">
            <h3 className="section-title">Export Summary</h3>
            <div className="export-summary">
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Format:</span>
                  <span className="summary-value">{selectedFormat.toUpperCase()}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Data Types:</span>
                  <span className="summary-value">{selectedData.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Estimated Size:</span>
                  <span className="summary-value">{getEstimatedFileSize()} KB</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Date Range:</span>
                  <span className="summary-value">
                    {filters.dateRange.start.toLocaleDateString()} - {filters.dateRange.end.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-footer">
          {exportStatus === 'success' && (
            <div className="status-message success">
              ✅ Export completed successfully!
            </div>
          )}
          {exportStatus === 'error' && (
            <div className="status-message error">
              ❌ Export failed. Please try again.
            </div>
          )}
          
          <div className="footer-actions">
            <button className="cancel-button" onClick={onClose} disabled={isExporting}>
              Cancel
            </button>
            <button 
              className="export-button" 
              onClick={handleExport}
              disabled={isExporting || selectedData.length === 0}
            >
              {isExporting ? (
                <>
                  <div className="spinner-small"></div>
                  Exporting...
                </>
              ) : (
                <>
                  📤 Export Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .export-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .export-panel {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .panel-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .close-button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: all 0.2s;
          font-size: 18px;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .section {
          margin-bottom: 32px;
        }

        .section:last-child {
          margin-bottom: 0;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #2d3748;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .selection-count {
          font-size: 12px;
          color: #667eea;
          font-weight: 500;
        }

        .selection-controls {
          display: flex;
          gap: 8px;
        }

        .control-btn {
          padding: 4px 8px;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .control-btn:hover {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .format-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .format-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .format-option:hover {
          border-color: #cbd5e0;
        }

        .format-option:has(.format-radio:checked) {
          border-color: #667eea;
          background: #f7fafc;
        }

        .format-radio {
          margin-top: 2px;
          accent-color: #667eea;
        }

        .format-content {
          flex: 1;
        }

        .format-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .format-icon {
          font-size: 18px;
        }

        .format-label {
          font-weight: 600;
          color: #2d3748;
        }

        .format-description {
          margin: 0;
          font-size: 14px;
          color: #718096;
        }

        .data-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .data-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .data-option:hover {
          background: #f7fafc;
        }

        .data-checkbox {
          margin-top: 2px;
          accent-color: #667eea;
        }

        .data-content {
          flex: 1;
        }

        .data-label {
          font-weight: 500;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .data-description {
          margin: 0;
          font-size: 14px;
          color: #718096;
        }

        .export-summary {
          background: #f7fafc;
          border-radius: 8px;
          padding: 16px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .summary-label {
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          font-weight: 500;
        }

        .summary-value {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
        }

        .panel-footer {
          padding: 24px;
          border-top: 1px solid #e2e8f0;
          background: #f7fafc;
          border-radius: 0 0 16px 16px;
        }

        .status-message {
          margin-bottom: 16px;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-message.success {
          background: #c6f6d5;
          color: #2f855a;
        }

        .status-message.error {
          background: #fed7d7;
          color: #c53030;
        }

        .footer-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .cancel-button,
        .export-button {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cancel-button {
          background: white;
          color: #718096;
          border: 1px solid #e2e8f0;
        }

        .cancel-button:hover:not(:disabled) {
          background: #f7fafc;
          border-color: #cbd5e0;
        }

        .export-button {
          background: #667eea;
          color: white;
          border: 1px solid #667eea;
        }

        .export-button:hover:not(:disabled) {
          background: #5a67d8;
          border-color: #5a67d8;
        }

        .export-button:disabled {
          background: #cbd5e0;
          border-color: #cbd5e0;
          cursor: not-allowed;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .export-panel {
            width: 95%;
            max-height: 90vh;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .footer-actions {
            flex-direction: column;
          }

          .cancel-button,
          .export-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default ExportPanel;