import { registerAs } from '@nestjs/config';

/**
 * Recovery Configuration
 *
 * Provides configuration options for the recovery service including:
 * - Startup recovery behavior
 * - Phase scanning and processing settings
 * - Retry and timeout configurations
 * - Challenge service integration settings
 */
export default registerAs('recovery', () => ({
  /**
   * Startup recovery settings
   */
  startup: {
    // Enable automatic recovery on application startup
    enabled: process.env.RECOVERY_ENABLED !== 'false', // enabled by default

    // Maximum time to wait for recovery completion before continuing startup (in milliseconds)
    timeout: parseInt(process.env.RECOVERY_STARTUP_TIMEOUT ?? '120000', 10), // 2 minutes default

    // Whether to fail application startup if recovery fails
    failOnError: process.env.RECOVERY_FAIL_ON_ERROR === 'true',

    // Delay before starting recovery (allows other services to initialize)
    startupDelay: parseInt(process.env.RECOVERY_STARTUP_DELAY ?? '5000', 10), // 5 seconds default
  },

  /**
   * Phase scanning and processing settings
   */
  phases: {
    // Maximum number of phases to process concurrently
    maxConcurrentPhases: parseInt(
      process.env.RECOVERY_MAX_CONCURRENT_PHASES ?? '10',
      10,
    ),

    // Timeout for individual phase operations (in milliseconds)
    phaseOperationTimeout: parseInt(
      process.env.RECOVERY_PHASE_TIMEOUT ?? '30000',
      10,
    ), // 30 seconds default

    // Whether to process overdue phases immediately
    processOverduePhases: process.env.RECOVERY_PROCESS_OVERDUE !== 'false', // enabled by default

    // Whether to skip phases with invalid data
    skipInvalidPhases: process.env.RECOVERY_SKIP_INVALID !== 'false', // enabled by default

    // Maximum age of phases to consider for recovery (in hours)
    maxPhaseAge: parseInt(process.env.RECOVERY_MAX_PHASE_AGE_HOURS ?? '72', 10), // 3 days default

    // Minimum time gap between phase end time and current time to schedule (in milliseconds)
    minScheduleGap: parseInt(
      process.env.RECOVERY_MIN_SCHEDULE_GAP ?? '60000',
      10,
    ), // 1 minute default
  },

  /**
   * Challenge service integration settings
   */
  challengeService: {
    // Base URL for challenge service API
    baseUrl: process.env.CHALLENGE_SERVICE_URL || 'http://localhost:3001',

    // API timeout for challenge service calls (in milliseconds)
    timeout: parseInt(process.env.CHALLENGE_SERVICE_TIMEOUT ?? '30000', 10), // 30 seconds default

    // Maximum number of retry attempts for failed API calls
    maxRetries: parseInt(process.env.CHALLENGE_SERVICE_MAX_RETRIES ?? '3', 10),

    // Delay between retry attempts (in milliseconds)
    retryDelay: parseInt(
      process.env.CHALLENGE_SERVICE_RETRY_DELAY ?? '2000',
      10,
    ), // 2 seconds default

    // Enable mock mode for testing (uses mock data instead of API calls)
    mockMode: process.env.CHALLENGE_SERVICE_MOCK_MODE === 'true',
  },

  /**
   * Batch processing settings
   */
  batch: {
    // Maximum number of phases to process in a single batch
    maxBatchSize: parseInt(process.env.RECOVERY_MAX_BATCH_SIZE ?? '50', 10),

    // Delay between processing batches (in milliseconds)
    batchDelay: parseInt(process.env.RECOVERY_BATCH_DELAY ?? '1000', 10), // 1 second default

    // Maximum number of batches to process concurrently
    maxConcurrentBatches: parseInt(
      process.env.RECOVERY_MAX_CONCURRENT_BATCHES ?? '3',
      10,
    ),

    // Enable batch processing optimization
    enableOptimization:
      process.env.RECOVERY_ENABLE_BATCH_OPTIMIZATION !== 'false', // enabled by default
  },

  /**
   * Error handling and resilience settings
   */
  resilience: {
    // Enable circuit breaker for challenge service calls
    enableCircuitBreaker:
      process.env.RECOVERY_ENABLE_CIRCUIT_BREAKER !== 'false', // enabled by default

    // Circuit breaker failure threshold
    circuitBreakerThreshold: parseInt(
      process.env.RECOVERY_CIRCUIT_BREAKER_THRESHOLD ?? '5',
      10,
    ),

    // Circuit breaker timeout (in milliseconds)
    circuitBreakerTimeout: parseInt(
      process.env.RECOVERY_CIRCUIT_BREAKER_TIMEOUT ?? '60000',
      10,
    ), // 1 minute default

    // Enable graceful degradation when external services fail
    enableGracefulDegradation:
      process.env.RECOVERY_ENABLE_GRACEFUL_DEGRADATION !== 'false', // enabled by default

    // Maximum number of consecutive failures before stopping recovery
    maxConsecutiveFailures: parseInt(
      process.env.RECOVERY_MAX_CONSECUTIVE_FAILURES ?? '10',
      10,
    ),
  },

  /**
   * Monitoring and metrics settings
   */
  monitoring: {
    // Enable detailed recovery metrics collection
    enableMetrics: process.env.RECOVERY_ENABLE_METRICS !== 'false', // enabled by default

    // Interval for metrics updates (in milliseconds)
    metricsInterval: parseInt(
      process.env.RECOVERY_METRICS_INTERVAL ?? '30000',
      10,
    ), // 30 seconds default

    // Enable detailed logging for debugging
    enableDebugLogging:
      process.env.RECOVERY_DEBUG_LOGGING === 'true' ||
      process.env.NODE_ENV === 'development',

    // Log recovery progress every N phases processed
    progressLogInterval: parseInt(
      process.env.RECOVERY_PROGRESS_LOG_INTERVAL ?? '10',
      10,
    ),

    // Enable health check endpoint for recovery status
    enableHealthCheck: process.env.RECOVERY_ENABLE_HEALTH_CHECK !== 'false', // enabled by default
  },

  /**
   * Data filtering and validation settings
   */
  filtering: {
    // Allowed phase states for recovery
    allowedPhaseStates: process.env.RECOVERY_ALLOWED_PHASE_STATES?.split(
      ',',
    ) || ['START', 'END'],

    // Allowed project statuses for recovery
    allowedProjectStatuses:
      process.env.RECOVERY_ALLOWED_PROJECT_STATUSES?.split(',') || [
        'ACTIVE',
        'DRAFT',
      ],

    // Minimum project ID to consider (for filtering test data)
    minProjectId: parseInt(process.env.RECOVERY_MIN_PROJECT_ID ?? '1', 10),

    // Maximum project ID to consider (for filtering test data)
    maxProjectId: parseInt(
      process.env.RECOVERY_MAX_PROJECT_ID ?? '999999999',
      10,
    ),

    // Enable strict validation of phase data
    enableStrictValidation:
      process.env.RECOVERY_ENABLE_STRICT_VALIDATION === 'true' ||
      process.env.NODE_ENV === 'development',
  },

  /**
   * Performance optimization settings
   */
  performance: {
    // Enable caching of challenge service responses
    enableCaching: process.env.RECOVERY_ENABLE_CACHING !== 'false', // enabled by default

    // Cache TTL for challenge service responses (in milliseconds)
    cacheTtl: parseInt(process.env.RECOVERY_CACHE_TTL ?? '300000', 10), // 5 minutes default

    // Maximum cache size (number of entries)
    maxCacheSize: parseInt(process.env.RECOVERY_MAX_CACHE_SIZE ?? '1000', 10),

    // Enable parallel processing of phases
    enableParallelProcessing:
      process.env.RECOVERY_ENABLE_PARALLEL_PROCESSING !== 'false', // enabled by default

    // Memory usage warning threshold (in MB)
    memoryWarningThreshold: parseInt(
      process.env.RECOVERY_MEMORY_WARNING_THRESHOLD ?? '512',
      10,
    ),
  },
}));
