import boto3
import json
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Lambda function to startup demo environment resources during demo hours
    """
    
    environment_tag = os.environ.get('ENVIRONMENT_TAG', '${environment_tag}')
    
    try:
        # Initialize AWS clients
        ec2 = boto3.client('ec2')
        dynamodb = boto3.client('dynamodb')
        kinesis = boto3.client('kinesis')
        
        startup_actions = []
        
        # Start EC2 instances
        ec2_result = startup_ec2_instances(ec2, environment_tag)
        if ec2_result:
            startup_actions.append(f"Started {ec2_result} EC2 instances")
        
        # Scale up DynamoDB tables
        dynamodb_result = scale_up_dynamodb(dynamodb, environment_tag)
        if dynamodb_result:
            startup_actions.append(f"Scaled up {dynamodb_result} DynamoDB tables")
        
        # Increase Kinesis shard count
        kinesis_result = scale_up_kinesis(kinesis, environment_tag)
        if kinesis_result:
            startup_actions.append(f"Scaled up {kinesis_result} Kinesis streams")
        
        logger.info(f"Startup completed: {startup_actions}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Demo resources startup completed',
                'actions': startup_actions,
                'timestamp': context.aws_request_id
            })
        }
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Startup failed: {str(e)}'
            })
        }

def startup_ec2_instances(ec2, environment_tag):
    """Start EC2 instances tagged with demo environment"""
    try:
        # Find stopped instances with demo environment tag
        response = ec2.describe_instances(
            Filters=[
                {
                    'Name': 'tag:Environment',
                    'Values': [environment_tag]
                },
                {
                    'Name': 'instance-state-name',
                    'Values': ['stopped']
                }
            ]
        )
        
        instance_ids = []
        for reservation in response['Reservations']:
            for instance in reservation['Instances']:
                instance_ids.append(instance['InstanceId'])
        
        if instance_ids:
            ec2.start_instances(InstanceIds=instance_ids)
            logger.info(f"Started EC2 instances: {instance_ids}")
            return len(instance_ids)
        
        return 0
        
    except Exception as e:
        logger.error(f"Error starting EC2 instances: {str(e)}")
        return 0

def scale_up_dynamodb(dynamodb, environment_tag):
    """Scale up DynamoDB tables to demo capacity"""
    try:
        # List all tables
        response = dynamodb.list_tables()
        scaled_tables = 0
        
        for table_name in response['TableNames']:
            try:
                # Check if table has demo environment tag
                table_info = dynamodb.describe_table(TableName=table_name)
                
                # Scale up to demo capacity (5 RCU/WCU)
                if table_info['Table']['BillingModeSummary']['BillingMode'] == 'PROVISIONED':
                    dynamodb.update_table(
                        TableName=table_name,
                        ProvisionedThroughput={
                            'ReadCapacityUnits': 5,
                            'WriteCapacityUnits': 5
                        }
                    )
                    scaled_tables += 1
                    logger.info(f"Scaled up DynamoDB table: {table_name}")
                    
            except Exception as e:
                logger.warning(f"Could not scale table {table_name}: {str(e)}")
                continue
        
        return scaled_tables
        
    except Exception as e:
        logger.error(f"Error scaling DynamoDB tables: {str(e)}")
        return 0

def scale_up_kinesis(kinesis, environment_tag):
    """Increase Kinesis stream shard count for demo load"""
    try:
        # List all streams
        response = kinesis.list_streams()
        scaled_streams = 0
        
        for stream_name in response['StreamNames']:
            try:
                # Check if stream has demo environment tag
                stream_info = kinesis.describe_stream(StreamName=stream_name)
                
                current_shards = len(stream_info['StreamDescription']['Shards'])
                
                # Scale up to 2 shards for demo load
                if current_shards < 2:
                    kinesis.update_shard_count(
                        StreamName=stream_name,
                        TargetShardCount=2,
                        ScalingType='UNIFORM_SCALING'
                    )
                    scaled_streams += 1
                    logger.info(f"Scaled up Kinesis stream: {stream_name}")
                    
            except Exception as e:
                logger.warning(f"Could not scale stream {stream_name}: {str(e)}")
                continue
        
        return scaled_streams
        
    except Exception as e:
        logger.error(f"Error scaling Kinesis streams: {str(e)}")
        return 0