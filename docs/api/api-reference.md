# API Reference

## Overview

The User Journey Analytics Agent provides REST APIs for event collection, analytics queries, and system management.

## Base URL
```
https://api.user-journey-analytics.com/v1
```

## Authentication
All API requests require authentication via API key or JWT token.

```http
Authorization: Bearer <token>
```

## Event Collection API

### Submit User Event
```http
POST /events
Content-Type: application/json

{
  "userId": "user123",
  "sessionId": "session456", 
  "eventType": "click",
  "timestamp": 1697123456789,
  "properties": {
    "elementId": "submit-button",
    "page": "/checkout"
  }
}
```

### Submit Video Event
```http
POST /events/video
Content-Type: application/json

{
  "userId": "user123",
  "videoId": "video789",
  "eventType": "play",
  "timestamp": 1697123456789,
  "position": 120,
  "duration": 300
}
```

## Analytics API

### Get User Profile
```http
GET /users/{userId}/profile
```

Response:
```json
{
  "userId": "user123",
  "segment": "power_user",
  "lastActiveAt": 1697123456789,
  "totalSessions": 45,
  "averageSessionDuration": 180
}
```

### Get Struggle Signals
```http
GET /users/{userId}/struggles
```

Response:
```json
{
  "struggles": [
    {
      "featureId": "checkout",
      "severity": "high",
      "attemptCount": 3,
      "detectedAt": 1697123456789
    }
  ]
}
```

### Get Video Analytics
```http
GET /videos/{videoId}/analytics
```

Response:
```json
{
  "videoId": "video789",
  "totalViews": 1250,
  "averageWatchTime": 180,
  "completionRate": 0.65,
  "engagementScore": 8.5
}
```

## Bedrock Agent API

### Analyze User Journey
```http
POST /ai/analyze-journey
Content-Type: application/json

{
  "userId": "user123",
  "timeRange": "7d"
}
```

### Get Intervention Recommendations
```http
POST /ai/recommend-interventions
Content-Type: application/json

{
  "userId": "user123",
  "struggleType": "checkout"
}
```

## System Management API

### Health Check
```http
GET /health
```

### Metrics
```http
GET /metrics
```

## Error Responses

All APIs return standard HTTP status codes:

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

Error response format:
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: userId"
  }
}
```

## Rate Limiting

- 1000 requests per minute per API key
- 10,000 events per minute per user
- Burst capacity: 2x normal limits for 5 minutes