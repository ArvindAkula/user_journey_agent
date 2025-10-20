# Analytics Dashboard Environment Configuration

This document describes all environment variables used by the Analytics Dashboard.

## Required Environment Variables

### Server Configuration
- `PORT` - Port number for the development server (default: 3001)
- `REACT_APP_API_BASE_URL` - Base URL for the backend API
- `REACT_APP_ANALYTICS_API_BASE_URL` - Specific URL for analytics API endpoints
- `REACT_APP_WEBSOCKET_URL` - WebSocket URL for analytics real-time connections
- `REACT_APP_REALTIME_ENDPOINT` - Dedicated real-time data endpoint

### Application Configuration
- `REACT_APP_ENVIRONMENT` - Application environment (development, staging, production)
- `REACT_APP_APP_NAME` - Application name for display purposes
- `REACT_APP_VERSION` - Application version
- `REACT_APP_APP_TYPE` - Application type identifier (should be "analytics")

### Authentication Configuration
- `REACT_APP_AUTH_PROVIDER` - Authentication provider type (jwt, oauth, etc.)
- `REACT_APP_AUTH_ENDPOINT` - Authentication endpoint for analytics team login
- `REACT_APP_TOKEN_REFRESH_INTERVAL` - Token refresh interval in ms (default: 3600000)
- `REACT_APP_SESSION_TIMEOUT` - Session timeout in ms (default: 7200000)

## Optional Configuration

### Analytics Specific Configuration
- `REACT_APP_ANALYTICS_REFRESH_INTERVAL` - Dashboard refresh interval in ms (default: 30000)
- `REACT_APP_EXPORT_MAX_RECORDS` - Maximum records per export (default: 10000)
- `REACT_APP_CHART_ANIMATION_DURATION` - Chart animation duration in ms (default: 300)
- `REACT_APP_DATA_RETENTION_DAYS` - Data retention period in days (default: 90)
- `REACT_APP_MAX_CONCURRENT_EXPORTS` - Maximum concurrent exports (default: 3)
- `REACT_APP_REALTIME_BUFFER_SIZE` - Real-time data buffer size (default: 1000)

### Feature Flags
- `REACT_APP_ENABLE_AMAZON_Q` - Enable Amazon Q integration (default: true)
- `REACT_APP_ENABLE_EXPORT` - Enable data export functionality (default: true)
- `REACT_APP_ENABLE_REALTIME` - Enable real-time updates (default: true)
- `REACT_APP_ENABLE_ADVANCED_FILTERS` - Enable advanced filtering (default: true)
- `REACT_APP_ENABLE_USER_SEGMENTATION` - Enable user segmentation (default: true)

### Performance Configuration
- `REACT_APP_PAGINATION_SIZE` - Default pagination size (default: 50)
- `REACT_APP_CHART_MAX_DATA_POINTS` - Maximum data points per chart (default: 1000)
- `REACT_APP_DEBOUNCE_DELAY` - Debounce delay for filters in ms (default: 300)

### Firebase Configuration (Optional)
- `REACT_APP_FIREBASE_API_KEY` - Firebase API key (for admin features)
- `REACT_APP_FIREBASE_AUTH_DOMAIN` - Firebase authentication domain
- `REACT_APP_FIREBASE_PROJECT_ID` - Firebase project ID
- `REACT_APP_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `REACT_APP_FIREBASE_APP_ID` - Firebase application ID

## Environment Files

### Development (.env)
Used for local development with localhost configurations and development-optimized settings.

### Production (.env.production)
Used for production deployment with production URLs and performance-optimized settings.

### Example (.env.example)
Template file showing all available configuration options with example values.

## Configuration Validation

The application validates environment variables on startup:
- Required variables are checked in production environments
- Missing required variables will prevent application startup
- Optional variables fall back to sensible defaults

## Security Notes

1. Use separate authentication endpoints for analytics team access
2. Implement proper JWT token validation and refresh
3. Ensure all API endpoints use HTTPS in production
4. Use role-based access control for analytics features
5. Regularly audit and rotate authentication credentials

## Performance Considerations

### Development vs Production Settings

| Setting | Development | Production | Reason |
|---------|-------------|------------|---------|
| Refresh Interval | 30s | 60s | Reduce server load |
| Export Max Records | 10,000 | 50,000 | Higher limits for production use |
| Chart Animation | 300ms | 200ms | Faster interactions |
| Pagination Size | 50 | 100 | Better performance with larger datasets |

## Example Configuration

```bash
# Development
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_ANALYTICS_API_BASE_URL=http://localhost:8080/api/analytics
REACT_APP_AUTH_ENDPOINT=http://localhost:8080/api/auth/analytics
REACT_APP_ENVIRONMENT=development

# Production
REACT_APP_API_BASE_URL=https://api.userjourney.com
REACT_APP_ANALYTICS_API_BASE_URL=https://api.userjourney.com/api/analytics
REACT_APP_AUTH_ENDPOINT=https://api.userjourney.com/api/auth/analytics
REACT_APP_ENVIRONMENT=production
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**: Check `REACT_APP_AUTH_ENDPOINT` and ensure the backend is running
2. **Real-time Connection Issues**: Verify `REACT_APP_WEBSOCKET_URL` and `REACT_APP_REALTIME_ENDPOINT`
3. **Export Failures**: Check `REACT_APP_EXPORT_MAX_RECORDS` limits and backend capacity
4. **Performance Issues**: Adjust `REACT_APP_PAGINATION_SIZE` and `REACT_APP_CHART_MAX_DATA_POINTS`