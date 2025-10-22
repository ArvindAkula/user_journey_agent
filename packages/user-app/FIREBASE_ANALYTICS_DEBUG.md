# Firebase Analytics Debug View Guide

## Overview

Firebase Analytics Debug View allows you to see events in real-time as they are logged from your application during development. This is essential for testing and validating your analytics implementation before deploying to production.

## Enabling Debug Mode

### Automatic Debug Mode (Development Environment)

Debug mode is automatically enabled when running the application in development mode:

```bash
# Start the app in development mode
npm start

# Or explicitly set the environment
REACT_APP_ENVIRONMENT=development npm start
```

When debug mode is active, you'll see console logs prefixed with `🔥` for all Firebase Analytics events:

```
🔥 Firebase Analytics initialized in DEBUG mode
🔥 Firebase Analytics: Page view Home Page { page_name: 'home' }
🔥 Firebase Analytics: Calculator interaction calculate { loanAmount: 300000, ... }
```

### Manual Debug Mode (Browser Extension)

For more detailed debugging, you can enable Firebase Analytics Debug Mode using browser extensions:

#### Chrome Extension Method

1. Install the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) extension
2. Click the extension icon to enable it (icon turns green)
3. Open Chrome DevTools (F12)
4. Navigate to the Console tab
5. You'll see detailed Firebase Analytics logs

#### URL Parameter Method

Add `?debug_mode=true` to your application URL:

```
http://localhost:3000?debug_mode=true
```

## Viewing Events in Firebase Console

### Access Debug View

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Analytics** → **DebugView**
4. You should see your device/browser listed with real-time events

### Understanding the Debug View Interface

The Debug View shows:

- **Device Stream**: Real-time events from your development device
- **Event Timeline**: Chronological list of events
- **Event Details**: Parameters and user properties for each event
- **User Properties**: Current user properties set for the session

## Testing Event Tracking

### Page View Events

Navigate through the application and verify page views are tracked:

```typescript
// Automatically tracked on each page
firebaseAnalyticsService.trackPageView('Home Page', { page_name: 'home' });
```

Expected events in Debug View:
- `page_view` with parameters: `page_title`, `page_location`, `page_path`

### Calculator Events

Use the calculator and verify interactions:

```typescript
firebaseAnalyticsService.trackCalculatorEvent('calculate', {
  loanAmount: 300000,
  interestRate: 3.5,
  termYears: 30,
  monthlyPayment: 1347.13
});
```

Expected events in Debug View:
- `calculator_interaction` with parameters: `action`, `loan_amount`, `interest_rate`, `term_years`, `monthly_payment`

### Video Engagement Events

Play, pause, and complete videos:

```typescript
firebaseAnalyticsService.trackVideoEvent('play', 'video-id', {
  duration: 420,
  position: 0,
  videoTitle: 'Financial Planning Basics'
});
```

Expected events in Debug View:
- `video_engagement` with parameters: `action`, `video_id`, `video_title`, `video_duration`, `video_position`, `completion_rate`

### Document Upload Events

Upload documents and verify tracking:

```typescript
firebaseAnalyticsService.trackDocumentUpload('financial-documents', {
  fileSize: 1024000,
  fileName: 'tax-return.pdf',
  success: true
});
```

Expected events in Debug View:
- `document_upload` with parameters: `document_type`, `file_size`, `file_name`, `success`

## Common Event Types

### Standard Events

| Event Name | Description | Key Parameters |
|------------|-------------|----------------|
| `page_view` | User views a page | `page_title`, `page_path`, `page_location` |
| `calculator_interaction` | User interacts with calculator | `action`, `loan_amount`, `interest_rate`, `term_years` |
| `video_engagement` | User engages with video | `action`, `video_id`, `video_duration`, `completion_rate` |
| `document_upload` | User uploads a document | `document_type`, `file_size`, `success` |
| `feature_interaction` | User interacts with a feature | `feature_name`, `interaction_action`, `success` |
| `navigation` | User navigates between pages | `from_page`, `to_page` |
| `struggle_signal` | User shows signs of struggle | `feature_name`, `attempt_count`, `severity` |
| `search` | User performs a search | `search_term`, `results_count` |
| `error` | An error occurs | `error_type`, `error_message` |

### Custom Events

You can track custom events using:

```typescript
firebaseAnalyticsService.trackCustomEvent('custom_event_name', {
  custom_param_1: 'value1',
  custom_param_2: 123
});
```

## User Properties

Set user properties to segment your analytics:

```typescript
firebaseAnalyticsService.setUserProperties({
  user_type: 'premium',
  signup_date: '2024-01-15',
  preferred_language: 'en'
});
```

View user properties in Debug View under the "User Properties" section.

## Troubleshooting

### Events Not Appearing in Debug View

1. **Check Debug Mode is Enabled**
   - Look for console logs with `🔥` prefix
   - Verify `NODE_ENV=development` or `REACT_APP_ENVIRONMENT=development`

2. **Verify Firebase Configuration**
   - Check `.env.development` file has correct Firebase credentials
   - Ensure `REACT_APP_FIREBASE_MEASUREMENT_ID` is set

3. **Check Browser Console**
   - Look for Firebase Analytics initialization messages
   - Check for any error messages

4. **Verify Network Connection**
   - Firebase Analytics requires internet connection
   - Check browser DevTools Network tab for Firebase requests

### Events Delayed or Missing

- Firebase Analytics batches events for efficiency
- In debug mode, events should appear within seconds
- If events are delayed, check your internet connection
- Clear browser cache and reload the application

### Debug View Not Showing Device

1. **Enable Debug Mode Properly**
   - Use URL parameter: `?debug_mode=true`
   - Or install Google Analytics Debugger extension

2. **Check Firebase Project**
   - Ensure you're viewing the correct Firebase project
   - Verify the project ID matches your configuration

3. **Wait a Few Seconds**
   - It may take 10-30 seconds for your device to appear
   - Trigger an event (navigate to a page) to register the device

## Best Practices

### During Development

1. **Always Use Debug Mode**
   - Verify events before deploying to production
   - Test all user flows and interactions

2. **Check Event Parameters**
   - Ensure all required parameters are included
   - Verify parameter names follow Firebase conventions (lowercase with underscores)

3. **Test User Properties**
   - Set and verify user properties
   - Check that properties persist across sessions

4. **Monitor Console Logs**
   - Watch for Firebase Analytics logs
   - Look for any warnings or errors

### Before Production Deployment

1. **Verify All Events**
   - Test each feature and verify events are tracked
   - Check that event parameters are correct

2. **Test Error Scenarios**
   - Verify error events are tracked properly
   - Check struggle signal detection

3. **Review Event Names**
   - Ensure event names are descriptive and consistent
   - Follow Firebase naming conventions

4. **Document Custom Events**
   - Keep a list of all custom events and their parameters
   - Share with your team for consistency

## Firebase Analytics Limits

Be aware of Firebase Analytics limits:

- **Event Name**: Max 40 characters
- **Parameter Name**: Max 40 characters
- **Parameter Value**: Max 100 characters (strings)
- **User Property Name**: Max 24 characters
- **User Property Value**: Max 36 characters
- **Events per Session**: Unlimited (but batched)
- **Distinct Event Names**: 500 per project

## Production vs Development

### Development Mode
- Events appear in Debug View immediately
- Console logs show all events
- No data sampling
- Events may not appear in standard Analytics reports

### Production Mode
- Events appear in Analytics reports (24-48 hour delay)
- No console logs (unless explicitly enabled)
- Data may be sampled for large volumes
- Events contribute to your analytics data

## Additional Resources

- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [Debug View Documentation](https://firebase.google.com/docs/analytics/debugview)
- [Event Reference](https://firebase.google.com/docs/reference/js/analytics)
- [Best Practices](https://firebase.google.com/docs/analytics/best-practices)

## Support

If you encounter issues with Firebase Analytics:

1. Check the [Firebase Status Dashboard](https://status.firebase.google.com/)
2. Review the [Firebase Analytics FAQ](https://firebase.google.com/support/faq#analytics)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase-analytics) for similar issues
4. Contact your development team for project-specific help
