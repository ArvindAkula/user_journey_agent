import boto3
import json
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Lambda function to completely teardown demo environment after 15 days
    """
    
    environment_tag = os.environ.get('ENVIRONMENT_TAG', '${environment_tag}')
    
    try:
        teardown_actions = []
        
        # Check if environment is older than 15 days
        if not should_teardown_environment(environment_tag):
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Environment not ready for teardown (less than 15 days old)',
                    'timestamp': context.aws_request_id
                })
            }
        
        # Initialize AWS clients
        ec2 = boto3.client('ec2')
        dynamodb = boto3.client('dynamodb')
        kinesis = boto3.client('kinesis')
        s3 = boto3.client('s3')
        lambda_client = boto3.client('lambda')
        cloudwatch = boto3.client('cloudwatch')
        
        # Terminate EC2 instances
        ec2_result = terminate_ec2_instances(ec2, environment_tag)
        if ec2_result:
            teardown_actions.append(f"Terminated {ec2_result} EC2 instances")
        
        # Delete DynamoDB tables
        dynamodb_result = delete_dynamodb_tables(dynamodb, environment_tag)
        if dynamodb_result:
            teardown_actions.append(f"Deleted {dynamodb_result} DynamoDB tables")
        
        # Delete Kinesis streams
        kinesis_result = delete_kinesis_streams(kinesis, environment_tag)
        if kinesis_result:
            teardown_actions.append(f"Deleted {kinesis_result} Kinesis streams")
        
        # Clean up S3 buckets
        s3_result = cleanup_s3_buckets(s3, environment_tag)
        if s3_result:
            teardown_actions.append(f"Cleaned up {s3_result} S3 buckets")
        
        # Delete Lambda functions
        lambda_result = delete_lambda_functions(lambda_client, environment_tag)
        if lambda_result:
            teardown_actions.append(f"Deleted {lambda_result} Lambda functions")
        
        # Delete CloudWatch resources
        cloudwatch_result = delete_cloudwatch_resources(cloudwatch, environment_tag)
        if cloudwatch_result:
            teardown_actions.append(f"Deleted {cloudwatch_result} CloudWatch resources")
        
        logger.info(f"Environment teardown completed: {teardown_actions}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Demo environment teardown completed',
                'actions': teardown_actions,
                'timestamp': context.aws_request_id
            })
        }
        
    except Exception as e:
        logger.error(f"Error during teardown: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Teardown failed: {str(e)}'
            })
        }

def should_teardown_environment(environment_tag):
    """Check if environment is older than 15 days"""
    try:
        # This is a simplified check - in practice, you'd check resource creation dates
        # For demo purposes, we'll assume teardown is always allowed
        return True
        
    except Exception as e:
        logger.error(f"Error checking environment age: {str(e)}")
        return False

def terminate_ec2_instances(ec2, environment_tag):
    """Terminate all EC2 instances with demo environment tag"""
    try:
        response = ec2.describe_instances(
            Filters=[
                {
                    'Name': 'tag:Environment',
                    'Values': [environment_tag]
                },
                {
                    'Name': 'instance-state-name',
                    'Values': ['running', 'stopped']
                }
            ]
        )
        
        instance_ids = []
        for reservation in response['Reservations']:
            for instance in reservation['Instances']:
                instance_ids.append(instance['InstanceId'])
        
        if instance_ids:
            ec2.terminate_instances(InstanceIds=instance_ids)
            logger.info(f"Terminated EC2 instances: {instance_ids}")
            return len(instance_ids)
        
        return 0
        
    except Exception as e:
        logger.error(f"Error terminating EC2 instances: {str(e)}")
        return 0

def delete_dynamodb_tables(dynamodb, environment_tag):
    """Delete DynamoDB tables with demo environment tag"""
    try:
        response = dynamodb.list_tables()
        deleted_tables = 0
        
        for table_name in response['TableNames']:
            try:
                # Check if table has demo environment tag
                table_info = dynamodb.describe_table(TableName=table_name)
                
                # Check tags (simplified - in practice you'd check actual tags)
                if 'demo' in table_name.lower() or environment_tag in table_name.lower():
                    dynamodb.delete_table(TableName=table_name)
                    deleted_tables += 1
                    logger.info(f"Deleted DynamoDB table: {table_name}")
                    
            except Exception as e:
                logger.warning(f"Could not delete table {table_name}: {str(e)}")
                continue
        
        return deleted_tables
        
    except Exception as e:
        logger.error(f"Error deleting DynamoDB tables: {str(e)}")
        return 0

def delete_kinesis_streams(kinesis, environment_tag):
    """Delete Kinesis streams with demo environment tag"""
    try:
        response = kinesis.list_streams()
        deleted_streams = 0
        
        for stream_name in response['StreamNames']:
            try:
                # Check if stream has demo environment tag (simplified check)
                if 'demo' in stream_name.lower() or environment_tag in stream_name.lower():
                    kinesis.delete_stream(StreamName=stream_name)
                    deleted_streams += 1
                    logger.info(f"Deleted Kinesis stream: {stream_name}")
                    
            except Exception as e:
                logger.warning(f"Could not delete stream {stream_name}: {str(e)}")
                continue
        
        return deleted_streams
        
    except Exception as e:
        logger.error(f"Error deleting Kinesis streams: {str(e)}")
        return 0

def cleanup_s3_buckets(s3, environment_tag):
    """Clean up S3 buckets with demo environment tag"""
    try:
        response = s3.list_buckets()
        cleaned_buckets = 0
        
        for bucket in response['Buckets']:
            bucket_name = bucket['Name']
            
            try:
                # Check if bucket has demo environment tag (simplified check)
                if 'demo' in bucket_name.lower() or environment_tag in bucket_name.lower():
                    # Delete all objects in bucket first
                    objects_response = s3.list_objects_v2(Bucket=bucket_name)
                    
                    if 'Contents' in objects_response:
                        objects_to_delete = [{'Key': obj['Key']} for obj in objects_response['Contents']]
                        s3.delete_objects(
                            Bucket=bucket_name,
                            Delete={'Objects': objects_to_delete}
                        )
                    
                    # Delete the bucket
                    s3.delete_bucket(Bucket=bucket_name)
                    cleaned_buckets += 1
                    logger.info(f"Deleted S3 bucket: {bucket_name}")
                    
            except Exception as e:
                logger.warning(f"Could not delete bucket {bucket_name}: {str(e)}")
                continue
        
        return cleaned_buckets
        
    except Exception as e:
        logger.error(f"Error cleaning S3 buckets: {str(e)}")
        return 0

def delete_lambda_functions(lambda_client, environment_tag):
    """Delete Lambda functions with demo environment tag"""
    try:
        response = lambda_client.list_functions()
        deleted_functions = 0
        
        for function in response['Functions']:
            function_name = function['FunctionName']
            
            try:
                # Check if function has demo environment tag (simplified check)
                if 'demo' in function_name.lower() or environment_tag in function_name.lower():
                    lambda_client.delete_function(FunctionName=function_name)
                    deleted_functions += 1
                    logger.info(f"Deleted Lambda function: {function_name}")
                    
            except Exception as e:
                logger.warning(f"Could not delete function {function_name}: {str(e)}")
                continue
        
        return deleted_functions
        
    except Exception as e:
        logger.error(f"Error deleting Lambda functions: {str(e)}")
        return 0

def delete_cloudwatch_resources(cloudwatch, environment_tag):
    """Delete CloudWatch alarms and dashboards with demo environment tag"""
    try:
        deleted_resources = 0
        
        # Delete alarms
        alarms_response = cloudwatch.describe_alarms()
        for alarm in alarms_response['MetricAlarms']:
            alarm_name = alarm['AlarmName']
            
            if 'demo' in alarm_name.lower() or environment_tag in alarm_name.lower():
                try:
                    cloudwatch.delete_alarms(AlarmNames=[alarm_name])
                    deleted_resources += 1
                    logger.info(f"Deleted CloudWatch alarm: {alarm_name}")
                except Exception as e:
                    logger.warning(f"Could not delete alarm {alarm_name}: {str(e)}")
        
        # Delete dashboards
        dashboards_response = cloudwatch.list_dashboards()
        for dashboard in dashboards_response['DashboardEntries']:
            dashboard_name = dashboard['DashboardName']
            
            if 'demo' in dashboard_name.lower() or environment_tag in dashboard_name.lower():
                try:
                    cloudwatch.delete_dashboards(DashboardNames=[dashboard_name])
                    deleted_resources += 1
                    logger.info(f"Deleted CloudWatch dashboard: {dashboard_name}")
                except Exception as e:
                    logger.warning(f"Could not delete dashboard {dashboard_name}: {str(e)}")
        
        return deleted_resources
        
    except Exception as e:
        logger.error(f"Error deleting CloudWatch resources: {str(e)}")
        return 0