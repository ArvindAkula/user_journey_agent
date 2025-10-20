# Debug Event Tracking

## Overview
To reduce noise in DynamoDB and make debugging easier, you can filter which events are sent to AWS.

## Configuration

Edit `packages/user-app/.env` and set `REACT_APP_DEBUG_EVENT_FILTER`:

### Track Only Pricing Events (Current Setting)
```bash
REACT_APP_DEBUG_EVENT_FILTER=pricing_page_view
```

### Track Multiple Event Types
```bash
REACT_APP_DEBUG_EVENT_FILTER=pricing_page_view,page_view,feature_interaction
```

### Track All Events (Production Mode)
```bash
REACT_APP_DEBUG_EVENT_FILTER=
# or comment it out:
# REACT_APP_DEBUG_EVENT_FILTER=pricing_page_view
```

## Available Event Types

- `pricing_page_view` - Pricing/calculator page interactions
- `page_view` - General page views
- `feature_interaction` - Feature usage (buttons, forms, etc.)
- `video_engagement` - Video play/pause/complete
- `struggle_signal` - User difficulty indicators
- `checkout_abandon` - Checkout abandonment
- `form_error` - Form validation errors
- `error_event` - Application errors

## How It Works

1. Events not in the filter are **skipped before queuing** (never sent to backend)
2. You'll see console logs: `🔇 [DEBUG] Skipping event type: page_view (not in filter: pricing_page_view)`
3. Only filtered events reach DynamoDB tables:
   - `user-journey-analytics-user-events`
   - `user-journey-analytics-audit-logs`

## Restart Required

After changing `.env`, restart your frontend dev server:

```bash
cd packages/user-app
npm start
```

## Current Behavior

With `REACT_APP_DEBUG_EVENT_FILTER=pricing_page_view`:
- ✅ Calculator page views → **SENT to DynamoDB**
- ✅ Calculator calculations → **SENT to DynamoDB**
- ❌ Video engagement → **SKIPPED**
- ❌ General page views → **SKIPPED**
- ❌ Feature interactions → **SKIPPED**

This keeps your DynamoDB tables clean with only 1-2 event types for easy debugging!
