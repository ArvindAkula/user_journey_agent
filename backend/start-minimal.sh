#!/bin/bash

# Parse command line arguments
CLEAN=false
if [ "$1" == "--clean" ] || [ "$1" == "-c" ]; then
    CLEAN=true
fi

# Clean if requested
if [ "$CLEAN" = true ]; then
    echo "🧹 Cleaning backend..."
    mvn clean
    if [ $? -ne 0 ]; then
        echo "❌ Clean failed"
        exit 1
    fi
    echo "✅ Clean completed"
fi

# Use existing production configuration with real AWS services
echo "Loading production environment variables..."
set -a
source ../.env.production
set +a

# Verify critical variables are loaded
if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET not found"
    exit 1
fi

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "❌ AWS_ACCESS_KEY_ID not found"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "✅ JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "✅ AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
echo "✅ Starting backend with production profile and real AWS services..."

mvn spring-boot:run -Dspring-boot.run.profiles=production