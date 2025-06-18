import { registerAs } from '@nestjs/config';

/**
 * Scheduler Configuration
 *
 * Provides configuration options for the scheduler service including:
 * - Job execution timeouts and retries
 * - Performance tuning parameters
 * - Cleanup and maintenance settings
 * - Development vs production configurations
 */
export default registerAs('scheduler', () => ({
  /**
   * Job execution settings
   */
  job: {
    // Maximum time a single job can run before being considered failed (in milliseconds)
    timeout: parseInt(process.env.SCHEDULER_JOB_TIMEOUT ?? '60000', 10), // 1 minute default

    // Maximum number of retry attempts for failed jobs
    maxRetries: parseInt(process.env.SCHEDULER_MAX_RETRIES ?? '3', 10),

    // Delay between retry attempts (in milliseconds)
    retryDelay: parseInt(process.env.SCHEDULER_RETRY_DELAY ?? '5000', 10), // 5 seconds default

    // Maximum number of concurrent jobs that can be executed
    maxConcurrentJobs: parseInt(
      process.env.SCHEDULER_MAX_CONCURRENT_JOBS ?? '50',
      10,
    ),
  },

  /**
   * Cleanup and maintenance settings
   */
  cleanup: {
    // Interval for cleaning up completed/failed jobs (in milliseconds)
    interval: parseInt(process.env.SCHEDULER_CLEANUP_INTERVAL ?? '300000', 10), // 5 minutes default

    // Maximum age of completed jobs before cleanup (in milliseconds)
    maxCompletedJobAge: parseInt(
      process.env.SCHEDULER_MAX_COMPLETED_JOB_AGE ?? '3600000',
      10,
    ), // 1 hour default

    // Maximum age of failed jobs before cleanup (in milliseconds)
    maxFailedJobAge: parseInt(
      process.env.SCHEDULER_MAX_FAILED_JOB_AGE ?? '86400000',
      10,
    ), // 24 hours default

    // Maximum number of job records to keep in memory
    maxJobHistory: parseInt(
      process.env.SCHEDULER_MAX_JOB_HISTORY ?? '1000',
      10,
    ),
  },

  /**
   * Performance and monitoring settings
   */
  performance: {
    // Enable detailed metrics collection (can impact performance)
    enableMetrics:
      process.env.SCHEDULER_ENABLE_METRICS === 'true' ||
      process.env.NODE_ENV === 'development',

    // Enable detailed logging for debugging
    enableDebugLogging:
      process.env.SCHEDULER_DEBUG_LOGGING === 'true' ||
      process.env.NODE_ENV === 'development',

    // Interval for metrics collection (in milliseconds)
    metricsInterval: parseInt(
      process.env.SCHEDULER_METRICS_INTERVAL ?? '30000',
      10,
    ), // 30 seconds default

    // Warning threshold for job execution time (in milliseconds)
    slowJobThreshold: parseInt(
      process.env.SCHEDULER_SLOW_JOB_THRESHOLD ?? '10000',
      10,
    ), // 10 seconds default
  },

  /**
   * Scheduling constraints and validation
   */
  constraints: {
    // Minimum time in advance a job can be scheduled (in milliseconds)
    minScheduleAdvance: parseInt(
      process.env.SCHEDULER_MIN_SCHEDULE_ADVANCE ?? '1000',
      10,
    ), // 1 second default

    // Maximum time in advance a job can be scheduled (in milliseconds)
    maxScheduleAdvance: parseInt(
      process.env.SCHEDULER_MAX_SCHEDULE_ADVANCE ?? '7776000000',
      10,
    ), // 90 days default

    // Allow scheduling jobs in the past (for recovery scenarios)
    allowPastScheduling: process.env.SCHEDULER_ALLOW_PAST_SCHEDULING === 'true',

    // Maximum number of jobs that can be scheduled for a single project
    maxJobsPerProject: parseInt(
      process.env.SCHEDULER_MAX_JOBS_PER_PROJECT ?? '100',
      10,
    ),
  },

  /**
   * Error handling and resilience settings
   */
  resilience: {
    // Enable circuit breaker for external service calls
    enableCircuitBreaker:
      process.env.SCHEDULER_ENABLE_CIRCUIT_BREAKER !== 'false', // enabled by default

    // Circuit breaker failure threshold (number of failures before opening)
    circuitBreakerThreshold: parseInt(
      process.env.SCHEDULER_CIRCUIT_BREAKER_THRESHOLD ?? '5',
      10,
    ),

    // Circuit breaker timeout (time to wait before trying again in milliseconds)
    circuitBreakerTimeout: parseInt(
      process.env.SCHEDULER_CIRCUIT_BREAKER_TIMEOUT ?? '60000',
      10,
    ), // 1 minute default

    // Enable graceful degradation when external services are unavailable
    enableGracefulDegradation:
      process.env.SCHEDULER_ENABLE_GRACEFUL_DEGRADATION !== 'false', // enabled by default
  },

  /**
   * Development and testing settings
   */
  development: {
    // Enable mock mode for testing (disables actual job execution)
    mockMode: process.env.SCHEDULER_MOCK_MODE === 'true',

    // Enable job simulation for load testing
    enableSimulation: process.env.SCHEDULER_ENABLE_SIMULATION === 'true',

    // Simulation job creation rate (jobs per second)
    simulationRate: parseInt(process.env.SCHEDULER_SIMULATION_RATE ?? '1', 10),

    // Enable additional validation in development mode
    strictValidation:
      process.env.SCHEDULER_STRICT_VALIDATION === 'true' ||
      process.env.NODE_ENV === 'development',
  },
}));
