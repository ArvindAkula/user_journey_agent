#!/bin/bash

echo "=========================================="
echo "Starting in PRODUCTION mode"
echo "=========================================="

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "ERROR: AWS credentials not configured!"
    echo "Run: aws configure"
    exit 1
fi

echo "✓ AWS credentials verified"

# Load production environment variables
if [ -f backend/.env.prod.local ]; then
    source backend/.env.prod.local
    echo "✓ Production environment variables loaded"
else
    echo "ERROR: backend/.env.prod.local not found!"
    echo "Create this file with your production configuration"
    exit 1
fi

# Start Backend
echo "Starting Backend (prod mode)..."
cd backend
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run > /tmp/backend-prod.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for Backend to start..."
sleep 30

# Start User App
echo "Starting User App (prod mode)..."
cd packages/user-app
NODE_ENV=production npm start > /tmp/user-app-prod.log 2>&1 &
USER_APP_PID=$!
cd ../..

# Start Analytics Dashboard
echo "Starting Analytics Dashboard (prod mode)..."
cd packages/analytics-dashboard
NODE_ENV=production npm start > /tmp/analytics-dashboard-prod.log 2>&1 &
DASHBOARD_PID=$!
cd ../..

echo ""
echo "=========================================="
echo "All services started in PROD mode!"
echo "=========================================="
echo "User App:              http://localhost:3000"
echo "Analytics Dashboard:   http://localhost:3001"
echo "Backend API:           http://localhost:8080"
echo ""
echo "Logs:"
echo "  Backend:    tail -f /tmp/backend-prod.log"
echo "  User App:   tail -f /tmp/user-app-prod.log"
echo "  Dashboard:  tail -f /tmp/analytics-dashboard-prod.log"
echo ""
echo "⚠️  WARNING: Running in PRODUCTION mode"
echo "   - Using real AWS services"
echo "   - Using production Firebase"
echo "   - Costs may apply"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Wait for Ctrl+C
trap "echo 'Stopping all services...'; kill $BACKEND_PID $USER_APP_PID $DASHBOARD_PID 2>/dev/null; exit" INT
wait
