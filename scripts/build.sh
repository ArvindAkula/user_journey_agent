#!/bin/bash

# Build script for monorepo
# Ensures proper build order: shared library first, then applications

set -e

echo "🏗️  Starting monorepo build process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Clean previous builds
print_status "Cleaning previous builds..."
npm run clean

# Build shared library first
print_status "Building shared library..."
cd packages/shared
npm run build
if [ $? -eq 0 ]; then
    print_success "Shared library built successfully"
else
    print_error "Failed to build shared library"
    exit 1
fi
cd ../..

# Build user application
print_status "Building user application..."
cd packages/user-app
npm run build
if [ $? -eq 0 ]; then
    print_success "User application built successfully"
else
    print_error "Failed to build user application"
    exit 1
fi
cd ../..

# Build analytics dashboard
print_status "Building analytics dashboard..."
cd packages/analytics-dashboard
npm run build
if [ $? -eq 0 ]; then
    print_success "Analytics dashboard built successfully"
else
    print_error "Failed to build analytics dashboard"
    exit 1
fi
cd ../..

print_success "🎉 All packages built successfully!"
print_status "Build artifacts:"
print_status "  - Shared library: packages/shared/dist/"
print_status "  - User app: packages/user-app/build/"
print_status "  - Analytics dashboard: packages/analytics-dashboard/build/"