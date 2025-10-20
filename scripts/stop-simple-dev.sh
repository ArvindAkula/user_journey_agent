#!/bin/bash

# Stop Simple Development Environment
echo "🛑 Stopping Simple User Journey Analytics Development Environment"
echo "================================================================"

# Stop frontend
if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    echo "🔴 Stopping React frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null
    rm .frontend.pid
    echo "✅ Frontend stopped"
else
    echo "⚠️  No frontend PID file found"
fi

# Stop backend
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    echo "🔴 Stopping Spring Boot backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null
    rm .backend.pid
    echo "✅ Backend stopped"
else
    echo "⚠️  No backend PID file found"
fi

echo ""
echo "✅ All services stopped!"
echo ""
echo "📝 Logs are still available:"
echo "   Backend: logs/backend.log"
echo "   Frontend: logs/frontend.log"