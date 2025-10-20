import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DocumentUploadPage from '../DocumentUploadPage';
import { useAuth, useEventTracking } from '@aws-agent/shared';

// Mock the shared hooks
jest.mock('@aws-agent/shared', () => ({
  useAuth: jest.fn(),
  useEventTracking: jest.fn()
}));

// Mock the DocumentUpload component
jest.mock('../components/DocumentUpload', () => {
  return function MockDocumentUpload() {
    return <div data-testid="document-upload">Document Upload Component</div>;
  };
});

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe'
};

const mockTrackEvent = jest.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('DocumentUploadPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false
    });
    (useEventTracking as jest.Mock).mockReturnValue({
      trackEvent: mockTrackEvent
    });
    
    // Mock fetch for document list
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
  });

  it('renders document upload page with header and upload component', () => {
    renderWithRouter(<DocumentUploadPage />);
    
    expect(screen.getByText(/document center/i)).toBeInTheDocument();
    expect(screen.getByText(/upload and manage your documents/i)).toBeInTheDocument();
    expect(screen.getByTestId('document-upload')).toBeInTheDocument();
  });

  it('tracks page view event on mount', () => {
    renderWithRouter(<DocumentUploadPage />);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('page_view', {
      page: 'documents',
      userId: 'user-123'
    });
  });

  it('displays supported file types information', () => {
    renderWithRouter(<DocumentUploadPage />);
    
    expect(screen.getByText(/supported file types/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/doc/i)).toBeInTheDocument();
    expect(screen.getByText(/docx/i)).toBeInTheDocument();
    expect(screen.getByText(/txt/i)).toBeInTheDocument();
  });

  it('shows file size limits', () => {
    renderWithRouter(<DocumentUploadPage />);
    
    expect(screen.getByText(/maximum file size: 10mb/i)).toBeInTheDocument();
  });

  it('displays user documents list', async () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        fileName: 'resume.pdf',
        fileSize: 1024000,
        uploadDate: '2024-01-01T00:00:00Z',
        status: 'completed'
      },
      {
        id: 'doc-2',
        fileName: 'contract.docx',
        fileSize: 2048000,
        uploadDate: '2024-01-02T00:00:00Z',
        status: 'completed'
      }
    ];
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDocuments)
    });
    
    renderWithRouter(<DocumentUploadPage />);
    
    await waitFor(() => {
      expect(screen.getByText('resume.pdf')).toBeInTheDocument();
      expect(screen.getByText('contract.docx')).toBeInTheDocument();
    });
  });

  it('handles document download', async () => {
    const user = userEvent.setup();
    const mockDocuments = [
      {
        id: 'doc-1',
        fileName: 'resume.pdf',
        fileSize: 1024000,
        uploadDate: '2024-01-01T00:00:00Z',
        status: 'completed'
      }
    ];
    
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDocuments)
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['file content']))
      });
    
    renderWithRouter(<DocumentUploadPage />);
    
    await waitFor(() => {
      expect(screen.getByText('resume.pdf')).toBeInTheDocument();
    });
    
    const downloadButton = screen.getByRole('button', { name: /download resume.pdf/i });
    await user.click(downloadButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('document_download', {
      documentId: 'doc-1',
      fileName: 'resume.pdf'
    });
  });

  it('handles document deletion', async () => {
    const user = userEvent.setup();
    const mockDocuments = [
      {
        id: 'doc-1',
        fileName: 'resume.pdf',
        fileSize: 1024000,
        uploadDate: '2024-01-01T00:00:00Z',
        status: 'completed'
      }
    ];
    
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDocuments)
      })
      .mockResolvedValueOnce({
        ok: true
      });
    
    renderWithRouter(<DocumentUploadPage />);
    
    await waitFor(() => {
      expect(screen.getByText('resume.pdf')).toBeInTheDocument();
    });
    
    const deleteButton = screen.getByRole('button', { name: /delete resume.pdf/i });
    await user.click(deleteButton);
    
    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    await user.click(confirmButton);
    
    expect(mockTrackEvent).toHaveBeenCalledWith('document_delete', {
      documentId: 'doc-1',
      fileName: 'resume.pdf'
    });
  });

  it('displays empty state when no documents', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
    
    renderWithRouter(<DocumentUploadPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/no documents uploaded yet/i)).toBeInTheDocument();
    });
  });

  it('handles user not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false
    });
    
    renderWithRouter(<DocumentUploadPage />);
    
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    expect(screen.queryByTestId('document-upload')).not.toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true
    });
    
    renderWithRouter(<DocumentUploadPage />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
    
    renderWithRouter(<DocumentUploadPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load documents/i)).toBeInTheDocument();
    });
  });

  it('displays document metadata correctly', async () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        fileName: 'resume.pdf',
        fileSize: 1024000, // 1MB
        uploadDate: '2024-01-01T00:00:00Z',
        status: 'completed'
      }
    ];
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDocuments)
    });
    
    renderWithRouter(<DocumentUploadPage />);
    
    await waitFor(() => {
      expect(screen.getByText('resume.pdf')).toBeInTheDocument();
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.getByText(/jan 1, 2024/i)).toBeInTheDocument();
    });
  });

  it('shows upload progress for pending documents', async () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        fileName: 'uploading.pdf',
        fileSize: 1024000,
        uploadDate: '2024-01-01T00:00:00Z',
        status: 'uploading'
      }
    ];
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDocuments)
    });
    
    renderWithRouter(<DocumentUploadPage />);
    
    await waitFor(() => {
      expect(screen.getByText('uploading.pdf')).toBeInTheDocument();
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });
  });
});