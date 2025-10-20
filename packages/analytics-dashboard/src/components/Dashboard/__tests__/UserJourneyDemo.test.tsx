import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserJourneyDemo from '../UserJourneyDemo';
import { useAnalytics } from '@aws-agent/shared';

// Mock the shared hook
jest.mock('@aws-agent/shared', () => ({
  useAnalytics: jest.fn()
}));

const mockUserJourneyData = {
  personas: [
    {
      id: 'sarah',
      name: 'Sarah',
      role: 'First-time Homebuyer',
      avatar: 'sarah.jpg',
      journey: [
        { step: 'video_library', timestamp: '2024-01-01T10:00:00Z', duration: 300 },
        { step: 'loan_calculator', timestamp: '2024-01-01T10:05:00Z', duration: 180 },
        { step: 'document_upload', timestamp: '2024-01-01T10:08:00Z', duration: 120 }
      ],
      metrics: {
        completionRate: 85,
        averageSessionTime: 600,
        strugglesEncountered: 2
      }
    },
    {
      id: 'mike',
      name: 'Mike',
      role: 'Refinancing Expert',
      avatar: 'mike.jpg',
      journey: [
        { step: 'loan_calculator', timestamp: '2024-01-01T14:00:00Z', duration: 240 },
        { step: 'video_library', timestamp: '2024-01-01T14:04:00Z', duration: 150 }
      ],
      metrics: {
        completionRate: 92,
        averageSessionTime: 390,
        strugglesEncountered: 0
      }
    }
  ],
  behaviorPatterns: [
    {
      pattern: 'calculator_first',
      description: 'Users who start with loan calculator',
      frequency: 65,
      conversionRate: 78
    },
    {
      pattern: 'video_first',
      description: 'Users who start with video library',
      frequency: 35,
      conversionRate: 82
    }
  ]
};

describe('UserJourneyDemo Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue({
      data: mockUserJourneyData,
      loading: false,
      error: null
    });
  });

  it('renders user journey demo with persona cards', () => {
    render(<UserJourneyDemo />);
    
    expect(screen.getByText(/user journey analytics/i)).toBeInTheDocument();
    expect(screen.getByText('Sarah')).toBeInTheDocument();
    expect(screen.getByText('First-time Homebuyer')).toBeInTheDocument();
    expect(screen.getByText('Mike')).toBeInTheDocument();
    expect(screen.getByText('Refinancing Expert')).toBeInTheDocument();
  });

  it('displays persona metrics correctly', () => {
    render(<UserJourneyDemo />);
    
    // Sarah's metrics
    expect(screen.getByText('85%')).toBeInTheDocument(); // Completion rate
    expect(screen.getByText('10:00')).toBeInTheDocument(); // Average session time (600 seconds)
    expect(screen.getByText('2 struggles')).toBeInTheDocument();
    
    // Mike's metrics
    expect(screen.getByText('92%')).toBeInTheDocument(); // Completion rate
    expect(screen.getByText('6:30')).toBeInTheDocument(); // Average session time (390 seconds)
    expect(screen.getByText('0 struggles')).toBeInTheDocument();
  });

  it('shows journey steps for each persona', () => {
    render(<UserJourneyDemo />);
    
    // Sarah's journey
    const sarahCard = screen.getByText('Sarah').closest('.persona-card');
    expect(sarahCard).toBeInTheDocument();
    
    within(sarahCard!).getByText('video_library');
    within(sarahCard!).getByText('loan_calculator');
    within(sarahCard!).getByText('document_upload');
    
    // Mike's journey
    const mikeCard = screen.getByText('Mike').closest('.persona-card');
    expect(mikeCard).toBeInTheDocument();
    
    within(mikeCard!).getByText('loan_calculator');
    within(mikeCard!).getByText('video_library');
  });

  it('displays behavior patterns analysis', () => {
    render(<UserJourneyDemo />);
    
    expect(screen.getByText(/behavior patterns/i)).toBeInTheDocument();
    expect(screen.getByText('calculator_first')).toBeInTheDocument();
    expect(screen.getByText('Users who start with loan calculator')).toBeInTheDocument();
    expect(screen.getByText('65% frequency')).toBeInTheDocument();
    expect(screen.getByText('78% conversion')).toBeInTheDocument();
    
    expect(screen.getByText('video_first')).toBeInTheDocument();
    expect(screen.getByText('Users who start with video library')).toBeInTheDocument();
    expect(screen.getByText('35% frequency')).toBeInTheDocument();
    expect(screen.getByText('82% conversion')).toBeInTheDocument();
  });

  it('allows filtering personas by completion rate', async () => {
    const user = userEvent.setup();
    render(<UserJourneyDemo />);
    
    const filterSelect = screen.getByLabelText(/filter by completion rate/i);
    await user.selectOptions(filterSelect, 'high'); // >80%
    
    // Should show both personas (both have >80% completion)
    expect(screen.getByText('Sarah')).toBeInTheDocument();
    expect(screen.getByText('Mike')).toBeInTheDocument();
    
    await user.selectOptions(filterSelect, 'medium'); // 60-80%
    
    // Should show no personas (none in 60-80% range)
    expect(screen.queryByText('Sarah')).not.toBeInTheDocument();
    expect(screen.queryByText('Mike')).not.toBeInTheDocument();
  });

  it('shows detailed journey timeline when persona is clicked', async () => {
    const user = userEvent.setup();
    render(<UserJourneyDemo />);
    
    const sarahCard = screen.getByText('Sarah').closest('.persona-card');
    await user.click(sarahCard!);
    
    // Should show detailed timeline
    expect(screen.getByText(/detailed journey timeline/i)).toBeInTheDocument();
    expect(screen.getByText('10:00 AM')).toBeInTheDocument(); // First step time
    expect(screen.getByText('5:00 duration')).toBeInTheDocument(); // Video library duration
    expect(screen.getByText('3:00 duration')).toBeInTheDocument(); // Calculator duration
  });

  it('displays struggle points in journey', () => {
    render(<UserJourneyDemo />);
    
    // Sarah has 2 struggles
    const sarahCard = screen.getByText('Sarah').closest('.persona-card');
    const struggleIndicators = within(sarahCard!).getAllByTestId('struggle-indicator');
    expect(struggleIndicators).toHaveLength(2);
  });

  it('shows journey completion visualization', () => {
    render(<UserJourneyDemo />);
    
    // Should show progress bars for each persona
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);
    
    // Sarah's progress bar should show 85%
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '85');
    // Mike's progress bar should show 92%
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '92');
  });

  it('handles loading state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      error: null
    });
    
    render(<UserJourneyDemo />);
    
    expect(screen.getByText(/loading user journeys/i)).toBeInTheDocument();
  });

  it('handles error state', () => {
    (useAnalytics as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Failed to load')
    });
    
    render(<UserJourneyDemo />);
    
    expect(screen.getByText(/failed to load user journeys/i)).toBeInTheDocument();
  });

  it('allows sorting personas by different metrics', async () => {
    const user = userEvent.setup();
    render(<UserJourneyDemo />);
    
    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.selectOptions(sortSelect, 'completion-rate');
    
    // Mike (92%) should appear before Sarah (85%)
    const personaNames = screen.getAllByTestId('persona-name');
    expect(personaNames[0]).toHaveTextContent('Mike');
    expect(personaNames[1]).toHaveTextContent('Sarah');
    
    await user.selectOptions(sortSelect, 'session-time');
    
    // Sarah (600s) should appear before Mike (390s)
    const updatedPersonaNames = screen.getAllByTestId('persona-name');
    expect(updatedPersonaNames[0]).toHaveTextContent('Sarah');
    expect(updatedPersonaNames[1]).toHaveTextContent('Mike');
  });

  it('exports journey data', async () => {
    const user = userEvent.setup();
    render(<UserJourneyDemo />);
    
    const exportButton = screen.getByRole('button', { name: /export journey data/i });
    await user.click(exportButton);
    
    // Should show export options
    expect(screen.getByText(/export format/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument();
  });

  it('compares personas side by side', async () => {
    const user = userEvent.setup();
    render(<UserJourneyDemo />);
    
    // Select Sarah for comparison
    const sarahCheckbox = screen.getByLabelText(/select sarah for comparison/i);
    await user.click(sarahCheckbox);
    
    // Select Mike for comparison
    const mikeCheckbox = screen.getByLabelText(/select mike for comparison/i);
    await user.click(mikeCheckbox);
    
    // Click compare button
    const compareButton = screen.getByRole('button', { name: /compare selected/i });
    await user.click(compareButton);
    
    // Should show comparison view
    expect(screen.getByText(/persona comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/completion rate difference/i)).toBeInTheDocument();
    expect(screen.getByText('7%')).toBeInTheDocument(); // 92% - 85% = 7%
  });
});