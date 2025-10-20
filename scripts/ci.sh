#!/bin/bash

# CI/CD script for monorepo
# Optimized for continuous integration environments

set -e

echo "🔄 Running CI/CD pipeline..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[CI]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
SKIP_TESTS=false
SKIP_BUILD=false
PRODUCTION=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --production)
            PRODUCTION=true
            shift
            ;;
        *)
            echo "Unknown option $1"
            echo "Usage: $0 [--skip-tests] [--skip-build] [--production]"
            exit 1
            ;;
    esac
done

# Set environment for production builds
if [ "$PRODUCTION" = true ]; then
    export NODE_ENV=production
    print_status "Running in production mode"
fi

# 1. Install dependencies
print_status "Installing dependencies..."
npm ci
npm run install:all

# 2. Type checking
print_status "Running TypeScript compilation..."
npm run typecheck

# 3. Linting
print_status "Running ESLint..."
npm run lint:check

# 4. Format checking
print_status "Checking code formatting..."
npm run format:check

# 5. Testing (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
    print_status "Running tests..."
    npm run test:ci
else
    print_status "Skipping tests (--skip-tests flag provided)"
fi

# 6. Building (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
    print_status "Building applications..."
    if [ "$PRODUCTION" = true ]; then
        npm run build:production
    else
        npm run build
    fi
else
    print_status "Skipping build (--skip-build flag provided)"
fi

print_success "🎉 CI/CD pipeline completed successfully!"

# Output build artifacts information
if [ "$SKIP_BUILD" = false ]; then
    print_status "Build artifacts:"
    print_status "  - Shared library: packages/shared/dist/"
    print_status "  - User app: packages/user-app/build/"
    print_status "  - Analytics dashboard: packages/analytics-dashboard/build/"
fi