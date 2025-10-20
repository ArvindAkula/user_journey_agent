import React, { useState } from 'react';
import { AnalyticsFilter } from '@aws-agent/shared';
import { format } from 'date-fns';

interface FilterPanelProps {
  filters: AnalyticsFilter;
  onFiltersChange: (filters: AnalyticsFilter) => void;
  onClose: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFiltersChange, onClose }) => {
  const [localFilters, setLocalFilters] = useState<AnalyticsFilter>(filters);

  const userSegmentOptions = [
    'New Users',
    'Active Users',
    'At Risk',
    'Churned',
    'Power Users',
    'Casual Users'
  ];

  const platformOptions = [
    'iOS',
    'Android',
    'Web',
    'Desktop',
    'Mobile Web'
  ];

  const featureOptions = [
    'Document Upload',
    'Interactive Calculator',
    'Video Library',
    'User Profile',
    'Dashboard',
    'Authentication',
    'Demo Scenarios'
  ];

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: new Date(value)
      }
    }));
  };

  const handleMultiSelectChange = (field: keyof Pick<AnalyticsFilter, 'userSegments' | 'platforms' | 'features'>, value: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }));
  };

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleResetFilters = () => {
    const resetFilters: AnalyticsFilter = {
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      userSegments: [],
      platforms: [],
      features: []
    };
    setLocalFilters(resetFilters);
  };

  const getActiveFiltersCount = () => {
    return localFilters.userSegments.length + localFilters.platforms.length + localFilters.features.length;
  };

  const handleQuickDateRange = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setLocalFilters(prev => ({
      ...prev,
      dateRange: { start, end }
    }));
  };

  return (
    <div className="filter-panel-overlay">
      <div className="filter-panel">
        <div className="panel-header">
          <h2 className="panel-title">Advanced Analytics Filters</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="panel-content">
          {/* Quick Date Range */}
          <div className="filter-section">
            <h3 className="section-title">Quick Date Ranges</h3>
            <div className="quick-date-buttons">
              <button onClick={() => handleQuickDateRange(7)} className="quick-date-btn">Last 7 days</button>
              <button onClick={() => handleQuickDateRange(30)} className="quick-date-btn">Last 30 days</button>
              <button onClick={() => handleQuickDateRange(90)} className="quick-date-btn">Last 90 days</button>
              <button onClick={() => handleQuickDateRange(365)} className="quick-date-btn">Last year</button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="filter-section">
            <h3 className="section-title">Custom Date Range</h3>
            <div className="date-inputs">
              <div className="date-input-group">
                <label htmlFor="start-date">Start Date</label>
                <input
                  id="start-date"
                  type="date"
                  value={format(localFilters.dateRange.start, 'yyyy-MM-dd')}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="date-input-group">
                <label htmlFor="end-date">End Date</label>
                <input
                  id="end-date"
                  type="date"
                  value={format(localFilters.dateRange.end, 'yyyy-MM-dd')}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="date-input"
                />
              </div>
            </div>
          </div>

          {/* User Segments */}
          <div className="filter-section">
            <h3 className="section-title">
              User Segments
              {localFilters.userSegments.length > 0 && (
                <span className="selection-count">({localFilters.userSegments.length} selected)</span>
              )}
            </h3>
            <div className="checkbox-group">
              {userSegmentOptions.map(segment => (
                <label key={segment} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localFilters.userSegments.includes(segment)}
                    onChange={(e) => handleMultiSelectChange('userSegments', segment, e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">{segment}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div className="filter-section">
            <h3 className="section-title">
              Platforms
              {localFilters.platforms.length > 0 && (
                <span className="selection-count">({localFilters.platforms.length} selected)</span>
              )}
            </h3>
            <div className="checkbox-group">
              {platformOptions.map(platform => (
                <label key={platform} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localFilters.platforms.includes(platform)}
                    onChange={(e) => handleMultiSelectChange('platforms', platform, e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="filter-section">
            <h3 className="section-title">
              Features
              {localFilters.features.length > 0 && (
                <span className="selection-count">({localFilters.features.length} selected)</span>
              )}
            </h3>
            <div className="checkbox-group">
              {featureOptions.map(feature => (
                <label key={feature} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localFilters.features.includes(feature)}
                    onChange={(e) => handleMultiSelectChange('features', feature, e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">{feature}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="panel-footer">
          <div className="footer-info">
            {getActiveFiltersCount() > 0 && (
              <span className="active-filters">
                {getActiveFiltersCount()} filter{getActiveFiltersCount() !== 1 ? 's' : ''} active
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button className="reset-button" onClick={handleResetFilters}>
              Reset All
            </button>
            <button className="apply-button" onClick={handleApplyFilters}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .filter-panel-overlay {
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

        .filter-panel {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
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

        .filter-section {
          margin-bottom: 32px;
        }

        .filter-section:last-child {
          margin-bottom: 0;
        }

        .section-title {
          margin: 0 0 16px 0;
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

        .quick-date-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .quick-date-btn {
          padding: 8px 12px;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .quick-date-btn:hover {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .date-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .date-input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .date-input-group label {
          font-size: 14px;
          font-weight: 500;
          color: #4a5568;
        }

        .date-input {
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .date-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          transition: background-color 0.2s;
        }

        .checkbox-label:hover {
          background: #f7fafc;
        }

        .checkbox-input {
          width: 16px;
          height: 16px;
          accent-color: #667eea;
        }

        .checkbox-text {
          font-size: 14px;
          color: #2d3748;
        }

        .panel-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-top: 1px solid #e2e8f0;
          background: #f7fafc;
          border-radius: 0 0 16px 16px;
        }

        .footer-info {
          flex: 1;
        }

        .active-filters {
          font-size: 14px;
          color: #667eea;
          font-weight: 500;
        }

        .footer-actions {
          display: flex;
          gap: 12px;
        }

        .reset-button,
        .apply-button {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-button {
          background: white;
          color: #718096;
          border: 1px solid #e2e8f0;
        }

        .reset-button:hover {
          background: #f7fafc;
          border-color: #cbd5e0;
        }

        .apply-button {
          background: #667eea;
          color: white;
          border: 1px solid #667eea;
        }

        .apply-button:hover {
          background: #5a67d8;
          border-color: #5a67d8;
        }

        @media (max-width: 768px) {
          .filter-panel {
            width: 95%;
            max-height: 90vh;
          }

          .quick-date-buttons {
            grid-template-columns: 1fr;
          }

          .date-inputs {
            grid-template-columns: 1fr;
          }

          .panel-footer {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .footer-actions {
            width: 100%;
          }

          .reset-button,
          .apply-button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default FilterPanel;