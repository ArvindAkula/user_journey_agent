#!/bin/bash

# Setup script for monorepo development environment
# Installs dependencies, builds shared library, and validates setup

set -e

echo "🚀 Setting up monorepo development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[SETUP]${NC} $1"
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

# Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
print_status "npm version: $NPM_VERSION"

# Install root dependencies
print_status "Installing root dependencies..."
npm install

# Install workspace dependencies
print_status "Installing workspace dependencies..."
npm run install:all

# Build shared library
print_status "Building shared library..."
npm run build:shared

# Verify TypeScript configuration
print_status "Verifying TypeScript configuration..."
npm run typecheck

# Run initial validation
print_status "Running initial validation..."
npm run lint:check

print_success "🎉 Development environment setup complete!"
print_status "Available commands:"
print_status "  npm run dev          - Start development servers"
print_status "  npm run build        - Build all packages"
print_status "  npm run test         - Run all tests"
print_status "  npm run validate     - Run comprehensive validation"
print_status "  npm run clean        - Clean build artifacts"