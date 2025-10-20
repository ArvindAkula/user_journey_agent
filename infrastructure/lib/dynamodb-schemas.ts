import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';

export class DynamoDBSchemas extends Construct {
  public readonly userProfilesTable: dynamodb.Table;
  public readonly userEventsTable: dynamodb.Table;
  public readonly struggleSignalsTable: dynamodb.Table;
  public readonly videoEngagementTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // User Profiles Table
    this.userProfilesTable = new dynamodb.Table(this, 'UserProfiles', {
      tableName: 'UserProfiles',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // For development - change for production
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // Add Global Secondary Index for user segment queries
    this.userProfilesTable.addGlobalSecondaryIndex({
      indexName: 'UserSegmentIndex',
      partitionKey: {
        name: 'userSegment',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'lastActiveAt',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Add GSI for risk score queries
    this.userProfilesTable.addGlobalSecondaryIndex({
      indexName: 'RiskScoreIndex',
      partitionKey: {
        name: 'userSegment',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'exitRiskScore',
        type: dynamodb.AttributeType.NUMBER
      }
    });

    // User Events Table
    this.userEventsTable = new dynamodb.Table(this, 'UserEvents', {
      tableName: 'UserEvents',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl', // Auto-delete old events
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // Add GSI for event type queries
    this.userEventsTable.addGlobalSecondaryIndex({
      indexName: 'EventTypeIndex',
      partitionKey: {
        name: 'eventType',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      }
    });

    // Add GSI for session-based queries
    this.userEventsTable.addGlobalSecondaryIndex({
      indexName: 'SessionIndex',
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      }
    });

    // Struggle Signals Table
    this.struggleSignalsTable = new dynamodb.Table(this, 'StruggleSignals', {
      tableName: 'StruggleSignals',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'detectedAt',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // Add GSI for feature-based struggle analysis
    this.struggleSignalsTable.addGlobalSecondaryIndex({
      indexName: 'FeatureStruggleIndex',
      partitionKey: {
        name: 'featureId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'severity',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Add GSI for unresolved struggles
    this.struggleSignalsTable.addGlobalSecondaryIndex({
      indexName: 'UnresolvedIndex',
      partitionKey: {
        name: 'resolved',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'detectedAt',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Add GSI for intervention tracking
    this.struggleSignalsTable.addGlobalSecondaryIndex({
      indexName: 'InterventionIndex',
      partitionKey: {
        name: 'interventionTriggered',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'detectedAt',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Video Engagement Table
    this.videoEngagementTable = new dynamodb.Table(this, 'VideoEngagement', {
      tableName: 'VideoEngagement',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'videoId#timestamp',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // Add GSI for video-centric analysis
    this.videoEngagementTable.addGlobalSecondaryIndex({
      indexName: 'VideoAnalyticsIndex',
      partitionKey: {
        name: 'videoId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Add GSI for engagement scoring
    this.videoEngagementTable.addGlobalSecondaryIndex({
      indexName: 'EngagementScoreIndex',
      partitionKey: {
        name: 'videoId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'interestScore',
        type: dynamodb.AttributeType.NUMBER
      }
    });
  }
}