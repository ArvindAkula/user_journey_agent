# User Guide: Logging In and Using the Application

## Table of Contents

1. [Getting Started](#getting-started)
2. [Logging In](#logging-in)
3. [Navigating the Application](#navigating-the-application)
4. [User App Features](#user-app-features)
5. [Analytics Dashboard Features](#analytics-dashboard-features)
6. [Troubleshooting](#troubleshooting)
7. [Getting Help](#getting-help)

## Getting Started

The User Journey Analytics application consists of two main interfaces:

1. **User App** (https://www.journey-analytics.io)
   - For end users to interact with the application
   - Access to calculator, video library, and document upload
   - Available to all authenticated users

2. **Analytics Dashboard** (https://www.journey-analytics-admin.io)
   - For analysts and administrators to view analytics
   - Access to reports, metrics, and user journey data
   - Requires ANALYST or ADMIN role

## Logging In

### First-Time Login

1. **Navigate to the Application**:
   - User App: https://www.journey-analytics.io
   - Analytics Dashboard: https://www.journey-analytics-admin.io

2. **You'll be redirected to the login page** if not already authenticated

3. **Enter Your Credentials**:
   - Email address (provided by your administrator)
   - Password (provided by your administrator)

4. **Click "Login"**

5. **You'll be redirected** to the main application after successful authentication

### Subsequent Logins

- Your session will remain active for 24 hours
- You won't need to log in again during this period
- After 24 hours, you'll be prompted to log in again

### Forgot Password

If you've forgotten your password:

1. Contact your system administrator
2. They will reset your password in the Firebase Console
3. You'll receive a password reset email
4. Follow the link in the email to set a new password

## Navigating the Application

### User App Navigation

After logging in to the User App, you'll see:

**Header**:
- Application logo (top left)
- Navigation menu (top center)
- User menu (top right) showing your email and role

**Main Navigation**:
- **Home**: Dashboard with quick links
- **Calculator**: Mortgage/loan calculator
- **Video Library**: Educational videos
- **Documents**: Upload and manage documents
- **Profile**: View and edit your profile

**User Menu** (top right):
- Your email address
- Your role (ADMIN, ANALYST, or VIEWER)
- **Logout** button

### Analytics Dashboard Navigation

After logging in to the Analytics Dashboard, you'll see:

**Sidebar** (left):
- **Dashboard**: Overview metrics
- **Events**: Real-time event stream
- **User Journeys**: User behavior analysis
- **Reports**: Historical reports
- **Admin** (ADMIN only): User management

**Header**:
- Dashboard title
- Date range selector
- Refresh button
- User menu (top right)

## User App Features

### Calculator

The calculator helps you estimate loan payments:

1. **Navigate to Calculator** from the main menu

2. **Enter Loan Details**:
   - Loan amount (e.g., $300,000)
   - Interest rate (e.g., 4.5%)
   - Loan term in years (e.g., 30)

3. **Click "Calculate"**

4. **View Results**:
   - Monthly payment amount
   - Total interest paid
   - Total amount paid
   - Amortization schedule

5. **Your calculation is automatically tracked** for analytics purposes

### Video Library

Access educational videos:

1. **Navigate to Video Library** from the main menu

2. **Browse Available Videos**:
   - Videos are organized by category
   - Click on a video thumbnail to watch

3. **Video Player Controls**:
   - Play/Pause
   - Volume control
   - Fullscreen mode
   - Progress bar

4. **Your viewing activity is tracked**:
   - Videos watched
   - Watch duration
   - Completion rate

### Document Upload

Upload and manage documents:

1. **Navigate to Documents** from the main menu

2. **Upload a Document**:
   - Click "Upload Document" button
   - Select file from your computer
   - Add a title and description (optional)
   - Click "Upload"

3. **View Your Documents**:
   - See list of uploaded documents
   - Click to download
   - Delete documents you no longer need

4. **Document Types Supported**:
   - PDF files
   - Word documents (.doc, .docx)
   - Excel spreadsheets (.xls, .xlsx)
   - Images (.jpg, .png)

### Profile

View and update your profile:

1. **Navigate to Profile** from the main menu

2. **View Your Information**:
   - Email address
   - Display name
   - Role
   - Account creation date
   - Last login date

3. **Update Profile** (if enabled):
   - Change display name
   - Update preferences
   - Click "Save Changes"

## Analytics Dashboard Features

### Dashboard Overview

The main dashboard shows:

**Key Metrics**:
- Total users
- Active sessions
- Events today
- Conversion rate

**Charts**:
- User activity over time
- Popular features
- User journey funnel
- Geographic distribution

**Recent Activity**:
- Latest user events
- Recent calculations
- Video views
- Document uploads

### Events View

See real-time user events:

1. **Navigate to Events** from the sidebar

2. **Event Stream**:
   - Live feed of user actions
   - Event type (page view, click, calculation, etc.)
   - User ID
   - Timestamp
   - Event details

3. **Filter Events**:
   - By event type
   - By user
   - By date range
   - By custom parameters

4. **Export Events**:
   - Click "Export" button
   - Choose format (CSV, JSON)
   - Select date range
   - Download file

### User Journeys

Analyze user behavior patterns:

1. **Navigate to User Journeys** from the sidebar

2. **Journey Visualization**:
   - See common paths users take
   - Identify drop-off points
   - View conversion funnels

3. **Individual User Journeys**:
   - Search for specific user
   - View their complete journey
   - See all events in chronological order

4. **Journey Metrics**:
   - Average session duration
   - Pages per session
   - Bounce rate
   - Conversion rate

### Reports

Access historical reports:

1. **Navigate to Reports** from the sidebar

2. **Available Reports**:
   - **User Activity Report**: Daily/weekly/monthly activity
   - **Feature Usage Report**: Most used features
   - **Calculator Report**: Calculation patterns and trends
   - **Video Engagement Report**: Video viewing statistics
   - **Document Upload Report**: Upload trends

3. **Generate Report**:
   - Select report type
   - Choose date range
   - Apply filters (optional)
   - Click "Generate"

4. **Export Report**:
   - Click "Export" button
   - Choose format (PDF, CSV, Excel)
   - Download file

### Admin Panel (ADMIN Role Only)

Manage users and system settings:

1. **Navigate to Admin** from the sidebar

2. **User Management**:
   - View all users
   - See user roles
   - View last login dates
   - See user activity levels

3. **System Settings**:
   - Configure feature flags
   - Update system parameters
   - View system health

4. **Audit Logs**:
   - View admin actions
   - See configuration changes
   - Track user management activities

## Troubleshooting

### Cannot Log In

**Problem**: Login fails with "Invalid email or password"

**Solutions**:
1. Verify you're using the correct email address
2. Check your password (passwords are case-sensitive)
3. Ensure you're on the correct domain:
   - User App: www.journey-analytics.io
   - Analytics Dashboard: www.journey-analytics-admin.io
4. Contact your administrator if you've forgotten your password

**Problem**: Login fails with "You are not authorized"

**Solutions**:
1. Verify your email is in the authorized users list
2. Contact your administrator to add you to the system
3. Ensure you're logging into the correct application

### Session Expired

**Problem**: "Your session has expired" message appears

**Solutions**:
1. Click "OK" to return to login page
2. Log in again with your credentials
3. Your session will be active for another 24 hours

### Cannot Access Features

**Problem**: Some features are not visible or accessible

**Solutions**:
1. Check your user role:
   - VIEWER: Read-only access
   - ANALYST: Analytics dashboard access
   - ADMIN: Full access
2. Contact your administrator if you need different permissions
3. Ensure you're logged into the correct application

### Page Not Loading

**Problem**: Application pages are slow or not loading

**Solutions**:
1. Check your internet connection
2. Refresh the page (Ctrl+R or Cmd+R)
3. Clear your browser cache:
   - Chrome: Settings > Privacy > Clear browsing data
   - Firefox: Settings > Privacy > Clear Data
   - Safari: Safari > Clear History
4. Try a different browser
5. Contact support if the issue persists

### Data Not Appearing

**Problem**: Analytics data is not showing up

**Solutions**:
1. Check the date range selector
2. Verify you have the correct permissions
3. Wait a few minutes for data to sync
4. Refresh the page
5. Contact support if data is still missing

## Getting Help

### In-App Help

- Look for the **Help** icon (?) in the top right corner
- Click for context-sensitive help
- Access user documentation
- View video tutorials

### Contact Support

**Email**: support@journey-analytics.io

**Include in your support request**:
- Your email address
- Description of the issue
- Steps to reproduce the problem
- Screenshots (if applicable)
- Browser and operating system

**Response Time**:
- Critical issues: Within 2 hours
- High priority: Within 4 hours
- Normal priority: Within 24 hours

### Self-Service Resources

- **Documentation**: https://docs.journey-analytics.io
- **FAQ**: https://docs.journey-analytics.io/faq
- **Video Tutorials**: https://docs.journey-analytics.io/tutorials
- **Release Notes**: https://docs.journey-analytics.io/releases

### Training

Contact your administrator about:
- New user training sessions
- Advanced feature training
- Custom training for your team

## Best Practices

### Security

1. **Never share your password** with anyone
2. **Log out** when finished, especially on shared computers
3. **Use a strong password**:
   - At least 12 characters
   - Mix of uppercase, lowercase, numbers, and symbols
   - Don't use common words or personal information
4. **Report suspicious activity** to your administrator

### Data Privacy

1. **Don't upload sensitive personal information** without authorization
2. **Follow your organization's data policies**
3. **Be aware that your activity is tracked** for analytics purposes
4. **Contact your administrator** with privacy concerns

### Performance

1. **Close unused tabs** to improve performance
2. **Use the latest browser version** for best experience
3. **Clear browser cache** periodically
4. **Use a stable internet connection** for real-time features

## Keyboard Shortcuts

### Global Shortcuts

- `Ctrl/Cmd + K`: Open search
- `Ctrl/Cmd + /`: Show keyboard shortcuts
- `Esc`: Close modal dialogs
- `Ctrl/Cmd + R`: Refresh page

### Navigation Shortcuts

- `Alt + H`: Go to home
- `Alt + C`: Go to calculator
- `Alt + V`: Go to video library
- `Alt + D`: Go to documents
- `Alt + P`: Go to profile

### Analytics Dashboard Shortcuts

- `Alt + 1`: Dashboard
- `Alt + 2`: Events
- `Alt + 3`: User Journeys
- `Alt + 4`: Reports
- `Alt + 5`: Admin (if available)

## Accessibility

The application is designed to be accessible:

- **Screen reader compatible**
- **Keyboard navigation** supported
- **High contrast mode** available
- **Adjustable text size**
- **ARIA labels** for all interactive elements

To enable accessibility features:
1. Go to Profile > Settings
2. Click "Accessibility"
3. Enable desired features

## Feedback

We value your feedback!

**Submit Feedback**:
1. Click the **Feedback** button (bottom right)
2. Choose feedback type:
   - Bug report
   - Feature request
   - General feedback
3. Describe your feedback
4. Click "Submit"

**Your feedback helps us improve** the application for everyone.

## Version Information

- **Current Version**: 2.0.0
- **Last Updated**: January 2025
- **Next Update**: Check release notes for upcoming features

---

**Thank you for using User Journey Analytics!**

For additional help, contact your administrator or support team.
