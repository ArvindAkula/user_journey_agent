# Flink application for real-time user journey analytics
import json
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment
from pyflink.table.descriptors import Schema, Kafka, Json

def create_kinesis_source_table(table_env):
    """Create Kinesis source table for user events"""
    table_env.execute_sql("""
        CREATE TABLE user_events (
            userId STRING,
            eventType STRING,
            timestamp BIGINT,
            sessionId STRING,
            eventData ROW<
                feature STRING,
                videoId STRING,
                duration BIGINT,
                completionRate DOUBLE,
                attemptCount INT,
                errorType STRING
            >,
            deviceInfo ROW<
                platform STRING,
                appVersion STRING,
                deviceModel STRING
            >,
            userContext ROW<
                userSegment STRING,
                sessionStage STRING,
                previousActions ARRAY<STRING>
            >,
            proctime AS PROCTIME()
        ) WITH (
            'connector' = 'kinesis',
            'stream' = 'user-journey-analytics-user-events-dev',
            'aws.region' = 'us-east-1',
            'scan.stream.initpos' = 'LATEST',
            'format' = 'json'
        )
    """)

def create_struggle_signal_sink(table_env):
    """Create sink table for struggle signals"""
    table_env.execute_sql("""
        CREATE TABLE struggle_signals_sink (
            userId STRING,
            featureId STRING,
            detectedAt BIGINT,
            signalType STRING,
            severity STRING,
            attemptCount INT,
            timeSpent BIGINT
        ) WITH (
            'connector' = 'kinesis',
            'stream' = 'user-journey-analytics-struggle-signals-dev',
            'aws.region' = 'us-east-1',
            'format' = 'json'
        )
    """)

def detect_struggle_signals(table_env):
    """Detect struggle signals from user events"""
    table_env.execute_sql("""
        INSERT INTO struggle_signals_sink
        SELECT 
            userId,
            eventData.feature as featureId,
            timestamp as detectedAt,
            'repeated_attempts' as signalType,
            CASE 
                WHEN eventData.attemptCount >= 5 THEN 'critical'
                WHEN eventData.attemptCount >= 3 THEN 'high'
                WHEN eventData.attemptCount >= 2 THEN 'medium'
                ELSE 'low'
            END as severity,
            eventData.attemptCount,
            eventData.duration as timeSpent
        FROM user_events
        WHERE eventType = 'feature_interaction' 
        AND eventData.attemptCount >= 2
    """)

def main():
    """Main Flink application entry point"""
    env = StreamExecutionEnvironment.get_execution_environment()
    table_env = StreamTableEnvironment.create(env)
    
    # Create source and sink tables
    create_kinesis_source_table(table_env)
    create_struggle_signal_sink(table_env)
    
    # Process struggle signals
    detect_struggle_signals(table_env)
    
    # Execute the job
    env.execute("User Journey Analytics")

if __name__ == "__main__":
    main()