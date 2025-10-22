#!/bin/bash

# Environment Testing Script
# Tests both dev and prod configurations locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-dev}

echo "=========================================="
echo "Testing $ENVIRONMENT Environment"
echo "=========================================="

# Function to test endpoint
test_endpoint() {
    local url=$1
    local expected_status=$2
    local description=$3
    
    echo -n "Testing $description... "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status)"
        return 1
    fi
}

# Function to test authenticated endpoint
test_authenticated_endpoint() {
    local url=$1
    local token=$2
    local expected_status=$3
    local description=$4
    
    echo -n "Testing $description... "
    status=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $token" "$url")
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status)"
        return 1
    fi
}

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Backend URL
BACKEND_URL="http://localhost:8080"

echo ""
echo "=========================================="
echo "1. Backend Health Check"
echo "=========================================="

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "$BACKEND_URL/api/health" 200 "Health endpoint"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "=========================================="
echo "2. Environment Configuration"
echo "=========================================="

echo -n "Checking active profile... "
PROFILE=$(curl -s "$BACKEND_URL/actuator/env" | grep -o "\"activeProfiles\":\[\"[^\"]*\"\]" | grep -o "\"[^\"]*\"" | tail -1 | tr -d '"')

if [ "$PROFILE" = "$ENVIRONMENT" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Profile: $PROFILE)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAIL${NC} (Expected: $ENVIRONMENT, Got: $PROFILE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "=========================================="
echo "3. Authentication Tests"
echo "=========================================="

# Test unauthenticated access
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "$BACKEND_URL/api/events" 401 "Protected endpoint without auth"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test login (if credentials provided)
if [ -n "$TEST_EMAIL" ] && [ -n "$TEST_PASSWORD" ]; then
    echo -n "Testing login... "
    LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$TOKEN" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Test authenticated access
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        if test_authenticated_endpoint "$BACKEND_URL/api/events" "$TOKEN" 200 "Protected endpoint with auth"; then
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${YELLOW}Skipping login test (no credentials provided)${NC}"
    echo "Set TEST_EMAIL and TEST_PASSWORD environment variables to test login"
fi

echo ""
echo "=========================================="
echo "4. AWS Service Tests"
echo "=========================================="

if [ "$ENVIRONMENT" = "dev" ]; then
    echo -n "Testing LocalStack connection... "
    if curl -s http://localhost:4566/_localstack/health > /dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing DynamoDB tables... "
    TABLES=$(aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1 2>/dev/null | grep -c "UserProfiles\|UserEvents")
    if [ "$TABLES" -ge 2 ]; then
        echo -e "${GREEN}✓ PASS${NC} ($TABLES tables found)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected 2+ tables, found $TABLES)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${YELLOW}Skipping LocalStack tests (production mode)${NC}"
    echo "AWS service tests require actual AWS credentials"
fi

echo ""
echo "=========================================="
echo "5. Firebase Tests"
echo "=========================================="

if [ "$ENVIRONMENT" = "dev" ]; then
    echo -n "Testing Firebase Emulator... "
    if curl -s http://localhost:9099 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (Emulator may not be running)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${YELLOW}Skipping Firebase Emulator tests (production mode)${NC}"
    echo "Firebase tests require production Firebase credentials"
fi

echo ""
echo "=========================================="
echo "6. Frontend Tests"
echo "=========================================="

# Test User App
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "http://localhost:3000" 200 "User App"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${YELLOW}Note: Make sure User App is running (npm start)${NC}"
fi

# Test Analytics Dashboard
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "http://localhost:3001" 200 "Analytics Dashboard"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${YELLOW}Note: Make sure Analytics Dashboard is running (npm start)${NC}"
fi

echo ""
echo "=========================================="
echo "Test Results Summary"
echo "=========================================="
echo -e "Total Tests:  ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
