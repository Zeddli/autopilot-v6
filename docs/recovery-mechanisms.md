# Recovery and Resilience Mechanisms

## Overview

The Autopilot-v6 service implements comprehensive recovery and resilience mechanisms to ensure reliable operation in production environments. This document details the recovery strategies, error handling approaches, and resilience patterns implemented in the system.

## Table of Contents

1. [Startup Recovery System](#startup-recovery-system)
2. [Error Handling and Resilience](#error-handling-and-resilience)
3. [Circuit Breaker Implementation](#circuit-breaker-implementation)
4. [Health Monitoring](#health-monitoring)
5. [Configuration and Tuning](#configuration-and-tuning)
6. [Troubleshooting Guide](#troubleshooting-guide)

## Startup Recovery System

### Architecture Overview

The startup recovery system ensures that the service can gracefully handle restarts, crashes, and network interruptions without losing scheduled phase transitions.

```
Service Startup
       │
       ▼
┌─────────────────┐
│ Recovery Service│
│   Initialization│
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  Scan Active    │
│     Phases      │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│   Phase         │
│ Classification  │
└─────────────────┘
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Upcoming   │  │   Overdue   │  │   Invalid   │
│   Phases    │  │   Phases    │  │   Phases    │
└─────────────┘  └─────────────┘  └─────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Schedule   │  │  Process    │  │    Skip     │
│   Future    │  │Immediately  │  │   & Log     │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Recovery Workflow

#### 1. Initialization Phase

The recovery service initializes during application startup:

```typescript
async executeStartupRecovery(): Promise<RecoveryResult> {
  const startTime = Date.now();
  const result: RecoveryResult = {
    status: RecoveryStatus.IN_PROGRESS,
    totalPhasesProcessed: 0,
    successfulPhases: 0,
    failedPhases: 0,
    upcomingPhasesScheduled: 0,
    overduePhasesProcessed: 0,
    executionTime: 0,
    timestamp: new Date().toISOString(),
    errors: [],
  };

  try {
    // Step 1: Scan for active phases
    const activePhases = await this.scanActivePhases();
    
    // Step 2: Classify phases
    const { upcomingPhases, overduePhases } = this.classifyPhases(activePhases);
    
    // Step 3: Process phases
    await this.processPhases(upcomingPhases, overduePhases, result);
    
    result.status = RecoveryStatus.COMPLETED;
  } catch (error) {
    this.handleRecoveryError(error, result);
  }

  result.executionTime = Date.now() - startTime;
  return result;
}
```

#### 2. Active Phase Scanning

The system scans for active phases that require scheduling:

```typescript
async scanActivePhases(): Promise<RecoveryPhaseDto[]> {
  if (this.configService.get<boolean>('recovery.challengeService.mockMode')) {
    return this.getMockPhases();
  }

  try {
    // In production, this would call the actual challenge service
    const phases = await this.challengeService.getActivePhases();
    return this.filterPhases(phases);
  } catch (error) {
    this.logger.error('Failed to scan active phases', error, 'RecoveryService');
    throw new Error('Challenge service unavailable');
  }
}
```

#### 3. Phase Classification

Phases are classified based on their end times:

```typescript
private classifyPhases(phases: RecoveryPhaseDto[]): {
  upcomingPhases: RecoveryPhaseDto[];
  overduePhases: RecoveryPhaseDto[];
} {
  const now = new Date();
  const upcomingPhases: RecoveryPhaseDto[] = [];
  const overduePhases: RecoveryPhaseDto[] = [];

  for (const phase of phases) {
    if (this.isPhaseOverdue(phase)) {
      overduePhases.push(phase);
    } else {
      upcomingPhases.push(phase);
    }
  }

  return { upcomingPhases, overduePhases };
}
```

#### 4. Batch Processing

For performance and reliability, phases are processed in configurable batches:

```typescript
async scheduleUpcomingTransitions(phases: RecoveryPhaseDto[]): Promise<void> {
  const batchSize = this.configService.get<number>('recovery.batch.maxBatchSize');
  const maxConcurrent = this.configService.get<number>('recovery.phases.maxConcurrentPhases');

  for (let i = 0; i < phases.length; i += batchSize) {
    const batch = phases.slice(i, i + batchSize);
    
    // Process batch with concurrency control
    const semaphore = new Semaphore(maxConcurrent);
    const promises = batch.map(phase => 
      semaphore.acquire().then(async (release) => {
        try {
          return await this.schedulePhase(phase);
        } finally {
          release();
        }
      })
    );

    await Promise.all(promises);
  }
}
```

### Recovery Strategies

#### 1. Immediate Processing for Overdue Phases

Phases that should have already transitioned are processed immediately:

```typescript
async processOverduePhases(phases: RecoveryPhaseDto[]): Promise<void> {
  if (!this.configService.get<boolean>('recovery.phases.processOverduePhases')) {
    this.logger.log('Skipping overdue phase processing (disabled)', 'RecoveryService');
    return;
  }

  for (const phase of phases) {
    try {
      // Schedule for immediate execution
      const scheduleData: PhaseTransitionScheduleDto = {
        ...phase,
        scheduledTime: new Date().toISOString(), // Now
        metadata: {
          ...phase.metadata,
          originalEndTime: phase.endTime,
          processedAsOverdue: true,
        },
      };

      await this.schedulerService.schedulePhaseTransition(scheduleData);
      this.logger.log(`Processed overdue phase: ${phase.projectId}/${phase.phaseId}`, 'RecoveryService');
    } catch (error) {
      this.logger.error(`Failed to process overdue phase: ${phase.projectId}/${phase.phaseId}`, error, 'RecoveryService');
      throw error;
    }
  }
}
```

#### 2. Future Scheduling for Upcoming Phases

Phases with future end times are scheduled normally:

```typescript
private async schedulePhase(phase: RecoveryPhaseDto): Promise<void> {
  try {
    this.validatePhaseData(phase);

    const scheduleData: PhaseTransitionScheduleDto = {
      projectId: phase.projectId,
      phaseId: phase.phaseId,
      phaseTypeName: phase.phaseTypeName,
      state: phase.state,
      scheduledTime: phase.endTime,
      operator: phase.operator,
      projectStatus: phase.projectStatus,
      metadata: {
        ...phase.metadata,
        source: 'recovery',
      },
    };

    const jobId = await this.schedulerService.schedulePhaseTransition(scheduleData);
    this.logger.debug(`Scheduled phase: ${phase.projectId}/${phase.phaseId} -> ${jobId}`, 'RecoveryService');
  } catch (error) {
    this.logger.error(`Failed to schedule phase: ${phase.projectId}/${phase.phaseId}`, error, 'RecoveryService');
    throw error;
  }
}
```

#### 3. Data Validation and Filtering

Comprehensive validation ensures data integrity:

```typescript
private validatePhaseData(phase: RecoveryPhaseDto): void {
  if (!phase.projectId || phase.projectId <= 0) {
    throw new Error('Invalid project ID');
  }

  if (!phase.phaseId || phase.phaseId <= 0) {
    throw new Error('Invalid phase ID');
  }

  if (!phase.phaseTypeName || phase.phaseTypeName.trim() === '') {
    throw new Error('Phase type name cannot be empty');
  }

  if (!phase.endTime || isNaN(new Date(phase.endTime).getTime())) {
    throw new Error('Invalid end time format');
  }

  // Additional business logic validation
  const endTime = new Date(phase.endTime);
  const maxAge = this.configService.get<number>('recovery.phases.maxPhaseAge');
  const cutoffTime = new Date(Date.now() - (maxAge * 60 * 60 * 1000));

  if (endTime < cutoffTime) {
    throw new Error(`Phase is too old (older than ${maxAge} hours)`);
  }
}
```

## Error Handling and Resilience

### Error Categories

#### 1. Transient Errors

Temporary failures that may resolve automatically:

- Network timeouts
- Service temporarily unavailable
- Rate limiting
- Database connection issues

**Handling Strategy**: Automatic retry with exponential backoff

```typescript
async executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await this.sleep(delay);
      
      this.logger.warn(
        `Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`,
        'RecoveryService'
      );
    }
  }

  throw lastError;
}
```

#### 2. Permanent Errors

Errors that won't resolve automatically:

- Invalid data format
- Authentication failures
- Configuration errors
- Business logic violations

**Handling Strategy**: Immediate failure with detailed logging

```typescript
private handlePermanentError(error: Error, context: string): void {
  this.logger.error(`Permanent error in ${context}`, error, 'RecoveryService');
  
  // Report to monitoring systems
  this.metricsService.incrementCounter('recovery.permanent_errors', {
    context,
    errorType: error.constructor.name,
  });
  
  // Don't retry permanent errors
  throw error;
}
```

#### 3. Partial Failures

Some operations succeed while others fail:

**Handling Strategy**: Continue processing, track failures, report summary

```typescript
async processWithPartialFailureHandling<T>(
  items: T[],
  processor: (item: T) => Promise<void>
): Promise<{ successful: number; failed: number; errors: Error[] }> {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as Error[],
  };

  for (const item of items) {
    try {
      await processor(item);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push(error);
      
      // Continue processing other items
      this.logger.warn(`Item processing failed, continuing with others`, error, 'RecoveryService');
    }
  }

  return results;
}
```

### Timeout Management

Configurable timeouts prevent hanging operations:

```typescript
async executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}
```

## Circuit Breaker Implementation

### Three-State Circuit Breaker

The system implements a sophisticated circuit breaker with three states:

```typescript
enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, blocking requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}
```

#### State Transitions

```
     ┌─────────────┐
     │   CLOSED    │ ◄──── Success threshold met
     │  (Normal)   │
     └─────────────┘
           │
           │ Failure threshold exceeded
           ▼
     ┌─────────────┐
     │    OPEN     │
     │ (Blocking)  │
     └─────────────┘
           │
           │ Reset timeout elapsed
           ▼
     ┌─────────────┐
     │ HALF_OPEN   │ ──────► Back to OPEN if failure
     │ (Testing)   │         Back to CLOSED if success
     └─────────────┘
```

#### Implementation

```typescript
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.successCount = 0;
    }
  }
}
```

### Service-Specific Circuit Breakers

Different services have tailored circuit breaker configurations:

```typescript
// Factory for creating service-specific circuit breakers
export class CircuitBreakerFactory {
  static createSchedulerCircuitBreaker(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      successThreshold: 3,
      timeoutMs: 30000,
      name: 'scheduler',
    });
  }

  static createRecoveryCircuitBreaker(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 120000,
      successThreshold: 2,
      timeoutMs: 45000,
      name: 'recovery',
    });
  }

  static createChallengeServiceCircuitBreaker(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      successThreshold: 2,
      timeoutMs: 15000,
      name: 'challenge-service',
      fallback: () => this.getCachedChallengeData(),
    });
  }
}
```

## Health Monitoring

### Health Indicators

The system provides comprehensive health monitoring:

#### 1. Scheduler Health

```typescript
@Injectable()
export class SchedulerHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const health = {
      activeJobs: await this.getActiveJobCount(),
      scheduledJobs: await this.getScheduledJobCount(),
      failedJobs: await this.getFailedJobCount(),
      lastJobExecution: await this.getLastJobExecutionTime(),
      responsiveness: await this.testResponsiveness(),
    };

    const isHealthy = 
      health.activeJobs < this.maxActiveJobs &&
      health.responsiveness < this.maxResponseTime;

    return this.getStatus(key, isHealthy, health);
  }
}
```

#### 2. Recovery Health

```typescript
@Injectable()
export class RecoveryHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const health = {
      lastRecoveryStatus: this.getLastRecoveryStatus(),
      lastRecoveryTime: this.getLastRecoveryTime(),
      totalRecoveries: this.getTotalRecoveryCount(),
      successRate: this.getRecoverySuccessRate(),
      challengeServiceAvailable: await this.testChallengeService(),
    };

    const isHealthy = 
      health.successRate > 0.95 && // 95% success rate
      health.challengeServiceAvailable;

    return this.getStatus(key, isHealthy, health);
  }
}
```

### Health Endpoints

Multiple health endpoints provide different levels of detail:

```typescript
@Controller('health')
export class HealthController {
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.schedulerHealth.isHealthy('scheduler'),
      () => this.recoveryHealth.isHealthy('recovery'),
      () => this.kafkaHealth.isHealthy('kafka'),
    ]);
  }

  @Get('scheduler')
  @HealthCheck()
  checkScheduler() {
    return this.health.check([
      () => this.schedulerHealth.isHealthy('scheduler'),
    ]);
  }

  @Get('recovery')
  @HealthCheck()
  checkRecovery() {
    return this.health.check([
      () => this.recoveryHealth.isHealthy('recovery'),
    ]);
  }

  @Get('all')
  @HealthCheck()
  checkAll() {
    return this.health.check([
      () => this.schedulerHealth.isHealthy('scheduler'),
      () => this.recoveryHealth.isHealthy('recovery'),
      () => this.kafkaHealth.isHealthy('kafka'),
    ]);
  }
}
```

## Configuration and Tuning

### Recovery Configuration

```typescript
// Configuration interface
export interface RecoveryConfig {
  startup: {
    enabled: boolean;
    timeout: number;
  };
  phases: {
    maxConcurrentPhases: number;
    phaseOperationTimeout: number;
    processOverduePhases: boolean;
    skipInvalidPhases: boolean;
    maxPhaseAge: number;
  };
  batch: {
    maxBatchSize: number;
    batchDelay: number;
  };
  challengeService: {
    timeout: number;
    retries: number;
    mockMode: boolean;
  };
  monitoring: {
    enableDebugLogging: boolean;
    enableMetrics: boolean;
  };
}
```

### Environment Variables

```bash
# Recovery Configuration
RECOVERY_ENABLED=true
RECOVERY_STARTUP_TIMEOUT=120000
RECOVERY_MAX_CONCURRENT_PHASES=10
RECOVERY_PHASE_TIMEOUT=30000
RECOVERY_PROCESS_OVERDUE_PHASES=true
RECOVERY_SKIP_INVALID_PHASES=true
RECOVERY_MAX_PHASE_AGE_HOURS=72
RECOVERY_MAX_BATCH_SIZE=50
RECOVERY_BATCH_DELAY=100
RECOVERY_CHALLENGE_SERVICE_TIMEOUT=15000
RECOVERY_CHALLENGE_SERVICE_RETRIES=3
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=false
RECOVERY_ENABLE_DEBUG_LOGGING=true
RECOVERY_ENABLE_METRICS=true
```

### Performance Tuning Guidelines

#### Memory Optimization

```typescript
// Configurable cleanup intervals
const cleanupConfig = {
  completedJobRetention: 3600000,  // 1 hour
  failedJobRetention: 86400000,    // 24 hours
  cleanupInterval: 300000,         // 5 minutes
};
```

#### Concurrency Control

```typescript
// Semaphore for controlling concurrent operations
class Semaphore {
  constructor(private permits: number) {}

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.permits++);
      } else {
        // Queue the request
        this.queue.push(() => {
          this.permits--;
          resolve(() => this.permits++);
        });
      }
    });
  }
}
```

## Troubleshooting Guide

### Common Recovery Issues

#### 1. Recovery Timeout

**Symptoms**: Recovery process times out during startup
**Causes**:
- Challenge service slow response
- Large number of phases to process
- Network connectivity issues

**Resolution**:
```bash
# Increase timeout
RECOVERY_STARTUP_TIMEOUT=300000  # 5 minutes

# Reduce batch size
RECOVERY_MAX_BATCH_SIZE=25

# Enable debug logging
RECOVERY_ENABLE_DEBUG_LOGGING=true
```

#### 2. High Failure Rate

**Symptoms**: Recovery success rate below 95%
**Causes**:
- Invalid phase data
- Challenge service instability
- Configuration issues

**Resolution**:
```bash
# Enable invalid phase skipping
RECOVERY_SKIP_INVALID_PHASES=true

# Increase retries
RECOVERY_CHALLENGE_SERVICE_RETRIES=5

# Reduce concurrent processing
RECOVERY_MAX_CONCURRENT_PHASES=5
```

#### 3. Memory Issues

**Symptoms**: High memory usage during recovery
**Causes**:
- Large batch sizes
- Memory leaks in processing
- Insufficient cleanup

**Resolution**:
```bash
# Reduce batch size
RECOVERY_MAX_BATCH_SIZE=10

# Add batch delay
RECOVERY_BATCH_DELAY=500

# Monitor memory usage
NODE_OPTIONS="--max-old-space-size=2048"
```

### Diagnostic Commands

#### Health Checks

```bash
# Overall health
curl http://localhost:3000/health

# Recovery specific
curl http://localhost:3000/health/recovery

# Detailed health with metrics
curl http://localhost:3000/health/all
```

#### Log Analysis

```bash
# Recovery operations
grep "RecoveryService" logs/application.log | tail -100

# Error patterns
grep "ERROR.*Recovery" logs/application.log

# Performance metrics
grep "Recovery completed.*ms" logs/application.log
```

#### Metrics Monitoring

```typescript
// Custom metrics for monitoring
this.metricsService.recordHistogram('recovery.execution_time', executionTime);
this.metricsService.incrementCounter('recovery.phases_processed', result.totalPhasesProcessed);
this.metricsService.setGauge('recovery.success_rate', result.successfulPhases / result.totalPhasesProcessed);
```

### Emergency Procedures

#### 1. Recovery Failure

If recovery completely fails:

```bash
# Disable recovery temporarily
RECOVERY_ENABLED=false

# Restart service
npm run start

# Enable mock mode for testing
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=true

# Re-enable with reduced load
RECOVERY_MAX_CONCURRENT_PHASES=1
RECOVERY_MAX_BATCH_SIZE=5
```

#### 2. Challenge Service Unavailable

If challenge service is down:

```bash
# Enable mock mode
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=true

# Restart service
npm run start

# Monitor for service recovery
# Re-enable real mode when service is available
```

#### 3. Performance Degradation

If recovery is too slow:

```bash
# Reduce processing load
RECOVERY_MAX_CONCURRENT_PHASES=5
RECOVERY_MAX_BATCH_SIZE=10

# Increase timeouts
RECOVERY_PHASE_TIMEOUT=60000

# Skip old phases
RECOVERY_MAX_PHASE_AGE_HOURS=24
```

This comprehensive recovery and resilience documentation ensures that operators can effectively manage, monitor, and troubleshoot the Autopilot-v6 service in production environments. 