import React, { useState, useEffect } from 'react';
import { useEventTracking, EventService } from '@aws-agent/shared';
import { config } from '../config';
import './InteractiveCalculator.css';

interface InteractiveCalculatorProps {
  onCalculationComplete: () => void;
  onStruggleDetected: () => void;
}

interface LoanCalculation {
  id: string;
  loanAmount: number;
  interestRate: number;
  loanTerm: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  downPayment?: number;
  propertyTax?: number;
  insurance?: number;
  pmi?: number;
  createdAt: Date;
  name?: string;
}

interface PaymentScheduleItem {
  paymentNumber: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
  totalPayment: number;
}

const InteractiveCalculator: React.FC<InteractiveCalculatorProps> = ({
  onCalculationComplete,
  onStruggleDetected
}) => {
  // Create event service instance with enhanced configuration
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
    trackStruggleSignal, 
    trackUserAction, 
    trackError,
    trackFormInteraction,
    trackButtonClick,
    trackPerformanceMetric,
    getInteractionStats
  } = useEventTracking({
    eventService,
    userId: 'demo-user',
    sessionId: `demo-session-${Date.now()}`,
    enableAutoContext: true,
    enableStruggleDetection: true
  });

  const [loanAmount, setLoanAmount] = useState<string>('');
  const [interestRate, setInterestRate] = useState<string>('');
  const [loanTerm, setLoanTerm] = useState<string>('');
  const [result, setResult] = useState<LoanCalculation | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attemptCount, setAttemptCount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [calculationHistory, setCalculationHistory] = useState<LoanCalculation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [calculationName, setCalculationName] = useState<string>('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // Advanced fields
  const [downPayment, setDownPayment] = useState<string>('');
  const [propertyTax, setPropertyTax] = useState<string>('');
  const [insurance, setInsurance] = useState<string>('');
  const [pmi, setPmi] = useState<string>('');

  // Load calculation history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('loanCalculationHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory).map((calc: any) => ({
          ...calc,
          createdAt: new Date(calc.createdAt)
        }));
        setCalculationHistory(history);
      } catch (error) {
        console.error('Error loading calculation history:', error);
      }
    }
  }, []);

  // Save calculation history to localStorage whenever it changes
  useEffect(() => {
    if (calculationHistory.length > 0) {
      localStorage.setItem('loanCalculationHistory', JSON.stringify(calculationHistory));
    }
  }, [calculationHistory]);

  useEffect(() => {
    // Track when user accesses the calculator
    trackFeatureInteraction('loan_calculator', true, {
      attemptCount: 1
    });

    // Track calculator page view
    trackUserAction('calculator_page_view', {
      calculatorType: 'loan_calculator',
      timestamp: new Date().toISOString()
    });

    // Set up error boundary for the component
    const handleError = (error: ErrorEvent) => {
      trackError(error.error || error.message, {
        component: 'InteractiveCalculator',
        url: window.location.href
      });
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [trackFeatureInteraction, trackUserAction, trackError]);

  const generatePaymentSchedule = (
    principal: number,
    monthlyRate: number,
    numberOfPayments: number,
    monthlyPayment: number
  ): PaymentScheduleItem[] => {
    const schedule: PaymentScheduleItem[] = [];
    let remainingBalance = principal;

    for (let i = 1; i <= numberOfPayments; i++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance = Math.max(0, remainingBalance - principalPayment);

      schedule.push({
        paymentNumber: i,
        principalPayment,
        interestPayment,
        remainingBalance,
        totalPayment: monthlyPayment
      });

      if (remainingBalance === 0) break;
    }

    return schedule;
  };

  const saveCalculation = (calculation: LoanCalculation) => {
    const newHistory = [calculation, ...calculationHistory.slice(0, 9)]; // Keep last 10
    setCalculationHistory(newHistory);
    
    trackUserAction('calculation_saved', {
      calculationId: calculation.id,
      calculationName: calculation.name,
      historyCount: newHistory.length
    });
  };

  const loadCalculation = (calculation: LoanCalculation) => {
    setLoanAmount(calculation.loanAmount.toString());
    setInterestRate(calculation.interestRate.toString());
    setLoanTerm(calculation.loanTerm.toString());
    setDownPayment(calculation.downPayment?.toString() || '');
    setPropertyTax(calculation.propertyTax?.toString() || '');
    setInsurance(calculation.insurance?.toString() || '');
    setPmi(calculation.pmi?.toString() || '');
    setResult(calculation);
    setShowHistory(false);
    
    // Recalculate payment schedule
    const monthlyRate = calculation.interestRate / 100 / 12;
    const numberOfPayments = calculation.loanTerm * 12;
    const schedule = generatePaymentSchedule(
      calculation.loanAmount,
      monthlyRate,
      numberOfPayments,
      calculation.monthlyPayment
    );
    setPaymentSchedule(schedule);
    
    trackUserAction('calculation_loaded', {
      calculationId: calculation.id,
      calculationName: calculation.name
    });
  };

  const exportSchedule = () => {
    if (!paymentSchedule.length || !result) return;
    
    const csvContent = [
      ['Payment #', 'Principal', 'Interest', 'Total Payment', 'Remaining Balance'],
      ...paymentSchedule.map(item => [
        item.paymentNumber,
        item.principalPayment.toFixed(2),
        item.interestPayment.toFixed(2),
        item.totalPayment.toFixed(2),
        item.remainingBalance.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-schedule-${result.loanAmount}-${result.interestRate}pct-${result.loanTerm}yr.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    trackUserAction('schedule_exported', {
      calculationId: result.id,
      scheduleLength: paymentSchedule.length,
      exportFormat: 'csv'
    });
  };

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      newErrors.loanAmount = 'Please enter a valid loan amount';
    }
    
    if (!interestRate || parseFloat(interestRate) <= 0 || parseFloat(interestRate) > 50) {
      newErrors.interestRate = 'Please enter a valid interest rate (0-50%)';
    }
    
    if (!loanTerm || parseInt(loanTerm) <= 0 || parseInt(loanTerm) > 50) {
      newErrors.loanTerm = 'Please enter a valid loan term (1-50 years)';
    }
    
    // Advanced validation
    if (showAdvanced) {
      if (downPayment && parseFloat(downPayment) < 0) {
        newErrors.downPayment = 'Down payment cannot be negative';
      }
      
      if (propertyTax && (parseFloat(propertyTax) < 0 || parseFloat(propertyTax) > 10)) {
        newErrors.propertyTax = 'Property tax rate must be between 0-10%';
      }
      
      if (insurance && parseFloat(insurance) < 0) {
        newErrors.insurance = 'Insurance amount cannot be negative';
      }
      
      if (pmi && (parseFloat(pmi) < 0 || parseFloat(pmi) > 5)) {
        newErrors.pmi = 'PMI rate must be between 0-5%';
      }
    }
    
    // Track validation errors
    if (Object.keys(newErrors).length > 0) {
      trackUserAction('validation_errors', {
        errors: Object.keys(newErrors),
        attemptCount: attemptCount + 1,
        hasAdvancedFields: showAdvanced,
        errorCount: Object.keys(newErrors).length
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateLoan = async () => {
    setAttemptCount(prev => prev + 1);
    setIsCalculating(true);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (!validateInputs()) {
      setIsCalculating(false);
      
      // Track struggle signal if multiple failed attempts
      if (attemptCount >= 2) {
        trackStruggleSignal('loan_calculator', {
          attemptCount: attemptCount + 1,
          errorType: 'validation_errors',
          userContext: {
            deviceType: 'desktop',
            browserInfo: navigator.userAgent,
            persona: 'demo-user',
            userSegment: 'demo',
            sessionStage: 'active',
            previousActions: []
          },
          deviceInfo: {
            platform: 'Web' as const,
            appVersion: '1.0.0',
            deviceModel: 'Browser'
          }
        });
        onStruggleDetected();
      }
      
      return;
    }
    
    try {
      const principal = parseFloat(loanAmount);
      const monthlyRate = parseFloat(interestRate) / 100 / 12;
      const numberOfPayments = parseInt(loanTerm) * 12;
      
      // Calculate monthly payment using loan formula
      const monthlyPayment = principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
      
      const totalPayment = monthlyPayment * numberOfPayments;
      const totalInterest = totalPayment - principal;
      
      // Add advanced calculations if enabled
      let additionalMonthlyPayment = 0;
      if (showAdvanced) {
        if (propertyTax) {
          additionalMonthlyPayment += (principal * parseFloat(propertyTax) / 100) / 12;
        }
        if (insurance) {
          additionalMonthlyPayment += parseFloat(insurance) / 12;
        }
        if (pmi) {
          additionalMonthlyPayment += (principal * parseFloat(pmi) / 100) / 12;
        }
      }
      
      const calculation: LoanCalculation = {
        id: `calc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loanAmount: principal,
        interestRate: parseFloat(interestRate),
        loanTerm: parseInt(loanTerm),
        monthlyPayment: monthlyPayment + additionalMonthlyPayment,
        totalInterest,
        totalPayment,
        downPayment: downPayment ? parseFloat(downPayment) : undefined,
        propertyTax: propertyTax ? parseFloat(propertyTax) : undefined,
        insurance: insurance ? parseFloat(insurance) : undefined,
        pmi: pmi ? parseFloat(pmi) : undefined,
        createdAt: new Date()
      };
      
      // Generate payment schedule
      const schedule = generatePaymentSchedule(principal, monthlyRate, numberOfPayments, monthlyPayment);
      setPaymentSchedule(schedule);
      
      setResult(calculation);
      setIsCalculating(false);
      
      // Track successful calculation
      trackFeatureInteraction('loan_calculator_success', true, {
        attemptCount: attemptCount + 1,
        userContext: {
          deviceType: 'desktop',
          browserInfo: navigator.userAgent,
          persona: 'demo-user',
          userSegment: 'demo',
          sessionStage: 'active',
          previousActions: []
        },
        deviceInfo: {
          platform: 'Web' as const,
          appVersion: '1.0.0',
          deviceModel: 'Browser'
        }
      });
      
      onCalculationComplete();
      
    } catch (error) {
      setIsCalculating(false);
      setErrors({ general: 'Calculation failed. Please check your inputs.' });
      
      trackStruggleSignal('loan_calculator', {
        attemptCount: attemptCount + 1,
        errorType: 'calculation_error',
        userContext: {
          deviceType: 'desktop',
          browserInfo: navigator.userAgent,
          persona: 'demo-user',
          userSegment: 'demo',
          sessionStage: 'active',
          previousActions: []
        },
        deviceInfo: {
          platform: 'Web' as const,
          appVersion: '1.0.0',
          deviceModel: 'Browser'
        }
      });
      
      onStruggleDetected();
    }
  };

  const resetCalculator = () => {
    setLoanAmount('');
    setInterestRate('');
    setLoanTerm('');
    setDownPayment('');
    setPropertyTax('');
    setInsurance('');
    setPmi('');
    setResult(null);
    setErrors({});
    setAttemptCount(0);
    setShowAdvanced(false);
  };

  return (
    <div className="interactive-calculator">
      <div className="calculator-header">
        <h2>Loan Calculator</h2>
        <p>Calculate your monthly loan payments and total interest</p>
      </div>

      {attemptCount >= 2 && Object.keys(errors).length > 0 && (
        <div className="struggle-indicator">
          <span>💡</span> Having trouble? Make sure all fields contain positive numbers.
        </div>
      )}

      <div className="calculator-form">
        <div className="form-section">
          <h3>Basic Information</h3>
          
          <div className="form-group">
            <label htmlFor="loanAmount">Loan Amount ($)</label>
            <input
              type="number"
              id="loanAmount"
              value={loanAmount}
              onChange={(e) => {
                setLoanAmount(e.target.value);
                trackFormInteraction('loan-calculator', 'loanAmount', 'change', e.target.value);
              }}
              onFocus={() => trackFormInteraction('loan-calculator', 'loanAmount', 'focus')}
              onBlur={() => trackFormInteraction('loan-calculator', 'loanAmount', 'blur')}
              placeholder="e.g., 250000"
              className={errors.loanAmount ? 'error' : ''}
            />
            {errors.loanAmount && <span className="error-text">{errors.loanAmount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="interestRate">Annual Interest Rate (%)</label>
            <input
              type="number"
              id="interestRate"
              value={interestRate}
              onChange={(e) => {
                setInterestRate(e.target.value);
                trackFormInteraction('loan-calculator', 'interestRate', 'change', e.target.value);
              }}
              onFocus={() => trackFormInteraction('loan-calculator', 'interestRate', 'focus')}
              onBlur={() => trackFormInteraction('loan-calculator', 'interestRate', 'blur')}
              placeholder="e.g., 6.5"
              step="0.01"
              className={errors.interestRate ? 'error' : ''}
            />
            {errors.interestRate && <span className="error-text">{errors.interestRate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="loanTerm">Loan Term (years)</label>
            <input
              type="number"
              id="loanTerm"
              value={loanTerm}
              onChange={(e) => {
                setLoanTerm(e.target.value);
                trackFormInteraction('loan-calculator', 'loanTerm', 'change', e.target.value);
              }}
              onFocus={() => trackFormInteraction('loan-calculator', 'loanTerm', 'focus')}
              onBlur={() => trackFormInteraction('loan-calculator', 'loanTerm', 'blur')}
              placeholder="e.g., 30"
              className={errors.loanTerm ? 'error' : ''}
            />
            {errors.loanTerm && <span className="error-text">{errors.loanTerm}</span>}
          </div>
        </div>

        <div className="advanced-toggle">
          <button
            type="button"
            onClick={() => {
              const newState = !showAdvanced;
              setShowAdvanced(newState);
              
              // Track advanced options toggle
              trackButtonClick('advanced-options-toggle', 'Advanced Options', {
                expanded: newState,
                attemptCount,
                hasErrors: Object.keys(errors).length > 0,
                formCompleteness: {
                  loanAmount: !!loanAmount,
                  interestRate: !!interestRate,
                  loanTerm: !!loanTerm
                }
              });
            }}
            className="toggle-button"
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>
        </div>

        {showAdvanced && (
          <div className="form-section advanced-section">
            <h3>Advanced Options</h3>
            <p className="section-note">
              These fields are optional but provide more accurate calculations
            </p>

            <div className="form-group">
              <label htmlFor="downPayment">Down Payment ($)</label>
              <input
                type="number"
                id="downPayment"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                placeholder="e.g., 50000"
                className={errors.downPayment ? 'error' : ''}
              />
              {errors.downPayment && <span className="error-text">{errors.downPayment}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="propertyTax">Annual Property Tax Rate (%)</label>
              <input
                type="number"
                id="propertyTax"
                value={propertyTax}
                onChange={(e) => setPropertyTax(e.target.value)}
                placeholder="e.g., 1.2"
                step="0.01"
                className={errors.propertyTax ? 'error' : ''}
              />
              {errors.propertyTax && <span className="error-text">{errors.propertyTax}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="insurance">Annual Home Insurance ($)</label>
              <input
                type="number"
                id="insurance"
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                placeholder="e.g., 1200"
                className={errors.insurance ? 'error' : ''}
              />
              {errors.insurance && <span className="error-text">{errors.insurance}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="pmi">PMI Rate (% of loan amount)</label>
              <input
                type="number"
                id="pmi"
                value={pmi}
                onChange={(e) => setPmi(e.target.value)}
                placeholder="e.g., 0.5"
                step="0.01"
                className={errors.pmi ? 'error' : ''}
              />
              {errors.pmi && <span className="error-text">{errors.pmi}</span>}
            </div>
          </div>
        )}

        {errors.general && (
          <div className="error-message general-error">
            {errors.general}
          </div>
        )}

        <div className="calculator-actions">
          <button
            onClick={() => {
              const calculationStartTime = performance.now();
              
              // Track calculate button click
              trackButtonClick('calculate-payment', 'Calculate Payment', {
                attemptCount: attemptCount + 1,
                hasAdvancedFields: showAdvanced,
                formData: {
                  loanAmount: !!loanAmount,
                  interestRate: !!interestRate,
                  loanTerm: !!loanTerm,
                  downPayment: !!downPayment,
                  propertyTax: !!propertyTax,
                  insurance: !!insurance,
                  pmi: !!pmi
                },
                interactionStats: getInteractionStats('loan_calculator')
              });
              
              // Track pricing page view for AI analysis trigger
              trackUserAction('pricing_page_view', {
                feature: 'loan_calculator',
                attemptCount: attemptCount + 1,
                hasErrors: Object.keys(errors).length > 0,
                timestamp: new Date().toISOString()
              });
              
              calculateLoan().then(() => {
                const calculationEndTime = performance.now();
                trackPerformanceMetric('loan_calculation_time', calculationEndTime - calculationStartTime, 'ms');
              });
            }}
            disabled={isCalculating}
            className="calculate-button"
          >
            {isCalculating ? 'Calculating...' : 'Calculate Payment'}
          </button>
          <button
            onClick={() => {
              // Track reset button click
              trackButtonClick('reset-calculator', 'Reset', {
                hadResults: !!result,
                attemptCount,
                hasAdvancedFields: showAdvanced,
                hadErrors: Object.keys(errors).length > 0
              });
              
              resetCalculator();
            }}
            className="reset-button"
          >
            Reset
          </button>
        </div>
      </div>

      {result && (
        <div className="calculation-results">
          <div className="results-header">
            <h3>Calculation Results</h3>
            <div className="results-actions">
              <button
                onClick={() => setShowSaveDialog(true)}
                className="save-button"
              >
                💾 Save Calculation
              </button>
              <button
                onClick={() => setShowSchedule(!showSchedule)}
                className="schedule-button"
              >
                📊 {showSchedule ? 'Hide' : 'Show'} Payment Schedule
              </button>
            </div>
          </div>
          
          <div className="results-grid">
            <div className="result-item">
              <label>Monthly Payment</label>
              <span className="result-value primary">${result.monthlyPayment.toFixed(2)}</span>
            </div>
            <div className="result-item">
              <label>Total Interest</label>
              <span className="result-value">${result.totalInterest.toFixed(2)}</span>
            </div>
            <div className="result-item">
              <label>Total Payment</label>
              <span className="result-value">${result.totalPayment.toFixed(2)}</span>
            </div>
            <div className="result-item">
              <label>Interest Rate</label>
              <span className="result-value">{result.interestRate}%</span>
            </div>
          </div>
          
          <div className="results-summary">
            <p>
              Based on your loan of ${result.loanAmount.toLocaleString()} at {result.interestRate}% 
              interest for {result.loanTerm} years, you'll pay ${result.monthlyPayment.toFixed(2)} per month.
            </p>
            {showAdvanced && (result.downPayment || result.propertyTax || result.insurance || result.pmi) && (
              <div className="advanced-summary">
                <h4>Advanced Details:</h4>
                <ul>
                  {result.downPayment && <li>Down Payment: ${result.downPayment.toLocaleString()}</li>}
                  {result.propertyTax && <li>Property Tax: {result.propertyTax}% annually</li>}
                  {result.insurance && <li>Home Insurance: ${result.insurance.toLocaleString()} annually</li>}
                  {result.pmi && <li>PMI: {result.pmi}% of loan amount</li>}
                </ul>
              </div>
            )}
          </div>

          {showSchedule && paymentSchedule.length > 0 && (
            <div className="payment-schedule">
              <div className="schedule-header">
                <h4>Payment Schedule</h4>
                <button onClick={exportSchedule} className="export-button">
                  📥 Export CSV
                </button>
              </div>
              
              <div className="schedule-summary">
                <div className="summary-item">
                  <label>Total Payments:</label>
                  <span>{paymentSchedule.length}</span>
                </div>
                <div className="summary-item">
                  <label>Total Interest:</label>
                  <span>${paymentSchedule.reduce((sum, item) => sum + item.interestPayment, 0).toFixed(2)}</span>
                </div>
                <div className="summary-item">
                  <label>Total Principal:</label>
                  <span>${paymentSchedule.reduce((sum, item) => sum + item.principalPayment, 0).toFixed(2)}</span>
                </div>
              </div>
              
              <div className="schedule-table-container">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Payment #</th>
                      <th>Principal</th>
                      <th>Interest</th>
                      <th>Total Payment</th>
                      <th>Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSchedule.slice(0, 12).map((payment) => (
                      <tr key={payment.paymentNumber}>
                        <td>{payment.paymentNumber}</td>
                        <td>${payment.principalPayment.toFixed(2)}</td>
                        <td>${payment.interestPayment.toFixed(2)}</td>
                        <td>${payment.totalPayment.toFixed(2)}</td>
                        <td>${payment.remainingBalance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paymentSchedule.length > 12 && (
                  <div className="schedule-note">
                    Showing first 12 payments. Export CSV for complete schedule.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showSaveDialog && (
        <div className="modal-overlay">
          <div className="save-dialog">
            <h3>Save Calculation</h3>
            <div className="form-group">
              <label htmlFor="calculationName">Calculation Name</label>
              <input
                type="text"
                id="calculationName"
                value={calculationName}
                onChange={(e) => setCalculationName(e.target.value)}
                placeholder="e.g., Home Loan Option 1"
              />
            </div>
            <div className="dialog-actions">
              <button
                onClick={() => {
                  if (result) {
                    const savedCalculation = {
                      ...result,
                      name: calculationName || `Calculation ${new Date().toLocaleDateString()}`
                    };
                    saveCalculation(savedCalculation);
                    setShowSaveDialog(false);
                    setCalculationName('');
                  }
                }}
                className="save-confirm-button"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setCalculationName('');
                }}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {calculationHistory.length > 0 && (
        <div className="calculation-history">
          <div className="history-header">
            <h3>Calculation History</h3>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="toggle-history-button"
            >
              {showHistory ? 'Hide' : 'Show'} History ({calculationHistory.length})
            </button>
          </div>
          
          {showHistory && (
            <div className="history-list">
              {calculationHistory.map((calc) => (
                <div key={calc.id} className="history-item">
                  <div className="history-info">
                    <h4>{calc.name || 'Unnamed Calculation'}</h4>
                    <div className="history-details">
                      <span>${calc.loanAmount.toLocaleString()} at {calc.interestRate}% for {calc.loanTerm} years</span>
                      <span className="history-date">{calc.createdAt.toLocaleDateString()}</span>
                    </div>
                    <div className="history-result">
                      Monthly Payment: ${calc.monthlyPayment.toFixed(2)}
                    </div>
                  </div>
                  <div className="history-actions">
                    <button
                      onClick={() => loadCalculation(calc)}
                      className="load-button"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => {
                        const newHistory = calculationHistory.filter(h => h.id !== calc.id);
                        setCalculationHistory(newHistory);
                        trackUserAction('calculation_deleted', { calculationId: calc.id });
                      }}
                      className="delete-button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="calculator-help">
        <h4>How to use this calculator:</h4>
        <ul>
          <li>Enter the total amount you want to borrow</li>
          <li>Input the annual interest rate (as a percentage)</li>
          <li>Specify the loan term in years</li>
          <li>Click "Calculate Payment" to see your results</li>
        </ul>
      </div>


    </div>
  );
};

export default InteractiveCalculator;