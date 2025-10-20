#!/bin/bash

# Test script to verify pricing_page_view event flow
# Tests: Frontend → Backend → Kinesis → Lambda → DynamoDB

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testing pricing_page_view Event Flow${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
BACKEND_URL="http://localhost:8080"
USER_ID="test-user-$(date +%s)"
SESSION_ID="test-session-$(date +%s)"
KINESIS_STREAM="user-journey-analytics-events-dev"
DYNAMODB_TABLE="user-journey-analytics-user-events-dev"

# Test 1: Backend Health Check
echo -e "${YELLOW}[1/5] Checking backend health...${NC}"
if curl -s "${BACKEND_URL}/api/events/health" > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not responding at ${BACKEND_URL}${NC}"
    echo -e "${YELLOW}Please start the backend with: cd backend && mvn spring-boot:run${NC}"
    exit 1
fi
echo ""

# Test 2: Send pricing_page_view event to backend
echo -e "${YELLOW}[2/5] Sending pricing_page_view event to backend...${NC}"

EVENT_PAYLOAD=$(cat <<EOF
{
  "userId": "${USER_ID}",
  "sessionId": "${SESSION_ID}",
  "eventType": "pricing_page_view",
  "timestamp": $(date +%s)000,
  "eventData": {
    "feature": "loan_calculator",
    "attemptCount": 1
  },
  "userContext": {
    "deviceType": "desktop",
    "browserInfo": "Test Browser",
    "persona": "test-user",
    "userSegment": "active_user",
    "sessionStage": "active",
    "previousActions": []
  },
  "deviceInfo": {
    "platform": "Web",
    "appVersion": "1.0.0",
    "deviceModel": "Test Device"
  }
}
EOF
)

echo "Payload:"
echo "$EVENT_PAYLOAD" | jq '.'
echo ""

RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/events/track" \
  -H "Content-Type: application/json" \
  -d "$EVENT_PAYLOAD")

echo "Backend Response:"
echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.eventId' > /dev/null 2>&1; then
    EVENT_ID=$(echo "$RESPONSE" | jq -r '.eventId')
    echo -e "${GREEN}✓ Event sent to backend successfully (ID: ${EVENT_ID})${NC}"
else
    echo -e "${RED}✗ Failed to send event to backend${NC}"
    exit 1
fi
echo ""

# Test 3: Check backend logs for pricing_page_view
echo -e "${YELLOW}[3/5] Checking backend logs...${NC}"
echo -e "${BLUE}Look for these log messages in your backend console:${NC}"
echo -e "  - 🤖 [BACKEND] PRICING_PAGE_VIEW EVENT RECEIVED!"
echo -e "  - 🔄 [SERVICE] Processing pricing_page_view event"
echo -e "  - 🌊 [SERVICE] Sending pricing_page_view to Kinesis"
echo -e "  - ✅ [SERVICE] pricing_page_view sent to Kinesis successfully"
echo ""
sleep 2

# Test 4: Check Kinesis stream
echo -e "${YELLOW}[4/5] Checking Kinesis stream...${NC}"
if aws kinesis describe-stream --stream-name "${KINESIS_STREAM}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Kinesis stream '${KINESIS_STREAM}' exists${NC}"
    
    # Get stream metrics
    SHARD_COUNT=$(aws kinesis describe-stream --stream-name "${KINESIS_STREAM}" | jq -r '.StreamDescription.Shards | length')
    echo -e "  Shards: ${SHARD_COUNT}"
    
    # Check recent records (last 5 minutes)
    echo -e "${BLUE}  Checking for recent records...${NC}"
    SHARD_ID=$(aws kinesis list-shards --stream-name "${KINESIS_STREAM}" | jq -r '.Shards[0].ShardId')
    SHARD_ITERATOR=$(aws kinesis get-shard-iterator \
        --stream-name "${KINESIS_STREAM}" \
        --shard-id "${SHARD_ID}" \
        --shard-iterator-type TRIM_HORIZON | jq -r '.ShardIterator')
    
    RECORDS=$(aws kinesis get-records --shard-iterator "${SHARD_ITERATOR}" | jq -r '.Records | length')
    echo -e "  Recent records in shard: ${RECORDS}"
else
    echo -e "${RED}✗ Kinesis stream '${KINESIS_STREAM}' not found${NC}"
    echo -e "${YELLOW}  Event may not reach Lambda without Kinesis stream${NC}"
fi
echo ""

# Test 5: Check DynamoDB for the event
echo -e "${YELLOW}[5/5] Checking DynamoDB for the event...${NC}"
echo -e "${BLUE}Waiting 5 seconds for Lambda processing...${NC}"
sleep 5

if aws dynamodb describe-table --table-name "${DYNAMODB_TABLE}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ DynamoDB table '${DYNAMODB_TABLE}' exists${NC}"
    
    # Query for our test event
    QUERY_RESULT=$(aws dynamodb query \
        --table-name "${DYNAMODB_TABLE}" \
        --key-condition-expression "userId = :userId" \
        --expression-attribute-values "{\":userId\":{\"S\":\"${USER_ID}\"}}" \
        --limit 10 2>/dev/null || echo '{"Items":[]}')
    
    ITEM_COUNT=$(echo "$QUERY_RESULT" | jq -r '.Items | length')
    
    if [ "$ITEM_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Found ${ITEM_COUNT} event(s) in DynamoDB for user ${USER_ID}${NC}"
        echo ""
        echo "Event details:"
        echo "$QUERY_RESULT" | jq -r '.Items[0]' | head -20
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}✓ SUCCESS: Complete flow working!${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo -e "${YELLOW}⚠ No events found in DynamoDB yet${NC}"
        echo -e "${YELLOW}This could mean:${NC}"
        echo -e "  1. Lambda is still processing (wait a bit longer)"
        echo -e "  2. Lambda function is not triggered by Kinesis"
        echo -e "  3. Lambda has errors (check CloudWatch logs)"
        echo ""
        echo -e "${BLUE}Check Lambda logs with:${NC}"
        echo -e "  aws logs tail /aws/lambda/event_processor --follow"
    fi
else
    echo -e "${RED}✗ DynamoDB table '${DYNAMODB_TABLE}' not found${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "User ID: ${USER_ID}"
echo -e "Session ID: ${SESSION_ID}"
echo -e "Event ID: ${EVENT_ID}"
echo ""
echo -e "${YELLOW}Next steps to debug:${NC}"
echo -e "1. Check backend logs for pricing_page_view processing"
echo -e "2. Check Lambda CloudWatch logs:"
echo -e "   aws logs tail /aws/lambda/event_processor --follow"
echo -e "3. Check Kinesis metrics in AWS Console"
echo -e "4. Verify Lambda trigger is configured on Kinesis stream"
echo ""
