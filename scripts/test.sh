#!/bin/bash

# Test script for monorepo
# Runs tests across all packages with proper reporting

set -e

echo "🧪 Running tests across all packages..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
COVERAGE=false
WATCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Test shared library
print_status "Testing shared library..."
cd packages/shared
if [ "$COVERAGE" = true ]; then
    npm run test:coverage
elif [ "$WATCH" = true ]; then
    npm run test:watch
else
    npm run test
fi

if [ $? -eq 0 ]; then
    print_success "Shared library tests passed"
else
    print_error "Shared library tests failed"
    exit 1
fi
cd ../..

# Test user application
print_status "Testing user application..."
cd packages/user-app
if [ "$COVERAGE" = true ]; then
    npm run test:coverage
elif [ "$WATCH" = true ]; then
    npm run test:watch
else
    npm run test
fi

if [ $? -eq 0 ]; then
    print_success "User application tests passed"
else
    print_error "User application tests failed"
    exit 1
fi
cd ../..

# Test analytics dashboard
print_status "Testing analytics dashboard..."
cd packages/analytics-dashboard
if [ "$COVERAGE" = true ]; then
    npm run test:coverage
elif [ "$WATCH" = true ]; then
    npm run test:watch
else
    npm run test
fi

if [ $? -eq 0 ]; then
    print_success "Analytics dashboard tests passed"
else
    print_error "Analytics dashboard tests failed"
    exit 1
fi
cd ../..

print_success "🎉 All tests passed!"