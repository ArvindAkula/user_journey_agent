#!/bin/bash

# Development script for monorepo
# Runs shared library in watch mode and both applications simultaneously

set -e

echo "🚀 Starting development environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[DEV]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if shared library is built
if [ ! -d "packages/shared/dist" ]; then
    print_status "Shared library not built. Building now..."
    cd packages/shared
    npm run build
    cd ../..
    print_success "Shared library built"
fi

print_status "Starting development servers..."
print_status "  - Shared library: watch mode"
print_status "  - User app: http://localhost:3000"
print_status "  - Analytics dashboard: http://localhost:3001"

# Use concurrently to run all development servers
npm run dev