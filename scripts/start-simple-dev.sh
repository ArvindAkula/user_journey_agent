#!/bin/bash

# Simple Local Development Setup (No Docker Required)
echo "🚀 Starting Simple User Journey Analytics Development Environment"
echo "================================================================"

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    else
        return 0
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=15
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url > /dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts - waiting for $service_name..."
        sleep 3
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Check required ports
echo "🔍 Checking required ports..."
ports_to_check=(3000 8080)
for port in "${ports_to_check[@]}"; do
    if ! check_port $port; then
        echo "Please stop the service using port $port and try again"
        exit 1
    fi
done
echo "✅ Required ports are available"

# Create logs directory
mkdir -p logs

# Start backend in background
echo ""
echo "🔧 Starting Node.js backend (Simple Mode)..."
node simple-backend.js > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
if ! wait_for_service "http://localhost:8080/actuator/health" "Spring Boot Backend"; then
    echo "❌ Failed to start backend"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Install frontend dependencies if needed
echo ""
echo "📦 Checking frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
cd ..

# Start frontend in background
echo ""
echo "⚛️  Starting React frontend..."
cd frontend
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
if ! wait_for_service "http://localhost:3000" "React Frontend"; then
    echo "❌ Failed to start frontend"
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 Simple development environment is running!"
echo "============================================="
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔄 Data Flow Demo: http://localhost:3000/data-flow"
echo "🔧 Backend API: http://localhost:8080"
echo "📊 Backend Health: http://localhost:8080/actuator/health"
echo ""
echo "📋 Process IDs:"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Backend: tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "   ./scripts/stop-simple-dev.sh"
echo ""
echo "🔄 Testing the Data Flow:"
echo "   1. Open http://localhost:3000/data-flow"
echo "   2. Click the event generation buttons"
echo "   3. Watch the event logs in the demo page"
echo "   4. Check backend logs: tail -f logs/backend.log"
echo "   5. Events will be logged (mock mode - no AWS required)"

# Save PIDs for cleanup script
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

echo ""
echo "💡 Note: Running in mock mode (no AWS services required)"
echo "   Events are logged but not stored in real AWS services"
echo "   To use real AWS services, start Docker and run ./scripts/start-local-dev.sh"