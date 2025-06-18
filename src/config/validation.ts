import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // App Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_DIR: Joi.string().default('logs'),

  // Kafka Configuration
  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('autopilot-service'),
  KAFKA_MAX_RETRY_TIME: Joi.number().default(30000),
  KAFKA_INITIAL_RETRY_TIME: Joi.number().default(300),
  KAFKA_RETRIES: Joi.number().default(5),

  // Schema Registry Configuration
  SCHEMA_REGISTRY_URL: Joi.string().required(),
  SCHEMA_REGISTRY_USER: Joi.string().optional(),
  SCHEMA_REGISTRY_PASSWORD: Joi.string().optional(),

  // Scheduler Configuration
  SCHEDULER_JOB_TIMEOUT: Joi.number().min(1000).max(300000).default(60000),
  SCHEDULER_MAX_RETRIES: Joi.number().min(0).max(10).default(3),
  SCHEDULER_RETRY_DELAY: Joi.number().min(100).max(60000).default(5000),
  SCHEDULER_MAX_CONCURRENT_JOBS: Joi.number().min(1).max(1000).default(50),
  SCHEDULER_CLEANUP_INTERVAL: Joi.number().min(60000).default(300000),
  SCHEDULER_MAX_COMPLETED_JOB_AGE: Joi.number().min(60000).default(3600000),
  SCHEDULER_MAX_FAILED_JOB_AGE: Joi.number().min(60000).default(86400000),
  SCHEDULER_MAX_JOB_HISTORY: Joi.number().min(100).max(10000).default(1000),
  SCHEDULER_ENABLE_METRICS: Joi.boolean().default(false),
  SCHEDULER_DEBUG_LOGGING: Joi.boolean().default(false),
  SCHEDULER_METRICS_INTERVAL: Joi.number().min(5000).default(30000),
  SCHEDULER_SLOW_JOB_THRESHOLD: Joi.number().min(1000).default(10000),
  SCHEDULER_MIN_SCHEDULE_ADVANCE: Joi.number().min(0).default(1000),
  SCHEDULER_MAX_SCHEDULE_ADVANCE: Joi.number().min(3600000).default(7776000000),
  SCHEDULER_ALLOW_PAST_SCHEDULING: Joi.boolean().default(false),
  SCHEDULER_MAX_JOBS_PER_PROJECT: Joi.number().min(1).max(1000).default(100),
  SCHEDULER_ENABLE_CIRCUIT_BREAKER: Joi.boolean().default(true),
  SCHEDULER_CIRCUIT_BREAKER_THRESHOLD: Joi.number().min(1).max(20).default(5),
  SCHEDULER_CIRCUIT_BREAKER_TIMEOUT: Joi.number().min(10000).default(60000),
  SCHEDULER_ENABLE_GRACEFUL_DEGRADATION: Joi.boolean().default(true),
  SCHEDULER_MOCK_MODE: Joi.boolean().default(false),
  SCHEDULER_ENABLE_SIMULATION: Joi.boolean().default(false),
  SCHEDULER_SIMULATION_RATE: Joi.number().min(0.1).max(100).default(1),
  SCHEDULER_STRICT_VALIDATION: Joi.boolean().default(false),

  // Recovery Configuration
  RECOVERY_ENABLED: Joi.boolean().default(true),
  RECOVERY_STARTUP_TIMEOUT: Joi.number().min(30000).max(600000).default(120000),
  RECOVERY_FAIL_ON_ERROR: Joi.boolean().default(false),
  RECOVERY_STARTUP_DELAY: Joi.number().min(0).max(30000).default(5000),
  RECOVERY_MAX_CONCURRENT_PHASES: Joi.number().min(1).max(100).default(10),
  RECOVERY_PHASE_TIMEOUT: Joi.number().min(5000).max(120000).default(30000),
  RECOVERY_PROCESS_OVERDUE: Joi.boolean().default(true),
  RECOVERY_SKIP_INVALID: Joi.boolean().default(true),
  RECOVERY_MAX_PHASE_AGE_HOURS: Joi.number().min(1).max(8760).default(72),
  RECOVERY_MIN_SCHEDULE_GAP: Joi.number().min(0).default(60000),
  CHALLENGE_SERVICE_URL: Joi.string().uri().default('http://localhost:3001'),
  CHALLENGE_SERVICE_TIMEOUT: Joi.number().min(5000).max(120000).default(30000),
  CHALLENGE_SERVICE_MAX_RETRIES: Joi.number().min(0).max(10).default(3),
  CHALLENGE_SERVICE_RETRY_DELAY: Joi.number().min(100).max(10000).default(2000),
  CHALLENGE_SERVICE_MOCK_MODE: Joi.boolean().default(false),
  RECOVERY_MAX_BATCH_SIZE: Joi.number().min(1).max(1000).default(50),
  RECOVERY_BATCH_DELAY: Joi.number().min(0).max(10000).default(1000),
  RECOVERY_MAX_CONCURRENT_BATCHES: Joi.number().min(1).max(20).default(3),
  RECOVERY_ENABLE_BATCH_OPTIMIZATION: Joi.boolean().default(true),
  RECOVERY_ENABLE_CIRCUIT_BREAKER: Joi.boolean().default(true),
  RECOVERY_CIRCUIT_BREAKER_THRESHOLD: Joi.number().min(1).max(20).default(5),
  RECOVERY_CIRCUIT_BREAKER_TIMEOUT: Joi.number().min(10000).default(60000),
  RECOVERY_ENABLE_GRACEFUL_DEGRADATION: Joi.boolean().default(true),
  RECOVERY_MAX_CONSECUTIVE_FAILURES: Joi.number().min(1).max(100).default(10),
  RECOVERY_ENABLE_METRICS: Joi.boolean().default(true),
  RECOVERY_METRICS_INTERVAL: Joi.number().min(5000).default(30000),
  RECOVERY_DEBUG_LOGGING: Joi.boolean().default(false),
  RECOVERY_PROGRESS_LOG_INTERVAL: Joi.number().min(1).max(100).default(10),
  RECOVERY_ENABLE_HEALTH_CHECK: Joi.boolean().default(true),
  RECOVERY_ALLOWED_PHASE_STATES: Joi.string().default('START,END'),
  RECOVERY_ALLOWED_PROJECT_STATUSES: Joi.string().default('ACTIVE,DRAFT'),
  RECOVERY_MIN_PROJECT_ID: Joi.number().min(1).default(1),
  RECOVERY_MAX_PROJECT_ID: Joi.number().min(1).default(999999999),
  RECOVERY_ENABLE_STRICT_VALIDATION: Joi.boolean().default(false),
  RECOVERY_ENABLE_CACHING: Joi.boolean().default(true),
  RECOVERY_CACHE_TTL: Joi.number().min(60000).default(300000),
  RECOVERY_MAX_CACHE_SIZE: Joi.number().min(100).max(10000).default(1000),
  RECOVERY_ENABLE_PARALLEL_PROCESSING: Joi.boolean().default(true),
  RECOVERY_MEMORY_WARNING_THRESHOLD: Joi.number()
    .min(128)
    .max(4096)
    .default(512),
});
