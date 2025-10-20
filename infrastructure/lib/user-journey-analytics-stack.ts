import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as timestream from 'aws-cdk-lib/aws-timestream';

export class UserJourneyAnalyticsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const userProfilesTable = new dynamodb.Table(this, 'UserProfiles', {
      tableName: 'UserProfiles',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userEventsTable = new dynamodb.Table(this, 'UserEvents', {
      tableName: 'UserEvents',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const struggleSignalsTable = new dynamodb.Table(this, 'StruggleSignals', {
      tableName: 'StruggleSignals',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'featureId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Kinesis Data Stream
    const userEventsStream = new kinesis.Stream(this, 'UserEventsStream', {
      streamName: 'user-events-stream',
      shardCount: 1,
      retentionPeriod: cdk.Duration.days(7),
    });

    // S3 Bucket for data storage
    const dataBucket = new s3.Bucket(this, 'UserJourneyDataBucket', {
      bucketName: `user-journey-analytics-data-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Timestream Database for time-series data
    const timestreamDatabase = new timestream.CfnDatabase(this, 'UserJourneyDatabase', {
      databaseName: 'UserJourneyAnalytics',
    });

    const videoEngagementTable = new timestream.CfnTable(this, 'VideoEngagementTable', {
      databaseName: timestreamDatabase.databaseName!,
      tableName: 'VideoEngagement',
      retentionProperties: {
        memoryStoreRetentionPeriodInHours: '24',
        magneticStoreRetentionPeriodInDays: '365',
      },
    });

    // IAM Role for Lambda functions
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                userProfilesTable.tableArn,
                userEventsTable.tableArn,
                struggleSignalsTable.tableArn,
              ],
            }),
          ],
        }),
        KinesisAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kinesis:GetRecords',
                'kinesis:GetShardIterator',
                'kinesis:DescribeStream',
                'kinesis:ListStreams',
                'kinesis:PutRecord',
                'kinesis:PutRecords',
              ],
              resources: [userEventsStream.streamArn],
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeAgent',
              ],
              resources: ['*'],
            }),
          ],
        }),
        TimestreamAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'timestream:WriteRecords',
                'timestream:Select',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // API Gateway for REST API
    const api = new apigateway.RestApi(this, 'UserJourneyAnalyticsApi', {
      restApiName: 'User Journey Analytics API',
      description: 'API for User Journey Analytics system',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Output important resource ARNs and names
    new cdk.CfnOutput(this, 'UserProfilesTableName', {
      value: userProfilesTable.tableName,
      description: 'DynamoDB User Profiles Table Name',
    });

    new cdk.CfnOutput(this, 'UserEventsStreamName', {
      value: userEventsStream.streamName,
      description: 'Kinesis User Events Stream Name',
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: dataBucket.bucketName,
      description: 'S3 Data Bucket Name',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'TimestreamDatabaseName', {
      value: timestreamDatabase.databaseName!,
      description: 'Timestream Database Name',
    });
  }
}