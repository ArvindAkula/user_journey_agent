# Manual Testing Checklist

This document provides a comprehensive checklist for manually testing the authentication, authorization, and environment configuration features.

## Prerequisites

- [ ] Backend is running
- [ ] Frontend applications (User App and Analytics Dashboard) are running
- [ ] LocalStack is running (for dev mode)
- [ ] Firebase Emulator is running (for dev mode)
- [ ] Test user accounts are created in Firebase

## 1. Development Mode Testing

### 1.1 Environment Configuration

- [ ] Start application with `SPRING_PROFILES_ACTIVE=dev`
- [ ] Verify backend logs show "Active Profile: dev"
- [ ] Verify backend logs show "Using LocalStack for AWS services"
- [ ] Verify backend connects to LocalStack at http://localhost:4566
- [ ] Verify backend connects to Firebase Emulator at localhost:9099
- [ ] Verify frontend shows development environment in console logs

### 1.2 LocalStack Connection

- [ ] Verify DynamoDB tables are accessible
- [ ] Verify Kinesis stream is accessible
- [ ] Verify S3 bucket operations work
- [ ] Verify SQS queue operations work
- [ ] Check backend logs for successful AWS client initialization

### 1.3 Firebase Emulator Connection

- [ ] Verify Firebase Auth Emulator is running on port 9099
- [ ] Create test users in Firebase Emulator
- [ ] Verify authentication works with emulator users
- [ ] Check Firebase Emulator UI for authentication events

### 1.4 Mock Data Usage

- [ ] Verify application uses mock data from LocalStack
- [ ] Verify no connections to actual AWS services
- [ ] Verify no connections to production Firebase

## 2. Production Mode Testing

### 2.1 Environment Configuration

- [ ] Start application with `SPRING_PROFILES_ACTIVE=prod`
- [ ] Verify backend logs show "Active Profile: prod"
- [ ] Verify backend logs show "Using actual AWS services"
- [ ] Verify backend connects to actual AWS services
- [ ] Verify backend connects to production Firebase Auth
- [ ] Verify frontend shows production environment

### 2.2 AWS Service Connection

- [ ] Verify DynamoDB connection to production tables
- [ ] Verify Kinesis connection to production stream
- [ ] Verify S3 connection to production bucket
- [ ] Verify SQS connection to production queues
- [ ] Check CloudWatch logs for successful connections

### 2.3 Firebase Connection

- [ ] Verify connection to production Firebase project
- [ ] Verify authentication with production Firebase users
- [ ] Verify Firebase Analytics is tracking events
- [ ] Check Firebase Console for authentication events

### 2.4 Real Data Usage

- [ ] Verify application uses real data from AWS
- [ ] Verify no connections to LocalStack
- [ ] Verify no connections to Firebase Emulator

## 3. Authentication Testing

### 3.1 Login Flow

#### User App
- [ ] Navigate to User App (http://localhost:3000)
- [ ] Verify redirect to login page when not authenticated
- [ ] Enter valid email and password
- [ ] Click "Login" button
- [ ] Verify successful login
- [ ] Verify redirect to home page
- [ ] Verify user email displayed in header
- [ ] Verify JWT token stored in localStorage/cookies

#### Analytics Dashboard
- [ ] Navigate to Analytics Dashboard (http://localhost:3001)
- [ ] Verify redirect to login page when not authenticated
- [ ] Enter valid email and password
- [ ] Click "Login" button
- [ ] Verify successful login
- [ ] Verify redirect to dashboard
- [ ] Verify user email and role displayed in header

### 3.2 Login Error Handling

- [ ] Enter invalid email
- [ ] Verify error message displayed
- [ ] Enter invalid password
- [ ] Verify error message displayed
- [ ] Enter unauthorized user credentials
- [ ] Verify "Not authorized" error message

### 3.3 Logout Flow

- [ ] Click logout button in User App
- [ ] Verify redirect to login page
- [ ] Verify JWT token removed from storage
- [ ] Verify cannot access protected routes
- [ ] Click logout button in Analytics Dashboard
- [ ] Verify same behavior

### 3.4 Session Persistence

- [ ] Login to User App
- [ ] Refresh the page
- [ ] Verify user remains logged in
- [ ] Close and reopen browser
- [ ] Verify user remains logged in (if "Remember Me" enabled)

### 3.5 Token Expiration

- [ ] Login to User App
- [ ] Wait for token to expire (or manually expire token)
- [ ] Attempt to access protected route
- [ ] Verify redirect to login page
- [ ] Verify error message about expired session

## 4. Authorization Testing

### 4.1 Viewer Role

- [ ] Login as viewer user
- [ ] Verify access to User App home page
- [ ] Verify access to calculator page
- [ ] Verify access to video library
- [ ] Verify access to document upload
- [ ] Attempt to access Analytics Dashboard
- [ ] Verify "Unauthorized" error or redirect

### 4.2 Analyst Role

- [ ] Login as analyst user
- [ ] Verify access to User App
- [ ] Verify access to Analytics Dashboard
- [ ] Verify access to analytics reports
- [ ] Verify access to user journey data
- [ ] Attempt to access admin endpoints
- [ ] Verify "Forbidden" error (403)

### 4.3 Admin Role

- [ ] Login as admin user
- [ ] Verify access to User App
- [ ] Verify access to Analytics Dashboard
- [ ] Verify access to all analytics features
- [ ] Verify access to admin panel
- [ ] Verify access to user management
- [ ] Verify access to system settings

### 4.4 Role-Based UI Elements

- [ ] Login as viewer
- [ ] Verify admin menu items are hidden
- [ ] Login as analyst
- [ ] Verify admin menu items are hidden
- [ ] Verify analytics menu items are visible
- [ ] Login as admin
- [ ] Verify all menu items are visible

## 5. Protected Routes Testing

### 5.1 User App Routes

- [ ] Logout from User App
- [ ] Attempt to access /home
- [ ] Verify redirect to /login
- [ ] Attempt to access /calculator
- [ ] Verify redirect to /login
- [ ] Attempt to access /videos
- [ ] Verify redirect to /login
- [ ] Attempt to access /documents
- [ ] Verify redirect to /login

### 5.2 Analytics Dashboard Routes

- [ ] Logout from Analytics Dashboard
- [ ] Attempt to access /dashboard
- [ ] Verify redirect to /login
- [ ] Attempt to access /analytics
- [ ] Verify redirect to /login
- [ ] Attempt to access /admin
- [ ] Verify redirect to /login

### 5.3 Return URL After Login

- [ ] Logout from User App
- [ ] Navigate to /calculator
- [ ] Verify redirect to /login
- [ ] Login with valid credentials
- [ ] Verify redirect back to /calculator

## 6. Firebase Analytics Testing

### 6.1 Debug View (Development)

- [ ] Start User App in development mode
- [ ] Open Firebase Console
- [ ] Navigate to Analytics > DebugView
- [ ] Perform actions in User App
- [ ] Verify events appear in DebugView in real-time
- [ ] Verify event parameters are correct

### 6.2 Event Tracking

#### Page Views
- [ ] Navigate to home page
- [ ] Verify page_view event tracked
- [ ] Navigate to calculator page
- [ ] Verify page_view event tracked
- [ ] Check event parameters (page_title, page_path)

#### Calculator Events
- [ ] Open calculator
- [ ] Enter loan amount, interest rate, term
- [ ] Click calculate
- [ ] Verify calculator_interaction event tracked
- [ ] Check event parameters (loan_amount, interest_rate, etc.)

#### Video Events
- [ ] Open video library
- [ ] Click play on a video
- [ ] Verify video_engagement event with action='play'
- [ ] Pause video
- [ ] Verify video_engagement event with action='pause'
- [ ] Complete video
- [ ] Verify video_engagement event with action='complete'

#### Document Upload Events
- [ ] Navigate to document upload page
- [ ] Select a file
- [ ] Upload file
- [ ] Verify document_upload event tracked
- [ ] Check event parameters (document_type, file_size)

### 6.3 User Properties

- [ ] Login to User App
- [ ] Verify user_id is set in Firebase Analytics
- [ ] Verify user properties are set (role, etc.)
- [ ] Check Firebase Console for user properties

## 7. BigQuery Integration Testing

### 7.1 Data Export Verification

- [ ] Wait 24 hours after enabling BigQuery export
- [ ] Open BigQuery Console
- [ ] Navigate to Firebase Analytics dataset
- [ ] Verify events_YYYYMMDD table exists
- [ ] Query table for recent events
- [ ] Verify event data is present

### 7.2 Historical Data Queries

- [ ] Open Analytics Dashboard
- [ ] Select date range for historical data
- [ ] Verify data is loaded from BigQuery
- [ ] Verify query performance is acceptable
- [ ] Check for any errors in console

### 7.3 Real-time vs Historical Data

- [ ] Verify real-time events use DynamoDB
- [ ] Verify historical queries use BigQuery
- [ ] Compare data consistency between sources
- [ ] Verify no data loss during migration

## 8. CORS Testing

### 8.1 Development CORS

- [ ] Start backend in dev mode
- [ ] Verify User App (localhost:3000) can make API calls
- [ ] Verify Analytics Dashboard (localhost:3001) can make API calls
- [ ] Verify CORS headers in network tab
- [ ] Verify preflight OPTIONS requests succeed

### 8.2 Production CORS

- [ ] Start backend in prod mode
- [ ] Verify production domains can make API calls
- [ ] Verify unauthorized domains are blocked
- [ ] Check CORS headers in production

## 9. Error Handling Testing

### 9.1 Network Errors

- [ ] Stop backend server
- [ ] Attempt to login
- [ ] Verify error message displayed
- [ ] Verify user-friendly error message
- [ ] Start backend server
- [ ] Verify application recovers

### 9.2 Authentication Errors

- [ ] Enter invalid credentials
- [ ] Verify error message
- [ ] Enter expired token
- [ ] Verify redirect to login
- [ ] Attempt to access unauthorized resource
- [ ] Verify 403 error handling

### 9.3 Service Errors

- [ ] Stop LocalStack (in dev mode)
- [ ] Attempt to perform action requiring AWS service
- [ ] Verify error handling
- [ ] Verify user-friendly error message
- [ ] Start LocalStack
- [ ] Verify application recovers

## 10. Performance Testing

### 10.1 Login Performance

- [ ] Measure time from login button click to redirect
- [ ] Verify login completes in < 2 seconds
- [ ] Check network tab for slow requests

### 10.2 Page Load Performance

- [ ] Measure time to first contentful paint
- [ ] Verify page loads in < 3 seconds
- [ ] Check for unnecessary API calls

### 10.3 Analytics Performance

- [ ] Load Analytics Dashboard
- [ ] Measure time to load dashboard data
- [ ] Verify dashboard loads in < 5 seconds
- [ ] Check BigQuery query performance

## 11. Security Testing

### 11.1 Token Security

- [ ] Verify JWT token is not exposed in URL
- [ ] Verify token is stored securely
- [ ] Verify token is sent in Authorization header
- [ ] Verify token is not logged in console (production)

### 11.2 XSS Protection

- [ ] Attempt to inject script in login form
- [ ] Verify script is not executed
- [ ] Attempt to inject script in other forms
- [ ] Verify proper sanitization

### 11.3 CSRF Protection

- [ ] Verify CSRF tokens are used for state-changing operations
- [ ] Attempt CSRF attack
- [ ] Verify attack is blocked

## 12. Browser Compatibility Testing

### 12.1 Chrome
- [ ] Test all features in Chrome
- [ ] Verify no console errors
- [ ] Verify UI renders correctly

### 12.2 Firefox
- [ ] Test all features in Firefox
- [ ] Verify no console errors
- [ ] Verify UI renders correctly

### 12.3 Safari
- [ ] Test all features in Safari
- [ ] Verify no console errors
- [ ] Verify UI renders correctly

### 12.4 Edge
- [ ] Test all features in Edge
- [ ] Verify no console errors
- [ ] Verify UI renders correctly

## 13. Mobile Testing

### 13.1 Responsive Design
- [ ] Test User App on mobile device
- [ ] Verify responsive layout
- [ ] Verify touch interactions work
- [ ] Test Analytics Dashboard on mobile
- [ ] Verify responsive layout

### 13.2 Mobile Authentication
- [ ] Login on mobile device
- [ ] Verify login flow works
- [ ] Verify token persistence
- [ ] Verify logout works

## Test Results Summary

### Development Mode
- Total Tests: ___
- Passed: ___
- Failed: ___
- Notes: ___

### Production Mode
- Total Tests: ___
- Passed: ___
- Failed: ___
- Notes: ___

### Authentication
- Total Tests: ___
- Passed: ___
- Failed: ___
- Notes: ___

### Authorization
- Total Tests: ___
- Passed: ___
- Failed: ___
- Notes: ___

### Firebase Analytics
- Total Tests: ___
- Passed: ___
- Failed: ___
- Notes: ___

### Overall Status
- [ ] All critical tests passed
- [ ] Ready for production deployment
- [ ] Issues identified (list below)

## Issues Identified

1. 
2. 
3. 

## Recommendations

1. 
2. 
3. 

## Sign-off

- Tester Name: _______________
- Date: _______________
- Signature: _______________
