export interface AppConfig {
  DEFAULT_PORT: number;
  DEFAULT_NODE_ENV: 'development' | 'production' | 'test';
  DEFAULT_LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  DEFAULT_LOG_DIR: string;
}

export interface KafkaConfig {
  DEFAULT_CLIENT_ID: string;
  DEFAULT_BROKERS: string[];
  DEFAULT_MAX_RETRY_TIME: number;
  DEFAULT_INITIAL_RETRY_TIME: number;
  DEFAULT_RETRIES: number;
  DEFAULT_MAX_WAIT_TIME: number;
  DEFAULT_MAX_BYTES: number;
  DEFAULT_AUTO_COMMIT_INTERVAL: number;
  DEFAULT_AUTO_COMMIT_THRESHOLD: number;
  DEFAULT_PARTITIONS_CONCURRENTLY: number;
  DEFAULT_CONCURRENCY_LIMIT: number;
  DEFAULT_TRANSACTION_TIMEOUT: number;
  DEFAULT_MAX_IN_FLIGHT_REQUESTS: number;
}

export interface SchemaConfig {
  DEFAULT_CACHE_TTL: number;
  DEFAULT_SUBJECT_SUFFIX: string;
}

export interface CircuitBreakerConfig {
  DEFAULT_FAILURE_THRESHOLD: number;
  DEFAULT_RESET_TIMEOUT: number;
}

export interface HealthConfig {
  DEFAULT_TIMEOUT: number;
  DEFAULT_INTERVAL: number;
  DEFAULT_RETRIES: number;
}

export interface Config {
  APP: AppConfig;
  KAFKA: KafkaConfig;
  SCHEMA: SchemaConfig;
  CIRCUIT_BREAKER: CircuitBreakerConfig;
  HEALTH: HealthConfig;
}

export const CONFIG: Config = {
  APP: {
    DEFAULT_PORT: 3000,
    DEFAULT_NODE_ENV: 'development',
    DEFAULT_LOG_LEVEL: 'info',
    DEFAULT_LOG_DIR: 'logs',
  },
  KAFKA: {
    DEFAULT_CLIENT_ID: 'autopilot-service',
    DEFAULT_BROKERS: ['localhost:29092'],
    DEFAULT_MAX_RETRY_TIME: 30000,
    DEFAULT_INITIAL_RETRY_TIME: 300,
    DEFAULT_RETRIES: 5,
    DEFAULT_MAX_WAIT_TIME: 100,
    DEFAULT_MAX_BYTES: 5242880,
    DEFAULT_AUTO_COMMIT_INTERVAL: 5000,
    DEFAULT_AUTO_COMMIT_THRESHOLD: 100,
    DEFAULT_PARTITIONS_CONCURRENTLY: 3,
    DEFAULT_CONCURRENCY_LIMIT: 5,
    DEFAULT_TRANSACTION_TIMEOUT: 30000,
    DEFAULT_MAX_IN_FLIGHT_REQUESTS: 5,
  },
  SCHEMA: {
    DEFAULT_CACHE_TTL: 3600000, // 1 hour in milliseconds
    DEFAULT_SUBJECT_SUFFIX: '-value',
  },
  CIRCUIT_BREAKER: {
    DEFAULT_FAILURE_THRESHOLD: 5,
    DEFAULT_RESET_TIMEOUT: 60000,
  },
  HEALTH: {
    DEFAULT_TIMEOUT: 5000,
    DEFAULT_INTERVAL: 30000,
    DEFAULT_RETRIES: 3,
  },
} as const;
