import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export declare class DynamoDBSchemas extends Construct {
    readonly userProfilesTable: dynamodb.Table;
    readonly userEventsTable: dynamodb.Table;
    readonly struggleSignalsTable: dynamodb.Table;
    readonly videoEngagementTable: dynamodb.Table;
    constructor(scope: Construct, id: string);
}
