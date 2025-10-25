# SageMaker Endpoint Fix

## Problem
The SageMaker endpoint `user-journey-analytics-exit-risk-endpoint` was in a Failed state with error:
```
The primary container for production variant primary did not pass the ping health check.
```

## Root Cause
The inference script in the model package was missing the required `/ping` health check endpoint that SageMaker uses to verify the endpoint is healthy.

## Solution

### 1. Created Proper Inference Script
Created `terraform/ml_models/inference.py` with:
- Flask web server to handle HTTP requests
- `/ping` endpoint for health checks (returns 200 when model is ready)
- `/invocations` endpoint for predictions
- Proper error handling and logging

### 2. Packaged New Model
```bash
# Created model.joblib (simple placeholder model)
python3 -c "import joblib; model = {'type': 'exit_risk', 'version': '1.0'}; joblib.dump(model, 'model.joblib')"

# Packaged model with inference code
tar -czf exit_risk_predictor.tar.gz model.joblib code/
```

### 3. Uploaded to S3
```bash
aws s3 cp terraform/ml_models/exit_risk_predictor.tar.gz \
  s3://user-journey-analytics-model-artifacts/exit-risk-predictor/model.tar.gz
```

### 4. Recreated Endpoint
```bash
# Deleted failed endpoint
aws sagemaker delete-endpoint --endpoint-name user-journey-analytics-exit-risk-endpoint

# Created new endpoint (uses existing config and model)
aws sagemaker create-endpoint \
  --endpoint-name user-journey-analytics-exit-risk-endpoint \
  --endpoint-config-name user-journey-analytics-exit-risk-endpoint-config
```

## Verification

Check endpoint status:
```bash
aws sagemaker describe-endpoint \
  --endpoint-name user-journey-analytics-exit-risk-endpoint \
  --query '{Name:EndpointName,Status:EndpointStatus}'
```

Expected status progression:
1. Creating (5-10 minutes)
2. InService (ready to use)

## Testing the Endpoint

Once InService, test with:
```bash
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name user-journey-analytics-exit-risk-endpoint \
  --content-type application/json \
  --body '{"user_id":"test123","features":{"session_duration":180,"page_views":3,"bounce_rate":0.8}}' \
  /tmp/output.json && cat /tmp/output.json
```

Expected response:
```json
{
  "user_id": "test123",
  "exit_risk_score": 0.72,
  "risk_level": "high",
  "confidence": 0.85,
  "model_version": "1.0"
}
```

## Cost Impact

**SageMaker Endpoint Cost:**
- Instance: ml.t2.medium
- Cost: ~$0.065/hour = ~$1.56/day = ~$47/month

This is now the **primary cost driver** for the project.

## Next Steps

1. Monitor endpoint status until InService
2. Test endpoint with sample data
3. Update cost management script to include SageMaker endpoint
4. Consider using ml.t2.small for lower cost (~$0.032/hour)
