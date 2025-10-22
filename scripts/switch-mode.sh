#!/bin/bash

# Quick mode switcher script

MODE=$1

if [ -z "$MODE" ]; then
    echo "Usage: ./scripts/switch-mode.sh [dev|prod]"
    echo ""
    echo "Examples:"
    echo "  ./scripts/switch-mode.sh dev   # Switch to development mode"
    echo "  ./scripts/switch-mode.sh prod  # Switch to production mode"
    exit 1
fi

case $MODE in
    dev|development)
        echo "Switching to DEVELOPMENT mode..."
        export SPRING_PROFILES_ACTIVE=dev
        export NODE_ENV=development
        echo "✓ Environment variables set:"
        echo "  SPRING_PROFILES_ACTIVE=dev"
        echo "  NODE_ENV=development"
        echo ""
        echo "Now run:"
        echo "  cd backend && mvn spring-boot:run"
        echo "  cd packages/user-app && npm start"
        echo "  cd packages/analytics-dashboard && npm start"
        echo ""
        echo "Or use the automated script:"
        echo "  ./scripts/start-dev.sh"
        ;;
    prod|production)
        echo "Switching to PRODUCTION mode..."
        export SPRING_PROFILES_ACTIVE=prod
        export NODE_ENV=production
        echo "✓ Environment variables set:"
        echo "  SPRING_PROFILES_ACTIVE=prod"
        echo "  NODE_ENV=production"
        echo ""
        echo "⚠️  WARNING: You are switching to PRODUCTION mode"
        echo "   - Will use real AWS services"
        echo "   - Will use production Firebase"
        echo "   - Costs may apply"
        echo ""
        echo "Now run:"
        echo "  cd backend && mvn spring-boot:run"
        echo "  cd packages/user-app && npm start"
        echo "  cd packages/analytics-dashboard && npm start"
        echo ""
        echo "Or use the automated script:"
        echo "  ./scripts/start-prod.sh"
        ;;
    *)
        echo "ERROR: Invalid mode '$MODE'"
        echo "Valid modes: dev, development, prod, production"
        exit 1
        ;;
esac
