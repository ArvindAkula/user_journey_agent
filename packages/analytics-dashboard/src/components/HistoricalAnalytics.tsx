import React, { useState, useEffect } from 'react';
import bigQueryService from '../services/BigQueryService';

/**
 * Historical Analytics Component
 * 
 * Displays historical analytics data from BigQuery with date range selection.
 * Shows event aggregations, calculator statistics, and video engagement metrics.
 */
const HistoricalAnalytics: React.FC = () => {
  const [bigQueryAvailable, setBigQueryAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<'last7days' | 'last30days' | 'last90days'>('last30days');
  const [eventAggregations, setEventAggregations] = useState<any>(null);
  const [calculatorStats, setCalculatorStats] = useState<any>(null);
  const [videoMetrics, setVideoMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkBigQueryStatus();
  }, []);

  useEffect(() => {
    if (bigQueryAvailable) {
      loadHistoricalData();
    }
  }, [bigQueryAvailable, dateRange]);

  const checkBigQueryStatus = async () => {
    try {
      const status = await bigQueryService.checkStatus();
      setBigQueryAvailable(status.available);
      
      if (!status.available) {
        setError(status.message);
      }
    } catch (err) {
      console.error('Error checking BigQuery status:', err);
      setError('Failed to check BigQuery availability');
    }
  };

  const loadHistoricalData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = bigQueryService.getDateRange(dateRange);

      // Load all data in parallel
      const [aggregations, calcStats, vidMetrics] = await Promise.all([
        bigQueryService.getEventAggregations(startDate, endDate),
        bigQueryService.getCalculatorStatistics(startDate, endDate),
        bigQueryService.getVideoEngagementMetrics(startDate, endDate)
      ]);

      setEventAggregations(aggregations);
      setCalculatorStats(calcStats);
      setVideoMetrics(vidMetrics);
    } catch (err: any) {
      console.error('Error loading historical data:', err);
      setError(err.response?.data?.error || 'Failed to load historical data');
    } finally {
      setLoading(false);
    }
  };

  if (!bigQueryAvailable) {
    return (
      <div className="historical-analytics">
        <div className="alert alert-warning">
          <h3>BigQuery Not Available</h3>
          <p>{error || 'BigQuery is not configured. Historical analytics are not available.'}</p>
          <p>Using DynamoDB for all analytics queries.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="historical-analytics">
      <div className="header">
        <h2>Historical Analytics (BigQuery)</h2>
        <div className="date-range-selector">
          <label>Time Period:</label>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value as any)}
            disabled={loading}
          >
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last90days">Last 90 Days</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="loading">
          <p>Loading historical data from BigQuery...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Event Aggregations */}
          {eventAggregations && (
            <div className="section event-aggregations">
              <h3>Event Aggregations</h3>
              <div className="aggregations-grid">
                {eventAggregations.aggregations?.map((agg: any, index: number) => (
                  <div key={index} className="aggregation-card">
                    <div className="date">{agg.date}</div>
                    <div className="stats">
                      <div className="stat">
                        <span className="label">Total Events:</span>
                        <span className="value">{agg.totalEvents.toLocaleString()}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Unique Users:</span>
                        <span className="value">{agg.uniqueUsers.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="event-breakdown">
                      {Object.entries(agg.eventCounts || {}).map(([eventName, count]: [string, any]) => (
                        <div key={eventName} className="event-item">
                          <span className="event-name">{eventName}</span>
                          <span className="event-count">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculator Statistics */}
          {calculatorStats && (
            <div className="section calculator-stats">
              <h3>Calculator Statistics</h3>
              <div className="total-calculations">
                <strong>Total Calculations:</strong> {calculatorStats.statistics?.totalCalculations?.toLocaleString() || 0}
              </div>
              <div className="calculations-table">
                <table>
                  <thead>
                    <tr>
                      <th>Loan Amount</th>
                      <th>Interest Rate</th>
                      <th>Term (Years)</th>
                      <th>Count</th>
                      <th>Unique Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculatorStats.statistics?.calculations?.slice(0, 10).map((calc: any, index: number) => (
                      <tr key={index}>
                        <td>${calc.loanAmount?.toLocaleString() || 'N/A'}</td>
                        <td>{calc.interestRate?.toFixed(2)}%</td>
                        <td>{calc.termYears}</td>
                        <td>{calc.count.toLocaleString()}</td>
                        <td>{calc.uniqueUsers.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Video Engagement Metrics */}
          {videoMetrics && (
            <div className="section video-metrics">
              <h3>Video Engagement Metrics</h3>
              <div className="total-engagements">
                <strong>Total Engagements:</strong> {videoMetrics.metrics?.totalEngagements?.toLocaleString() || 0}
              </div>
              <div className="videos-table">
                <table>
                  <thead>
                    <tr>
                      <th>Video ID</th>
                      <th>Action</th>
                      <th>Count</th>
                      <th>Unique Users</th>
                      <th>Avg Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videoMetrics.metrics?.videos?.slice(0, 10).map((video: any, index: number) => (
                      <tr key={index}>
                        <td>{video.videoId || 'N/A'}</td>
                        <td>{video.action}</td>
                        <td>{video.actionCount.toLocaleString()}</td>
                        <td>{video.uniqueUsers.toLocaleString()}</td>
                        <td>{video.avgCompletionRate ? `${(video.avgCompletionRate * 100).toFixed(1)}%` : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .historical-analytics {
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .date-range-selector {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .date-range-selector select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .alert {
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .alert-warning {
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          color: #856404;
        }

        .alert-error {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }

        .section {
          margin-bottom: 40px;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .section h3 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #333;
        }

        .aggregations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .aggregation-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
        }

        .aggregation-card .date {
          font-weight: bold;
          margin-bottom: 10px;
          color: #2196F3;
        }

        .stats {
          margin-bottom: 15px;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .stat .label {
          color: #666;
        }

        .stat .value {
          font-weight: bold;
        }

        .event-breakdown {
          border-top: 1px solid #e0e0e0;
          padding-top: 10px;
        }

        .event-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 14px;
        }

        .event-name {
          color: #666;
        }

        .event-count {
          font-weight: 500;
        }

        .total-calculations,
        .total-engagements {
          margin-bottom: 20px;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
        }

        th {
          background-color: #f5f5f5;
          font-weight: 600;
          color: #333;
        }

        tr:hover {
          background-color: #f9f9f9;
        }
      `}</style>
    </div>
  );
};

export default HistoricalAnalytics;
