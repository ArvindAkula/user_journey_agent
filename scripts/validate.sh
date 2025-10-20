#!/bin/bash

# Validation script for monorepo
# Runs comprehensive validation including type checking, linting, formatting, and testing

set -e

echo "🔍 Running comprehensive validation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[VALIDATE]${NC} $1"
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

# Track validation results
VALIDATION_ERRORS=0

# Function to run validation step
run_validation() {
    local step_name="$1"
    local command="$2"
    
    print_status "Running $step_name..."
    
    if eval "$command"; then
        print_success "$step_name passed"
    else
        print_error "$step_name failed"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
}

# 1. Type checking
run_validation "TypeScript compilation" "npm run typecheck"

# 2. Linting
run_validation "ESLint checks" "npm run lint:check"

# 3. Formatting
run_validation "Prettier formatting" "npm run format:check"

# 4. Testing
run_validation "Unit tests" "npm run test:ci"

# 5. Build validation
run_validation "Build process" "npm run build:clean"

# Summary
echo ""
if [ $VALIDATION_ERRORS -eq 0 ]; then
    print_success "🎉 All validations passed! Ready for deployment."
    exit 0
else
    print_error "❌ $VALIDATION_ERRORS validation(s) failed. Please fix the issues before proceeding."
    exit 1
fi