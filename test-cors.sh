#!/bin/bash

echo "🔍 Testing CORS configuration..."
echo ""

# Test OPTIONS preflight request
echo "1️⃣  Testing OPTIONS preflight for /api/analytics/realtime/metrics"
echo "   (This is what the browser sends before the actual request)"
echo ""
curl -X OPTIONS http://localhost:8080/api/analytics/realtime/metrics \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i 2>&1 | grep -E "(HTTP|Access-Control|Vary)"

echo ""
echo "2️⃣  Testing GET request with Origin header"
echo "   (This is the actual data request)"
echo ""
curl -X GET http://localhost:8080/api/analytics/realtime/metrics \
  -H "Origin: http://localhost:3001" \
  -H "Content-Type: application/json" \
  -i 2>&1 | grep -E "(HTTP|Access-Control|Content-Type)"

echo ""
echo "3️⃣  Testing actual endpoint response data"
echo ""
curl -s http://localhost:8080/api/analytics/realtime/metrics | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8080/api/analytics/realtime/metrics

echo ""
echo ""
echo "✅ CORS is working if you see:"
echo "   - Access-Control-Allow-Origin: http://localhost:3001"
echo "   - Access-Control-Allow-Credentials: true"
echo "   - HTTP/1.1 200 (not 403 or 401)"
echo ""
echo "❌ CORS is NOT working if you see:"
echo "   - No Access-Control headers"
echo "   - HTTP/1.1 403 Forbidden"
echo ""
