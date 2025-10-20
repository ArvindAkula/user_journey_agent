#!/bin/bash

# Simple production startup with minimal required environment variables
export JWT_SECRET="Oz1CRbPVza+n42fG2uVwxwRW0hVnWMFOpB4OdQf4SdM="
export ENCRYPTION_KEY="521fc23a1d652aa201c51ba22c5134ed"
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
export AWS_MOCK_MODE="true"
export FIREBASE_PROJECT_ID="user-journey-82eaa"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"

echo "Starting backend with production profile (minimal config)..."
echo "JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "CORS_ALLOWED_ORIGINS: $CORS_ALLOWED_ORIGINS"

mvn spring-boot:run -Dspring-boot.run.profiles=production