#!/bin/bash

echo "🧹 Cleaning and restarting dashboard..."
echo ""

# Kill any running dashboard processes
echo "1. Killing any processes on port 3001..."
lsof -ti :3001 | xargs kill -9 2>/dev/null || echo "   No process on 3001"

# Clean all caches
echo "2. Cleaning caches..."
rm -rf packages/analytics-dashboard/.cache
rm -rf packages/analytics-dashboard/build
rm -rf packages/analytics-dashboard/node_modules/.cache
rm -rf packages/analytics-dashboard/node_modules/.vite

echo "3. Cleaning browser localStorage..."
echo "   (You'll need to do this manually in browser)"

echo ""
echo "✅ Cleaned!"
echo ""
echo "Now run:"
echo "  cd packages/analytics-dashboard && npm start"
echo ""
echo "Then in browser:"
echo "  1. Open http://localhost:3001 in INCOGNITO/PRIVATE window"
echo "  2. Or clear localStorage: localStorage.clear(); location.reload();"
echo ""
