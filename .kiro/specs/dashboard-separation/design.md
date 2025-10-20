# Dashboard Separation Design Document

## Overview

This design document outlines the architectural approach for separating the current monolithic React application into two distinct applications: a **User Application** for end-user interactions and an **Analytics Dashboard** for internal team analysis. The separation will improve security, user experience, maintainability, and scalability while maintaining shared components and consistent data flow.

## Architecture

### High-Level Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│   User Application  │    │ Analytics Dashboard │
│   (Port 3000)       │    │   (Port 3001)       │
├─────────────────────┤    ├─────────────────────┤
│ • Video Library     │    │ • User Journey Demo │
│ • Interactive Tools │    │ • User Personas     │
│ • Document Center   │    │ • Behavior Tracking │
│ • User Profile      │    │ • Struggle Signals  │
│ • Authentication    │    │ • Analytics Export  │
└─────────────────────┘    └─────────────────────┘
           │                           │
           └───────────┬───────────────┘
                       │
           ┌─────────────────────┐
           │   Shared Library    │
           │                     │
           │ • Types/Interfaces  │
           │ • API Services      │
           │ • Common Components │
           │ • Utilities         │
           └─────────────────────┘
                       │
           ┌─────────────────────┐
           │   Backend API       │
           │   (Port 8080)       │
           │                     │
           │ • Event Collection  │
           │ • Analytics API     │
           │ • Authentication    │
           └─────────────────────┘
```

### Application Structure

```
project-root/
├── packages/
│   ├── shared/                    # Shared library
│   │   ├── src/
│   │   │   ├── types/            # TypeScript interfaces
│   │   │   ├── services/         # API services
│   │   │   ├── components/       # Reusable components
│   │   │   ├── utils/            # Utility functions
│   │   │   └── hooks/            # Custom hooks
│   │   └── package.json
│   │
│   ├── user-app/                 # User-facing application
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Demo/         # Demo scenarios
│   │   │   │   ├── Auth/         # User authentication
│   │   │   │   └── Profile/      # User profile
│   │   │   ├── pages/            # Application pages
│   │   │   ├── contexts/         # React contexts
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   └── analytics-dashboard/      # Analytics application
│       ├── src/
│       │   ├── components/
│       │   │   ├── Dashboard/    # Dashboard components
│       │   │   ├── Charts/       # Visualization components
│       │   │   ├── Filters/      # Filter components
│       │   │   └── Export/       # Export functionality
│       │   ├── pages/            # Dashboard pages
│       │   ├── contexts/         # Analytics contexts
│       │   └── App.tsx
│       └── package.json
│
├── backend/                      # Existing backend (unchanged)
└── package.json                  # Root package.json (monorepo)
```

## Components and Interfaces

### Shared Library Components

#### 1. Types and Interfaces
- **UserEvent**: Event tracking interface
- **AnalyticsFilter**: Filtering interface
- **UserProfile**: User data interface
- **VideoEngagement**: Video metrics interface
- **StruggleSignal**: Struggle detection interface

#### 2. API Services
- **AnalyticsService**: Analytics data fetching
- **EventService**: Event tracking and submission
- **AuthService**: Authentication management
- **UserService**: User profile management

#### 3. Common Components
- **LoadingSpinner**: Consistent loading states
- **ErrorBoundary**: Error handling
- **DateRangePicker**: Date selection
- **Modal**: Reusable modal component
- **Button**: Standardized button component

#### 4. Custom Hooks
- **useEventTracking**: Event tracking logic
- **useAuth**: Authentication state management
- **useAnalytics**: Analytics data fetching
- **useWebSocket**: Real-time updates

### User Application Components

#### 1. Core Features
- **VideoLibrary**: Polished video content with proper titles and images
- **LoanCalculator**: Interactive loan payment calculator with working calculations
- **DocumentUploadCenter**: File upload functionality with size limits and validation
- **UserProfile**: User information display and management
- **UserProgress**: Progress tracking display

#### 2. Authentication
- **LoginForm**: User login interface
- **RegisterForm**: User registration
- **AuthWrapper**: Authentication routing
- **ProfileManager**: User profile data management

#### 3. Navigation
- **UserHeader**: Application header with user menu
- **TabNavigation**: Feature navigation between tools
- **UserMenu**: User account and profile menu

#### 4. Interactive Tools
- **LoanPaymentCalculator**: Calculate monthly payments and total interest
- **DocumentProcessor**: Handle document uploads with validation
- **VideoPlayer**: Enhanced video playback with engagement tracking

### Analytics Dashboard Components

#### 1. Dashboard Views
- **UserJourneyDemo**: User persona cards and behavior analysis (moved from User App)
- **AutomatedBehaviorTracking**: Real-time behavior monitoring (moved from User App)
- **MetricsOverview**: Key metrics display
- **StruggleSignalsPanel**: Struggle detection display
- **VideoEngagementPanel**: Video analytics

#### 2. Data Visualization
- **UserPersonaCards**: Display user personas (Sarah, Mike, Jenny, Alex)
- **BehaviorTimeline**: Automated behavior tracking timeline
- **TimeSeriesChart**: Trend visualization
- **UserSegmentationChart**: Segmentation display
- **HeatmapChart**: Interaction heatmaps
- **FunnelChart**: Conversion funnel

#### 3. Tools and Utilities
- **FilterPanel**: Advanced filtering
- **ExportPanel**: Data export tools
- **AmazonQChat**: AI-powered insights
- **RealTimeMonitor**: Live data updates

## Data Models

### User Application Data Models

#### Video Library Model
```typescript
interface Video {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  category: string;
  tags: string[];
  uploadDate: Date;
}

interface VideoEngagement {
  videoId: string;
  userId: string;
  watchTime: number;
  completed: boolean;
  interactions: VideoInteraction[];
}
```

#### Loan Calculator Model
```typescript
interface LoanCalculation {
  principal: number;
  interestRate: number;
  termYears: number;
  monthlyPayment: number;
  totalInterest: number;
  totalAmount: number;
  paymentSchedule: PaymentScheduleItem[];
}

interface PaymentScheduleItem {
  paymentNumber: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
}
```

#### Document Upload Model
```typescript
interface DocumentUpload {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadDate: Date;
  status: 'uploading' | 'completed' | 'failed';
  downloadUrl?: string;
}
```

#### User Profile Model
```typescript
interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  lastLoginAt: Date;
}

interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
}
```

### Event Tracking Model
```typescript
interface UserEvent {
  eventId: string;
  userId: string;
  sessionId: string;
  eventType: 'page_view' | 'feature_interaction' | 'video_engagement' | 'loan_calculation' | 'document_upload' | 'profile_update';
  timestamp: Date;
  eventData: {
    feature?: string;
    attemptCount?: number;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
    calculationResult?: LoanCalculation;
    documentInfo?: DocumentUpload;
    videoInfo?: VideoEngagement;
  };
  userContext: {
    deviceType: string;
    browserInfo: string;
    location?: string;
    persona?: string;
  };
}
```

### Analytics Filter Model
```typescript
interface AnalyticsFilter {
  dateRange: {
    start: Date;
    end: Date;
  };
  userSegments: string[];
  platforms: string[];
  features: string[];
  personas?: string[];
  eventTypes?: string[];
}
```

### Dashboard Configuration Model
```typescript
interface DashboardConfig {
  layout: 'grid' | 'list' | 'custom';
  widgets: DashboardWidget[];
  refreshInterval: number;
  defaultFilters: AnalyticsFilter;
  exportSettings: ExportConfig;
}
```

## Error Handling

### User Application Error Handling
1. **Graceful Degradation**: Continue functioning even if analytics fail
2. **User-Friendly Messages**: Clear error messages for user actions
3. **Retry Logic**: Automatic retry for failed event submissions
4. **Offline Support**: Queue events when offline, sync when online

### Analytics Dashboard Error Handling
1. **Data Validation**: Validate all incoming analytics data
2. **Fallback Data**: Show cached or mock data when API fails
3. **Error Reporting**: Detailed error logging for debugging
4. **Progressive Loading**: Load components incrementally to handle failures

### Shared Error Handling
1. **Error Boundary**: React error boundaries in both applications
2. **Centralized Logging**: Consistent error logging across applications
3. **User Feedback**: Clear feedback for all error states
4. **Recovery Actions**: Provide recovery options for users

## Testing Strategy

### Unit Testing
- **Shared Components**: Test all shared components independently
- **Services**: Mock API calls and test service logic
- **Hooks**: Test custom hooks with React Testing Library
- **Utilities**: Test utility functions with Jest

### Integration Testing
- **API Integration**: Test API service integration
- **Component Integration**: Test component interactions
- **Authentication Flow**: Test auth across both applications
- **Event Tracking**: Test event flow from user app to analytics

### End-to-End Testing
- **User Workflows**: Test complete user journeys in user app
- **Analytics Workflows**: Test analytics team workflows in dashboard
- **Cross-Application**: Test data flow between applications
- **Performance**: Test application performance under load

### Testing Tools
- **Jest**: Unit testing framework
- **React Testing Library**: Component testing
- **Cypress**: End-to-end testing
- **MSW**: API mocking for tests

## Backend API Specifications

### User Application Endpoints

#### Video Library Endpoints
- `GET /api/videos` - Get all videos with pagination
- `GET /api/videos/{id}` - Get specific video details
- `POST /api/videos/{id}/engagement` - Track video engagement
- `GET /api/videos/categories` - Get video categories

#### Loan Calculator Endpoints
- `POST /api/calculator/loan` - Calculate loan payments
- `GET /api/calculator/loan/history/{userId}` - Get user's calculation history
- `POST /api/calculator/loan/save` - Save calculation results

#### Document Upload Endpoints
- `POST /api/documents/upload` - Upload document (max 10MB)
- `GET /api/documents/{userId}` - Get user's documents
- `DELETE /api/documents/{id}` - Delete document
- `GET /api/documents/{id}/download` - Download document

#### User Profile Endpoints
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/avatar` - Upload user avatar
- `GET /api/users/preferences` - Get user preferences
- `PUT /api/users/preferences` - Update user preferences

#### Event Tracking Endpoints
- `POST /api/events/track` - Track user events
- `POST /api/events/batch` - Batch track multiple events

### Analytics Dashboard Endpoints
- `GET /api/analytics/user-journey` - Get user journey data
- `GET /api/analytics/personas` - Get user persona analytics
- `GET /api/analytics/behavior-tracking` - Get behavior tracking data
- `GET /api/analytics/engagement` - Get engagement metrics

## Security Considerations

### Authentication and Authorization
- **User App**: Firebase authentication with JWT tokens
- **Analytics Dashboard**: Role-based access control for analytics team
- **API Security**: JWT token validation for all protected endpoints
- **Session Management**: Secure session handling in both apps

### File Upload Security
- **File Size Limits**: Maximum 10MB per file
- **File Type Validation**: Only allow specific file types (PDF, DOC, DOCX, TXT)
- **Virus Scanning**: Implement file scanning before storage
- **Secure Storage**: Store files in AWS S3 with proper access controls

### Data Protection
- **Event Data**: Anonymize sensitive user data in events
- **Analytics Data**: Implement data access controls
- **API Endpoints**: Separate endpoints for user and analytics data
- **CORS Configuration**: Proper CORS setup for both applications

### Deployment Security
- **Environment Variables**: Secure configuration management
- **HTTPS**: Force HTTPS in production
- **Content Security Policy**: Implement CSP headers
- **Dependency Security**: Regular security audits of dependencies

## Event Tracking and Monitoring

### Firebase Analytics Events
- **Video Events**: video_start, video_pause, video_complete, video_seek
- **Calculator Events**: calculation_start, calculation_complete, calculation_save
- **Document Events**: document_upload_start, document_upload_complete, document_download
- **Profile Events**: profile_view, profile_update, avatar_upload
- **Navigation Events**: page_view, feature_access, menu_interaction

### AWS CloudWatch Logging
- **API Request Logs**: All API calls with response times and status codes
- **Error Logs**: Application errors with stack traces and context
- **Performance Metrics**: Response times, throughput, error rates
- **User Activity Logs**: Feature usage patterns and user flows
- **Security Logs**: Authentication attempts and authorization failures

### Event Processing Flow
```
User Action → Firebase Analytics → Backend API → AWS CloudWatch → Analytics Dashboard
```

## Performance Optimization

### User Application Performance
- **Code Splitting**: Lazy load components and routes
- **Event Batching**: Batch event submissions to reduce API calls
- **Caching**: Cache user data, videos, and calculation results
- **Bundle Optimization**: Minimize bundle size for faster loading
- **Image Optimization**: Optimize video thumbnails and user avatars

### Analytics Dashboard Performance
- **Data Virtualization**: Virtualize large datasets
- **Chart Optimization**: Optimize chart rendering performance
- **Real-time Updates**: Efficient WebSocket implementation
- **Memory Management**: Proper cleanup of subscriptions and timers

### Shared Performance
- **Tree Shaking**: Remove unused code from shared library
- **CDN**: Use CDN for static assets
- **Compression**: Enable gzip compression
- **Monitoring**: Performance monitoring and alerting

## Deployment Strategy

### Development Environment
- **Local Development**: Both apps run on different ports (3000, 3001)
- **Hot Reloading**: Independent hot reloading for each application
- **Shared Development**: Shared library changes reflect in both apps
- **Mock Services**: Mock backend services for development

### Production Deployment
- **Independent Deployment**: Deploy applications separately
- **Blue-Green Deployment**: Zero-downtime deployments
- **CDN Distribution**: Serve static assets via CDN
- **Health Checks**: Application health monitoring

### Infrastructure
- **Container Strategy**: Separate containers for each application
- **Load Balancing**: Application-specific load balancing
- **Scaling**: Independent horizontal scaling
- **Monitoring**: Application-specific monitoring and alerting