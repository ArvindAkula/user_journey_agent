#!/bin/bash

# Start Local Development Environment for User Journey Analytics
echo "🚀 Starting User Journey Analytics Local Development Environment"
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
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url > /dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts - waiting for $service_name..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Check required ports
echo "🔍 Checking required ports..."
ports_to_check=(3000 8080 4566 6379 8001)
for port in "${ports_to_check[@]}"; do
    if ! check_port $port; then
        echo "Please stop the service using port $port and try again"
        exit 1
    fi
done
echo "✅ All required ports are available"

# Start Docker services
echo ""
echo "🐳 Starting Docker services (LocalStack, Redis, DynamoDB Admin)..."
docker-compose -f docker-compose.local.yml up -d

# Wait for LocalStack to be ready
if ! wait_for_service "http://localhost:4566/_localstack/health" "LocalStack"; then
    echo "❌ Failed to start LocalStack"
    exit 1
fi

# Setup AWS services
echo ""
echo "⚙️  Setting up AWS services..."
./scripts/setup-local-aws.sh

# Start backend in background
echo ""
echo "🔧 Starting Spring Boot backend..."
cd backend
export SPRING_PROFILES_ACTIVE=dev
mvn spring-boot:run > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
if ! wait_for_service "http://localhost:8080/actuator/health" "Spring Boot Backend"; then
    echo "❌ Failed to start backend"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

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
echo "🎉 All services are running!"
echo "================================"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8080"
echo "📊 DynamoDB Admin: http://localhost:8001"
echo "🐳 LocalStack: http://localhost:4566"
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
echo "   ./scripts/stop-local-dev.sh"
echo ""
echo "🔄 Data Flow Test:"
echo "   1. Open http://localhost:3000"
echo "   2. Register/login as a user"
echo "   3. Interact with videos and features"
echo "   4. Check DynamoDB Admin at http://localhost:8001 to see events"
echo "   5. View real-time analytics on the dashboard"

# Save PIDs for cleanup script
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid