"""
Connection pooling and resource optimization utilities for Lambda functions
"""

import boto3
import threading
import time
import os
from botocore.config import Config
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class ConnectionPool:
    """Thread-safe connection pool for AWS services"""
    
    def __init__(self):
        self._lock = threading.Lock()
        self._connections = {}
        self._last_used = {}
        self._max_connections = int(os.environ.get('MAX_CONNECTIONS_PER_SERVICE', '10'))
        self._connection_timeout = int(os.environ.get('CONNECTION_TIMEOUT_SECONDS', '300'))
        
    def get_client(self, service_name, region_name=None):
        """Get or create a client with connection pooling"""
        with self._lock:
            key = f"{service_name}_{region_name or 'default'}"
            
            # Clean up expired connections
            self._cleanup_expired_connections()
            
            if key not in self._connections:
                self._connections[key] = self._create_client(service_name, region_name)
                
            self._last_used[key] = time.time()
            return self._connections[key]
    
    def _create_client(self, service_name, region_name=None):
        """Create a new AWS client with optimized configuration"""
        config = Config(
            region_name=region_name or os.environ.get('AWS_REGION', 'us-east-1'),
            retries={
                'max_attempts': 3,
                'mode': 'adaptive'
            },
            max_pool_connections=self._max_connections,
            # Connection pooling optimizations
            tcp_keepalive=True,
            # Reduce connection establishment time
            connect_timeout=5,
            read_timeout=30
        )
        
        return boto3.client(service_name, config=config)
    
    def _cleanup_expired_connections(self):
        """Remove expired connections from the pool"""
        current_time = time.time()
        expired_keys = []
        
        for key, last_used in self._last_used.items():
            if current_time - last_used > self._connection_timeout:
                expired_keys.append(key)
        
        for key in expired_keys:
            if key in self._connections:
                del self._connections[key]
            if key in self._last_used:
                del self._last_used[key]
            logger.info(f"Cleaned up expired connection: {key}")

# Global connection pool instance
connection_pool = ConnectionPool()

class OptimizedDynamoDBClient:
    """Optimized DynamoDB client with connection pooling and caching"""
    
    def __init__(self):
        self.client = connection_pool.get_client('dynamodb')
        self.resource = boto3.resource('dynamodb', 
                                     config=Config(max_pool_connections=20))
        self._table_cache = {}
        self._cache_lock = threading.Lock()
    
    @lru_cache(maxsize=100)
    def get_table(self, table_name):
        """Get DynamoDB table with caching"""
        with self._cache_lock:
            if table_name not in self._table_cache:
                self._table_cache[table_name] = self.resource.Table(table_name)
            return self._table_cache[table_name]
    
    def batch_write_items(self, table_name, items, batch_size=25):
        """Optimized batch write with error handling and retries"""
        table = self.get_table(table_name)
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            retry_count = 0
            max_retries = 3
            
            while retry_count < max_retries:
                try:
                    with table.batch_writer(
                        overwrite_by_pkeys=['userId', 'timestamp']
                    ) as batch_writer:
                        for item in batch:
                            batch_writer.put_item(Item=item)
                    break
                    
                except Exception as e:
                    retry_count += 1
                    if retry_count >= max_retries:
                        logger.error(f"Failed to write batch after {max_retries} retries: {str(e)}")
                        raise
                    
                    # Exponential backoff
                    time.sleep(2 ** retry_count)
    
    def optimized_query(self, table_name, key_condition, **kwargs):
        """Optimized query with projection and pagination"""
        table = self.get_table(table_name)
        
        # Use projection expression to reduce data transfer
        if 'ProjectionExpression' not in kwargs:
            kwargs['ProjectionExpression'] = self._get_minimal_projection(table_name)
        
        # Enable consistent reads only when necessary
        if 'ConsistentRead' not in kwargs:
            kwargs['ConsistentRead'] = False
        
        return table.query(KeyConditionExpression=key_condition, **kwargs)
    
    def _get_minimal_projection(self, table_name):
        """Get minimal projection expression for common queries"""
        projections = {
            'user-profiles': 'userId, userSegment, lastActiveAt, totalSessions',
            'user-events': 'userId, #timestamp, eventType, sessionId',
            'struggle-signals': 'userId, featureId, severity, detectedAt',
            'video-engagement': 'userId, videoId, interestScore, lastWatchedAt'
        }
        
        for key, projection in projections.items():
            if key in table_name:
                return projection
        
        return None

class OptimizedTimestreamClient:
    """Optimized Timestream client with connection pooling and batching"""
    
    def __init__(self):
        self.write_client = connection_pool.get_client('timestream-write')
        self.query_client = connection_pool.get_client('timestream-query')
        self._pending_records = []
        self._batch_lock = threading.Lock()
        self._max_batch_size = 100
        self._batch_timeout = 5  # seconds
        self._last_flush = time.time()
    
    def write_record(self, database_name, table_name, record):
        """Add record to batch for optimized writing"""
        with self._batch_lock:
            self._pending_records.append({
                'database': database_name,
                'table': table_name,
                'record': record
            })
            
            # Auto-flush if batch is full or timeout reached
            if (len(self._pending_records) >= self._max_batch_size or 
                time.time() - self._last_flush > self._batch_timeout):
                self._flush_records()
    
    def _flush_records(self):
        """Flush pending records to Timestream"""
        if not self._pending_records:
            return
        
        # Group records by database and table
        grouped_records = {}
        for item in self._pending_records:
            key = f"{item['database']}_{item['table']}"
            if key not in grouped_records:
                grouped_records[key] = {
                    'database': item['database'],
                    'table': item['table'],
                    'records': []
                }
            grouped_records[key]['records'].append(item['record'])
        
        # Write each group
        for group in grouped_records.values():
            try:
                self.write_client.write_records(
                    DatabaseName=group['database'],
                    TableName=group['table'],
                    Records=group['records']
                )
            except Exception as e:
                logger.error(f"Error writing to Timestream: {str(e)}")
        
        self._pending_records.clear()
        self._last_flush = time.time()
    
    def force_flush(self):
        """Force flush all pending records"""
        with self._batch_lock:
            self._flush_records()
    
    def optimized_query(self, query_string, max_rows=1000):
        """Execute optimized Timestream query"""
        try:
            response = self.query_client.query(
                QueryString=query_string,
                MaxRows=max_rows
            )
            return response
        except Exception as e:
            logger.error(f"Error querying Timestream: {str(e)}")
            return None

class OptimizedBedrockClient:
    """Optimized Bedrock client with connection pooling and caching"""
    
    def __init__(self):
        self.runtime_client = connection_pool.get_client('bedrock-runtime')
        self.agent_client = connection_pool.get_client('bedrock-agent-runtime')
        self._response_cache = {}
        self._cache_ttl = int(os.environ.get('BEDROCK_CACHE_TTL_SECONDS', '300'))
    
    @lru_cache(maxsize=50)
    def invoke_model_cached(self, model_id, body_hash, body):
        """Invoke Bedrock model with response caching"""
        cache_key = f"{model_id}_{body_hash}"
        current_time = time.time()
        
        # Check cache
        if cache_key in self._response_cache:
            cached_response, timestamp = self._response_cache[cache_key]
            if current_time - timestamp < self._cache_ttl:
                logger.info(f"Cache hit for Bedrock model: {model_id}")
                return cached_response
        
        # Invoke model
        try:
            response = self.runtime_client.invoke_model(
                modelId=model_id,
                body=body,
                contentType='application/json',
                accept='application/json'
            )
            
            # Cache response
            self._response_cache[cache_key] = (response, current_time)
            return response
            
        except Exception as e:
            logger.error(f"Error invoking Bedrock model: {str(e)}")
            raise
    
    def invoke_agent_optimized(self, agent_id, session_id, input_text):
        """Invoke Bedrock agent with optimizations"""
        try:
            response = self.agent_client.invoke_agent(
                agentId=agent_id,
                agentAliasId='TSTALIASID',
                sessionId=session_id,
                inputText=input_text,
                # Enable streaming for better performance
                enableTrace=False
            )
            return response
        except Exception as e:
            logger.error(f"Error invoking Bedrock agent: {str(e)}")
            raise

# Global optimized clients
dynamodb_client = OptimizedDynamoDBClient()
timestream_client = OptimizedTimestreamClient()
bedrock_client = OptimizedBedrockClient()

def cleanup_connections():
    """Cleanup function to be called at the end of Lambda execution"""
    try:
        timestream_client.force_flush()
        logger.info("Cleaned up connections and flushed pending data")
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")

# Performance monitoring decorator
def monitor_performance(func):
    """Decorator to monitor function performance"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = (time.time() - start_time) * 1000
            logger.info(f"PERFORMANCE_METRIC {func.__name__} {execution_time:.2f}ms")
            return result
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            logger.error(f"PERFORMANCE_ERROR {func.__name__} {execution_time:.2f}ms {str(e)}")
            raise
    return wrapper

# Memory optimization utilities
class MemoryOptimizer:
    """Utilities for memory optimization in Lambda functions"""
    
    @staticmethod
    def clear_caches():
        """Clear all LRU caches to free memory"""
        dynamodb_client.get_table.cache_clear()
        bedrock_client.invoke_model_cached.cache_clear()
        logger.info("Cleared all caches to free memory")
    
    @staticmethod
    def get_memory_usage():
        """Get current memory usage statistics"""
        import psutil
        process = psutil.Process()
        memory_info = process.memory_info()
        return {
            'rss': memory_info.rss,
            'vms': memory_info.vms,
            'percent': process.memory_percent()
        }
    
    @staticmethod
    def optimize_for_memory():
        """Optimize Lambda function for memory usage"""
        # Clear caches if memory usage is high
        memory_usage = MemoryOptimizer.get_memory_usage()
        if memory_usage['percent'] > 80:
            MemoryOptimizer.clear_caches()
            logger.warning(f"High memory usage detected: {memory_usage['percent']:.1f}%")

memory_optimizer = MemoryOptimizer()