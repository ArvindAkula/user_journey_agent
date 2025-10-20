#!/bin/bash

echo "🔨 Rebuilding Backend with CORS Fix..."
echo ""

cd backend
mvn clean package -DskipTests

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Restart backend: mvn spring-boot:run"
    echo "2. Test CORS: ./test-cors.sh"
    echo "3. Start dashboard: cd packages/analytics-dashboard && npm start"
    echo ""
    echo "Expected: You should see Access-Control-Allow-Origin headers!"
else
    echo ""
    echo "❌ Build failed. Check errors above."
    exit 1
fi
