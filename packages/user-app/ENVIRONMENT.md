# User Application Environment Configuration

This document describes all environment variables used by the User Application.

## Required Environment Variables

### Server Configuration
- `PORT` - Port number for the development server (default: 3000)
- `REACT_APP_API_BASE_URL` - Base URL for the backend API
- `REACT_APP_WEBSOCKET_URL` - WebSocket URL for real-time connections

### Application Configuration
- `REACT_APP_ENVIRONMENT` - Application environment (development, staging, production)
- `REACT_APP_APP_NAME` - Application name for display purposes
- `REACT_APP_VERSION` - Application version
- `REACT_APP_APP_TYPE` - Application type identifier (should be "user")

## Firebase Configuration (Required for Authentication)
- `REACT_APP_FIREBASE_API_KEY` - Firebase API key
- `REACT_APP_FIREBASE_AUTH_DOMAIN` - Firebase authentication domain
- `REACT_APP_FIREBASE_PROJECT_ID` - Firebase project ID
- `REACT_APP_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `REACT_APP_FIREBASE_APP_ID` - Firebase application ID

## Optional Configuration

### Event Tracking Configuration
- `REACT_APP_EVENT_BATCH_SIZE` - Number of events to batch before sending (default: 10)
- `REACT_APP_EVENT_FLUSH_INTERVAL` - Interval in ms to flush events (default: 5000)
- `REACT_APP_OFFLINE_QUEUE_SIZE` - Maximum offline queue size (default: 100)
- `REACT_APP_ANALYTICS_ENABLED` - Enable/disable analytics tracking (default: true)

### Debug Configuration
- `REACT_APP_DEBUG_MODE` - Enable debug mode for additional logging (default: false)

### Feature Flags
- `REACT_APP_ENABLE_VIDEO_LIBRARY` - Enable video library feature (default: true)
- `REACT_APP_ENABLE_CALCULATOR` - Enable interactive calculator (default: true)
- `REACT_APP_ENABLE_DOCUMENT_UPLOAD` - Enable document upload feature (default: true)
- `REACT_APP_ENABLE_PERSONA_SWITCHER` - Enable persona switching (default: true)

## Environment Files

### Development (.env)
Used for local development with default localhost configurations.

### Production (.env.production)
Used for production deployment with production URLs and optimized settings.

### Example (.env.example)
Template file showing all available configuration options.

## Configuration Validation

The application validates required environment variables on startup:
- In development: Warnings are logged for missing optional variables
- In production: Errors are thrown for missing required variables

## Security Notes

1. Never commit actual Firebase credentials to version control
2. Use different Firebase projects for different environments
3. Ensure API URLs use HTTPS in production
4. Regularly rotate Firebase API keys and other credentials

## Example Configuration

```bash
# Development
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_WEBSOCKET_URL=ws://localhost:8080/ws
REACT_APP_ENVIRONMENT=development

# Production
REACT_APP_API_BASE_URL=https://api.userjourney.com
REACT_APP_WEBSOCKET_URL=wss://api.userjourney.com/ws
REACT_APP_ENVIRONMENT=production
```