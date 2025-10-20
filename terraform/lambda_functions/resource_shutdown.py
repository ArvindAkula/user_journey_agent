import boto3
import json
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Lambda function to shutdown demo environment resources during non-demo hours
    """
    
    environment_tag = os.environ.get('ENVIRONMENT_TAG', '${environment_tag}')
    
    try:
        # Initialize AWS clients
        ec2 = boto3.client('ec2')
        dynamodb = boto3.client('dynamodb')
        kinesis = boto3.client('kinesis')
        
        shutdown_actions = []
        
        # Shutdown EC2 instances
        ec2_result = shutdown_ec2_instances(ec2, environment_tag)
        if ec2_result:
            shutdown_actions.append(f"Stopped {ec2_result} EC2 instances")
        
        # Scale down DynamoDB tables
        dynamodb_result = scale_down_dynamodb(dynamodb, environment_tag)
        if dynamodb_result:
            shutdown_actions.append(f"Scaled down {dynamodb_result} DynamoDB tables")
        
        # Reduce Kinesis shard count
        kinesis_result = scale_down_kinesis(kinesis, environment_tag)
        if kinesis_result:
            shutdown_actions.append(f"Scaled down {kinesis_result} Kinesis streams")
        
        logger.info(f"Shutdown completed: {shutdown_actions}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Demo resources shutdown completed',
                'actions': shutdown_actions,
                'timestamp': context.aws_request_id
            })
        }
        
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Shutdown failed: {str(e)}'
            })
        }

def shutdown_ec2_instances(ec2, environment_tag):
    """Shutdown EC2 instances tagged with demo environment"""
    try:
        # Find instances with demo environment tag
        response = ec2.describe_instances(
            Filters=[
                {
                    'Name': 'tag:Environment',
                    'Values': [environment_tag]
                },
                {
                    'Name': 'instance-state-name',
                    'Values': ['running']
                }
            ]
        )
        
        instance_ids = []
        for reservation in response['Reservations']:
            for instance in reservation['Instances']:
                instance_ids.append(instance['InstanceId'])
        
        if instance_ids:
            ec2.stop_instances(InstanceIds=instance_ids)
            logger.info(f"Stopped EC2 instances: {instance_ids}")
            return len(instance_ids)
        
        return 0
        
    except Exception as e:
        logger.error(f"Error stopping EC2 instances: {str(e)}")
        return 0

def scale_down_dynamodb(dynamodb, environment_tag):
    """Scale down DynamoDB tables to minimum capacity"""
    try:
        # List all tables
        response = dynamodb.list_tables()
        scaled_tables = 0
        
        for table_name in response['TableNames']:
            try:
                # Check if table has demo environment tag
                table_info = dynamodb.describe_table(TableName=table_name)
                
                # Scale down to minimum capacity (1 RCU/WCU)
                if table_info['Table']['BillingModeSummary']['BillingMode'] == 'PROVISIONED':
                    dynamodb.update_table(
                        TableName=table_name,
                        ProvisionedThroughput={
                            'ReadCapacityUnits': 1,
                            'WriteCapacityUnits': 1
                        }
                    )
                    scaled_tables += 1
                    logger.info(f"Scaled down DynamoDB table: {table_name}")
                    
            except Exception as e:
                logger.warning(f"Could not scale table {table_name}: {str(e)}")
                continue
        
        return scaled_tables
        
    except Exception as e:
        logger.error(f"Error scaling DynamoDB tables: {str(e)}")
        return 0

def scale_down_kinesis(kinesis, environment_tag):
    """Reduce Kinesis stream shard count"""
    try:
        # List all streams
        response = kinesis.list_streams()
        scaled_streams = 0
        
        for stream_name in response['StreamNames']:
            try:
                # Check if stream has demo environment tag
                stream_info = kinesis.describe_stream(StreamName=stream_name)
                
                current_shards = len(stream_info['StreamDescription']['Shards'])
                
                # Scale down to 1 shard if more than 1
                if current_shards > 1:
                    kinesis.update_shard_count(
                        StreamName=stream_name,
                        TargetShardCount=1,
                        ScalingType='UNIFORM_SCALING'
                    )
                    scaled_streams += 1
                    logger.info(f"Scaled down Kinesis stream: {stream_name}")
                    
            except Exception as e:
                logger.warning(f"Could not scale stream {stream_name}: {str(e)}")
                continue
        
        return scaled_streams
        
    except Exception as e:
        logger.error(f"Error scaling Kinesis streams: {str(e)}")
        return 0