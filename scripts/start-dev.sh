#!/bin/bash

echo "=========================================="
echo "Starting in DEVELOPMENT mode"
echo "=========================================="

# Check if LocalStack is running
if ! docker ps | grep -q localstack; then
    echo "Starting LocalStack..."
    docker run -d --name localstack -p 4566:4566 -e SERVICES=dynamodb,kinesis,s3,sqs localstack/localstack
    sleep 5
fi

# Start Firebase Emulator in background
echo "Starting Firebase Emulator..."
cd backend
firebase emulators:start --only auth > /tmp/firebase-emulator.log 2>&1 &
FIREBASE_PID=$!
cd ..

# Wait for emulator to be ready
echo "Waiting for Firebase Emulator to start..."
sleep 10

# Start Backend
echo "Starting Backend (dev mode)..."
cd backend
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run > /tmp/backend-dev.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for Backend to start..."
sleep 30

# Start User App
echo "Starting User App (dev mode)..."
cd packages/user-app
NODE_ENV=development npm start > /tmp/user-app-dev.log 2>&1 &
USER_APP_PID=$!
cd ../..

# Start Analytics Dashboard
echo "Starting Analytics Dashboard (dev mode)..."
cd packages/analytics-dashboard
NODE_ENV=development npm start > /tmp/analytics-dashboard-dev.log 2>&1 &
DASHBOARD_PID=$!
cd ../..

echo ""
echo "=========================================="
echo "All services started in DEV mode!"
echo "=========================================="
echo "User App:              http://localhost:3000"
echo "Analytics Dashboard:   http://localhost:3001"
echo "Backend API:           http://localhost:8080"
echo "Firebase Emulator UI:  http://localhost:4000"
echo "LocalStack:            http://localhost:4566"
echo ""
echo "Logs:"
echo "  Backend:    tail -f /tmp/backend-dev.log"
echo "  User App:   tail -f /tmp/user-app-dev.log"
echo "  Dashboard:  tail -f /tmp/analytics-dashboard-dev.log"
echo "  Firebase:   tail -f /tmp/firebase-emulator.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Wait for Ctrl+C
trap "echo 'Stopping all services...'; kill $FIREBASE_PID $BACKEND_PID $USER_APP_PID $DASHBOARD_PID 2>/dev/null; exit" INT
wait
