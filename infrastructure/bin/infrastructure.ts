#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UserJourneyAnalyticsStack } from '../lib/user-journey-analytics-stack';

const app = new cdk.App();
new UserJourneyAnalyticsStack(app, 'UserJourneyAnalyticsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});