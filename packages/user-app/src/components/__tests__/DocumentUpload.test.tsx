import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentUpload from '../DocumentUpload';
import { useEventTracking } from '@aws-agent/shared';

// Mock the shared hook and EventService
jest.mock('@aws-agent/shared', () => ({
  useEventTracking: jest.fn(),
  EventService: jest.fn().mockImplementation(() => ({
    trackEvent: jest.fn(),
    flush: jest.fn()
  }))
}));

// Mock fetch
global.fetch = jest.fn();

const mockTrackEvent = jest.fn();

describe('DocumentUpload Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'doc-123', fileName: 'test.pdf' })
    });
  });

  it('renders document upload interface', () => {
    render(<DocumentUpload />);
    
    expect(screen.getByText(/document upload center/i)).toBeInTheDocument();
    expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
  });

  it('handles file selection via input', async () => {
    render(<DocumentUpload />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/select files/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  it('validates file size limits', async () => {
    render(<DocumentUpload />);
    
    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { 
      type: 'application/pdf' 
    });
    const input = screen.getByLabelText(/select files/i);
    
    fireEvent.change(input, { target: { files: [largeFile] } });
    
    await waitFor(() => {
      expect(screen.getByText(/file size exceeds 10mb limit/i)).toBeInTheDocument();
    });
  });

  it('validates file types', async () => {
    render(<DocumentUpload />);
    
    const invalidFile = new File(['test'], 'test.exe', { type: 'application/exe' });
    const input = screen.getByLabelText(/select files/i);
    
    fireEvent.change(input, { target: { files: [invalidFile] } });
    
    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });
  });

  it('handles successful file upload', async () => {
    render(<DocumentUpload />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/select files/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('document_upload_complete', {
        fileName: 'test.pdf',
        fileSize: expect.any(Number),
        success: true
      });
    });
  });

  it('handles upload errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Upload failed'));
    
    render(<DocumentUpload />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/select files/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    });
    
    expect(mockTrackEvent).toHaveBeenCalledWith('document_upload_complete', {
      fileName: 'test.pdf',
      fileSize: expect.any(Number),
      success: false,
      errorMessage: 'Upload failed'
    });
  });

  it('supports drag and drop functionality', async () => {
    render(<DocumentUpload />);
    
    const dropZone = screen.getByText(/drag and drop files here/i).closest('div');
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.dragOver(dropZone!);
    expect(dropZone).toHaveClass('drag-over');
    
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file]
      }
    });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  it('displays upload progress', async () => {
    render(<DocumentUpload />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/select files/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
  });

  it('allows file removal before upload', async () => {
    render(<DocumentUpload />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/select files/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    
    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);
    
    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
  });
});