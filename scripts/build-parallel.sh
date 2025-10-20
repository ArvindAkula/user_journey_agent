#!/bin/bash

# Parallel build script for monorepo
# Builds applications in parallel after shared library is ready

set -e

echo "⚡ Starting parallel build process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Clean previous builds
print_status "Cleaning previous builds..."
npm run clean

# Build shared library first (required dependency)
print_status "Building shared library..."
cd packages/shared
npm run build
if [ $? -ne 0 ]; then
    print_error "Failed to build shared library"
    exit 1
fi
cd ../..
print_success "Shared library built successfully"

# Build applications in parallel
print_status "Building applications in parallel..."

# Function to build user app
build_user_app() {
    cd packages/user-app
    npm run build
    local exit_code=$?
    cd ../..
    return $exit_code
}

# Function to build analytics dashboard
build_analytics() {
    cd packages/analytics-dashboard
    npm run build
    local exit_code=$?
    cd ../..
    return $exit_code
}

# Start parallel builds
build_user_app &
USER_APP_PID=$!

build_analytics &
ANALYTICS_PID=$!

# Wait for both builds to complete
USER_APP_SUCCESS=true
ANALYTICS_SUCCESS=true

wait $USER_APP_PID
if [ $? -ne 0 ]; then
    USER_APP_SUCCESS=false
    print_error "User application build failed"
fi

wait $ANALYTICS_PID
if [ $? -ne 0 ]; then
    ANALYTICS_SUCCESS=false
    print_error "Analytics dashboard build failed"
fi

# Check results
if [ "$USER_APP_SUCCESS" = true ] && [ "$ANALYTICS_SUCCESS" = true ]; then
    print_success "🎉 All applications built successfully in parallel!"
    print_status "Build artifacts:"
    print_status "  - Shared library: packages/shared/dist/"
    print_status "  - User app: packages/user-app/build/"
    print_status "  - Analytics dashboard: packages/analytics-dashboard/build/"
    exit 0
else
    print_error "❌ One or more builds failed"
    exit 1
fi