# Recovery Scenario Examples

## Overview

This document demonstrates various recovery scenarios in the Autopilot-v6 service, showing how the system handles failures, restarts, and edge cases while maintaining scheduled phase transitions.

## Scenario 1: Startup Recovery After Service Restart

### Context

The Autopilot-v6 service was running with several scheduled phase transitions when it unexpectedly crashed. Upon restart, the recovery system must identify and reschedule any missed or upcoming phase transitions.

### Initial State Before Crash

```typescript
// Active jobs before service crash at 2024-01-15T08:00:00Z
const preRestartJobs = [
  {
    jobId: "job-1705140000000-12345-67890",
    projectId: 12345,
    phaseId: 67890,
    scheduledTime: "2024-01-15T10:00:00Z", // 2 hours from now
    status: "scheduled"
  },
  {
    jobId: "job-1705141800000-12346-67891", 
    projectId: 12346,
    phaseId: 67891,
    scheduledTime: "2024-01-15T07:30:00Z", // 30 minutes ago (OVERDUE)
    status: "scheduled"
  },
  {
    jobId: "job-1705776000000-12347-67892",
    projectId: 12347,
    phaseId: 67892,
    scheduledTime: "2024-01-20T18:00:00Z", // 5 days from now
    status: "scheduled"
  }
];
```

### Step 1: Service Restart and Recovery Initialization

```typescript
// main.ts - Recovery execution on startup
async function bootstrap() {
  const app = await NestApplicationFactory.create(AppModule);
  
  // Initialize recovery service
  const recoveryService = app.get(RecoveryService);
  
  try {
    console.log('Starting Autopilot-v6 service...');
    
    // Execute startup recovery
    const recoveryResult = await recoveryService.executeStartupRecovery();
    
    console.log('Recovery completed:', recoveryResult);
    
    await app.listen(3000);
    console.log('Service started successfully');
    
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

bootstrap();
```

### Step 2: Active Phase Scanning

```typescript
// RecoveryService.scanActivePhases()
async scanActivePhases(): Promise<RecoveryPhaseDto[]> {
  this.logger.log('Scanning for active phases requiring recovery', 'RecoveryService');

  try {
    // In production, this would call the challenge service
    // For this example, we simulate the response
    const activePhases = await this.challengeService.getActivePhasesForRecovery();
    
    this.logger.log(`Found ${activePhases.length} active phases`, 'RecoveryService');
    
    // Apply filtering based on configuration
    const filteredPhases = this.filterPhases(activePhases, {
      maxAgeHours: this.configService.get<number>('recovery.phases.maxPhaseAge'),
      allowedProjectStatuses: ['ACTIVE', 'DRAFT'],
      allowedPhaseStates: ['START', 'SCHEDULED'],
    });

    this.logger.log(`${filteredPhases.length} phases after filtering`, 'RecoveryService');
    
    return filteredPhases;

  } catch (error) {
    this.logger.error('Failed to scan active phases', error, 'RecoveryService');
    throw new Error('Challenge service unavailable during recovery');
  }
}

// Simulated challenge service response
private async getMockActivePhasesForRecovery(): Promise<RecoveryPhaseDto[]> {
  return [
    {
      projectId: 12345,
      phaseId: 67890,
      phaseTypeName: 'Registration',
      state: 'START',
      endTime: '2024-01-15T10:00:00.000Z', // Future - needs scheduling
      operator: 'system',
      projectStatus: 'ACTIVE',
      metadata: { priority: 'high' }
    },
    {
      projectId: 12346,
      phaseId: 67891,
      phaseTypeName: 'Submission',
      state: 'START', 
      endTime: '2024-01-15T07:30:00.000Z', // Past - overdue
      operator: 'system',
      projectStatus: 'ACTIVE',
      metadata: { priority: 'high' }
    },
    {
      projectId: 12347,
      phaseId: 67892,
      phaseTypeName: 'Review',
      state: 'SCHEDULED',
      endTime: '2024-01-20T18:00:00.000Z', // Future - needs scheduling
      operator: 'system',
      projectStatus: 'ACTIVE',
      metadata: { priority: 'medium' }
    },
    {
      projectId: 12348,
      phaseId: 67893,
      phaseTypeName: 'Appeals',
      state: 'START',
      endTime: '2024-01-10T12:00:00.000Z', // Very old - should be filtered
      operator: 'system',
      projectStatus: 'ACTIVE',
      metadata: { priority: 'low' }
    }
  ];
}
```

### Step 3: Phase Classification and Processing

```typescript
// RecoveryService.executeStartupRecovery()
async executeStartupRecovery(): Promise<RecoveryResult> {
  const startTime = Date.now();
  this.logger.log('Starting recovery process', 'RecoveryService');

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
    // Step 1: Scan active phases
    const activePhases = await this.scanActivePhases();
    result.totalPhasesProcessed = activePhases.length;

    // Step 2: Classify phases by timing
    const { upcomingPhases, overduePhases } = this.classifyPhases(activePhases);
    
    this.logger.log(`Classified phases: ${upcomingPhases.length} upcoming, ${overduePhases.length} overdue`, 'RecoveryService');

    // Step 3: Process overdue phases first (immediate execution)
    if (overduePhases.length > 0) {
      try {
        await this.processOverduePhases(overduePhases);
        result.overduePhasesProcessed = overduePhases.length;
        result.successfulPhases += overduePhases.length;
        
        this.logger.log(`Processed ${overduePhases.length} overdue phases`, 'RecoveryService');
      } catch (error) {
        this.logger.error('Failed to process overdue phases', error, 'RecoveryService');
        result.failedPhases += overduePhases.length;
        result.errors.push(`Overdue processing: ${error.message}`);
      }
    }

    // Step 4: Schedule upcoming phases
    if (upcomingPhases.length > 0) {
      try {
        await this.scheduleUpcomingTransitions(upcomingPhases);
        result.upcomingPhasesScheduled = upcomingPhases.length;
        result.successfulPhases += upcomingPhases.length;
        
        this.logger.log(`Scheduled ${upcomingPhases.length} upcoming phases`, 'RecoveryService');
      } catch (error) {
        this.logger.error('Failed to schedule upcoming phases', error, 'RecoveryService');
        result.failedPhases += upcomingPhases.length;
        result.errors.push(`Upcoming scheduling: ${error.message}`);
      }
    }

    // Step 5: Finalize recovery
    result.status = result.failedPhases === 0 ? RecoveryStatus.COMPLETED : RecoveryStatus.PARTIAL;
    result.executionTime = Date.now() - startTime;

    this.logger.log(`Recovery completed successfully in ${result.executionTime}ms`, 'RecoveryService');
    return result;

  } catch (error) {
    this.logger.error('Recovery failed', error, 'RecoveryService');
    result.status = RecoveryStatus.FAILED;
    result.executionTime = Date.now() - startTime;
    result.errors.push(error.message);
    return result;
  }
}
```

### Step 4: Overdue Phase Processing

```typescript
// RecoveryService.processOverduePhases()
async processOverduePhases(phases: RecoveryPhaseDto[]): Promise<void> {
  this.logger.log(`Processing ${phases.length} overdue phases`, 'RecoveryService');

  if (!this.configService.get<boolean>('recovery.phases.processOverduePhases')) {
    this.logger.log('Skipping overdue phase processing (disabled)', 'RecoveryService');
    return;
  }

  for (const phase of phases) {
    try {
      // Calculate how overdue the phase is
      const endTime = new Date(phase.endTime);
      const now = new Date();
      const overdueMinutes = Math.floor((now.getTime() - endTime.getTime()) / (1000 * 60));

      this.logger.warn(`Phase ${phase.projectId}/${phase.phaseId} is ${overdueMinutes} minutes overdue`, 'RecoveryService');

      // Create schedule data for immediate execution
      const scheduleData: PhaseTransitionScheduleDto = {
        projectId: phase.projectId,
        phaseId: phase.phaseId,
        phaseTypeName: phase.phaseTypeName,
        state: phase.state,
        scheduledTime: new Date().toISOString(), // Execute immediately
        operator: 'recovery-system',
        projectStatus: phase.projectStatus,
        metadata: {
          ...phase.metadata,
          source: 'startup-recovery',
          originalEndTime: phase.endTime,
          overdueMinutes,
          processedAsOverdue: true,
          recoveryTimestamp: new Date().toISOString(),
        },
      };

      // Schedule for immediate execution
      const jobId = await this.schedulerService.schedulePhaseTransition(scheduleData);
      
      this.logger.log(`Scheduled overdue phase for immediate execution: ${phase.projectId}/${phase.phaseId} -> ${jobId}`, 'RecoveryService');

    } catch (error) {
      this.logger.error(`Failed to process overdue phase: ${phase.projectId}/${phase.phaseId}`, error, 'RecoveryService');
      throw error;
    }
  }
}
```

### Step 5: Upcoming Phase Scheduling

```typescript
// RecoveryService.scheduleUpcomingTransitions()
async scheduleUpcomingTransitions(phases: RecoveryPhaseDto[]): Promise<void> {
  this.logger.log(`Scheduling ${phases.length} upcoming phase transitions`, 'RecoveryService');

  const batchSize = this.configService.get<number>('recovery.batch.maxBatchSize');
  const maxConcurrent = this.configService.get<number>('recovery.phases.maxConcurrentPhases');

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < phases.length; i += batchSize) {
    const batch = phases.slice(i, i + batchSize);
    
    this.logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(phases.length / batchSize)}`, 'RecoveryService');

    // Use semaphore to control concurrency
    const semaphore = new Semaphore(maxConcurrent);
    const promises = batch.map(phase => 
      semaphore.acquire().then(async (release) => {
        try {
          await this.scheduleUpcomingPhase(phase);
        } finally {
          release();
        }
      })
    );

    await Promise.all(promises);

    // Add delay between batches if configured
    const batchDelay = this.configService.get<number>('recovery.batch.batchDelay');
    if (batchDelay > 0 && i + batchSize < phases.length) {
      await this.delay(batchDelay);
    }
  }

  this.logger.log(`Successfully scheduled ${phases.length} upcoming transitions`, 'RecoveryService');
}

private async scheduleUpcomingPhase(phase: RecoveryPhaseDto): Promise<void> {
  try {
    // Validate phase data
    this.validatePhaseData(phase);

    // Check if phase is still in the future
    const endTime = new Date(phase.endTime);
    const now = new Date();
    
    if (endTime <= now) {
      this.logger.warn(`Phase ${phase.projectId}/${phase.phaseId} became overdue during processing`, 'RecoveryService');
      // Process as overdue instead
      await this.processOverduePhases([phase]);
      return;
    }

    const scheduleData: PhaseTransitionScheduleDto = {
      projectId: phase.projectId,
      phaseId: phase.phaseId,
      phaseTypeName: phase.phaseTypeName,
      state: phase.state,
      scheduledTime: phase.endTime,
      operator: 'recovery-system',
      projectStatus: phase.projectStatus,
      metadata: {
        ...phase.metadata,
        source: 'startup-recovery',
        recoveryTimestamp: new Date().toISOString(),
      },
    };

    const jobId = await this.schedulerService.schedulePhaseTransition(scheduleData);
    
    this.logger.debug(`Scheduled upcoming phase: ${phase.projectId}/${phase.phaseId} -> ${jobId}`, 'RecoveryService');

  } catch (error) {
    this.logger.error(`Failed to schedule upcoming phase: ${phase.projectId}/${phase.phaseId}`, error, 'RecoveryService');
    throw error;
  }
}
```

### Step 6: Recovery Result

```typescript
// Final recovery result
const recoveryResult: RecoveryResult = {
  status: RecoveryStatus.COMPLETED,
  totalPhasesProcessed: 3, // Processed 3 out of 4 (1 filtered out due to age)
  successfulPhases: 3,
  failedPhases: 0,
  upcomingPhasesScheduled: 2, // Phases 67890 and 67892
  overduePhasesProcessed: 1,  // Phase 67891
  executionTime: 1247, // milliseconds
  timestamp: '2024-01-15T08:05:00.000Z',
  errors: [],
  details: {
    filteredPhases: 1, // Phase 67893 filtered due to age
    immediateExecutions: 1,
    futureSchedules: 2,
  }
};
```

## Scenario 2: Recovery from Kafka Connectivity Issues

### Context

The service is running normally but loses connection to Kafka, causing phase transition events to fail. The circuit breaker opens, and the system needs to recover when connectivity is restored.

### Step 1: Kafka Failure Detection

```typescript
// Circuit breaker detects Kafka failures
class KafkaCircuitBreaker extends CircuitBreaker {
  async executeKafkaOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.execute(operation);
    } catch (error) {
      this.logger.error('Kafka operation failed', error, 'KafkaCircuitBreaker');
      
      if (this.state === CircuitBreakerState.OPEN) {
        // Use fallback mechanism
        await this.handleKafkaFailure(error);
        throw new Error('Kafka circuit breaker is OPEN - using fallback');
      }
      
      throw error;
    }
  }

  private async handleKafkaFailure(error: Error): Promise<void> {
    // Store failed events for retry
    await this.eventStore.storePendingEvent({
      timestamp: new Date().toISOString(),
      error: error.message,
      retryCount: 0,
    });

    // Notify monitoring systems
    this.metricsService.incrementCounter('kafka_failures_total');
  }
}
```

### Step 2: Event Recovery and Replay

```typescript
// EventRecoveryService handles failed event replay
class EventRecoveryService {
  async recoverFailedEvents(): Promise<EventRecoveryResult> {
    this.logger.log('Starting failed event recovery', 'EventRecoveryService');

    const pendingEvents = await this.eventStore.getPendingEvents();
    const result: EventRecoveryResult = {
      totalEvents: pendingEvents.length,
      recoveredEvents: 0,
      failedEvents: 0,
      errors: [],
    };

    for (const event of pendingEvents) {
      try {
        // Check if Kafka is available
        if (await this.kafkaHealthCheck()) {
          // Replay the event
          await this.replayEvent(event);
          await this.eventStore.markEventRecovered(event.id);
          
          result.recoveredEvents++;
          this.logger.debug(`Recovered event: ${event.id}`, 'EventRecoveryService');
          
        } else {
          this.logger.warn('Kafka still unavailable, deferring event recovery', 'EventRecoveryService');
          break;
        }
        
      } catch (error) {
        result.failedEvents++;
        result.errors.push(`Event ${event.id}: ${error.message}`);
        
        // Increment retry count
        await this.eventStore.incrementRetryCount(event.id);
        
        // Remove event if max retries exceeded
        if (event.retryCount >= this.maxRetries) {
          await this.eventStore.moveToDeadLetter(event.id);
          this.logger.error(`Event ${event.id} moved to dead letter queue after ${event.retryCount} retries`, 'EventRecoveryService');
        }
      }
    }

    this.logger.log(`Event recovery completed: ${result.recoveredEvents}/${result.totalEvents} recovered`, 'EventRecoveryService');
    return result;
  }
}
```

## Scenario 3: Recovery from Partial System Failure

### Context

During a deployment, some scheduled jobs were lost due to a database connection issue. The recovery system needs to identify missing schedules and recreate them.

### Step 1: Schedule Consistency Check

```typescript
// ScheduleConsistencyService validates scheduled jobs
class ScheduleConsistencyService {
  async validateScheduleConsistency(): Promise<ConsistencyCheckResult> {
    this.logger.log('Starting schedule consistency check', 'ScheduleConsistencyService');

    const result: ConsistencyCheckResult = {
      totalPhases: 0,
      scheduledPhases: 0,
      missingSchedules: 0,
      inconsistentSchedules: 0,
      recoveredSchedules: 0,
      errors: [],
    };

    try {
      // Get all active phases from challenge service
      const activePhases = await this.challengeService.getAllActivePhases();
      result.totalPhases = activePhases.length;

      // Get all scheduled jobs from scheduler
      const scheduledJobs = await this.schedulerService.getAllScheduledTransitions();
      result.scheduledPhases = scheduledJobs.length;

      // Find missing schedules
      const missingPhases = this.findMissingSchedules(activePhases, scheduledJobs);
      result.missingSchedules = missingPhases.length;

      // Find inconsistent schedules
      const inconsistentPhases = this.findInconsistentSchedules(activePhases, scheduledJobs);
      result.inconsistentSchedules = inconsistentPhases.length;

      // Recover missing schedules
      for (const phase of missingPhases) {
        try {
          await this.recoverMissingSchedule(phase);
          result.recoveredSchedules++;
        } catch (error) {
          result.errors.push(`Failed to recover phase ${phase.phaseId}: ${error.message}`);
        }
      }

      // Fix inconsistent schedules
      for (const inconsistency of inconsistentPhases) {
        try {
          await this.fixInconsistentSchedule(inconsistency);
        } catch (error) {
          result.errors.push(`Failed to fix inconsistency for phase ${inconsistency.phaseId}: ${error.message}`);
        }
      }

      this.logger.log(`Consistency check completed: ${result.recoveredSchedules} schedules recovered`, 'ScheduleConsistencyService');
      return result;

    } catch (error) {
      this.logger.error('Schedule consistency check failed', error, 'ScheduleConsistencyService');
      result.errors.push(error.message);
      return result;
    }
  }

  private findMissingSchedules(activePhases: PhaseData[], scheduledJobs: ScheduledTransitionInfo[]): PhaseData[] {
    const scheduledPhaseIds = new Set(scheduledJobs.map(job => `${job.projectId}-${job.phaseId}`));
    
    return activePhases.filter(phase => {
      const phaseKey = `${phase.projectId}-${phase.phaseId}`;
      const hasSchedule = scheduledPhaseIds.has(phaseKey);
      const needsSchedule = new Date(phase.endTime) > new Date();
      
      return !hasSchedule && needsSchedule;
    });
  }
}
```

## Scenario 4: Recovery from Configuration Changes

### Context

A configuration change modified the maximum concurrent jobs limit, and some jobs need to be rescheduled to comply with the new limits.

### Step 1: Configuration-Driven Recovery

```typescript
// ConfigurationRecoveryService handles config-related recovery
class ConfigurationRecoveryService {
  async handleConfigurationChange(configChange: ConfigurationChange): Promise<void> {
    this.logger.log(`Processing configuration change: ${configChange.key}`, 'ConfigurationRecoveryService');

    switch (configChange.key) {
      case 'scheduler.maxConcurrentJobs':
        await this.handleConcurrencyLimitChange(configChange);
        break;
        
      case 'scheduler.maxScheduleAdvance':
        await this.handleScheduleAdvanceChange(configChange);
        break;
        
      case 'recovery.phases.maxPhaseAge':
        await this.handlePhaseAgeChange(configChange);
        break;
        
      default:
        this.logger.debug(`No recovery action needed for config: ${configChange.key}`, 'ConfigurationRecoveryService');
    }
  }

  private async handleConcurrencyLimitChange(configChange: ConfigurationChange): Promise<void> {
    const newLimit = configChange.newValue as number;
    const oldLimit = configChange.oldValue as number;

    if (newLimit < oldLimit) {
      // Reduced limit - may need to defer some jobs
      const activeJobs = await this.schedulerService.getAllScheduledTransitions();
      
      if (activeJobs.length > newLimit) {
        const jobsToDefer = activeJobs.slice(newLimit);
        
        for (const job of jobsToDefer) {
          await this.deferJob(job, 'Concurrency limit reduction');
        }
        
        this.logger.log(`Deferred ${jobsToDefer.length} jobs due to concurrency limit reduction`, 'ConfigurationRecoveryService');
      }
    }
  }
}
```

## Monitoring Recovery Operations

### Recovery Metrics

```typescript
// Recovery metrics tracking
class RecoveryMetrics {
  recordRecoveryOperation(operation: RecoveryOperation): void {
    // Track recovery frequency
    this.metricsService.incrementCounter('recovery_operations_total', {
      type: operation.type,
      trigger: operation.trigger,
    });

    // Track recovery duration
    this.metricsService.recordHistogram('recovery_duration_ms', operation.durationMs, {
      type: operation.type,
    });

    // Track recovery success rate
    this.metricsService.setGauge('recovery_success_rate', operation.successRate, {
      type: operation.type,
    });

    // Track phases recovered
    this.metricsService.recordHistogram('phases_recovered_count', operation.phasesRecovered);
  }
}
```

### Recovery Health Monitoring

```bash
# Monitor recovery operations
curl http://localhost:3000/health/recovery

# Response
{
  "status": "ok",
  "info": {
    "recovery": {
      "status": "up",
      "lastRecoveryTime": "2024-01-15T08:05:00.000Z",
      "lastRecoveryStatus": "COMPLETED",
      "totalRecoveries": 15,
      "successRate": 0.98,
      "averageRecoveryTime": 1247,
      "phasesRecoveredToday": 45
    }
  }
}
```

## Best Practices for Recovery

### 1. Graceful Degradation

```typescript
// Implement graceful degradation during recovery
async executeWithGracefulDegradation<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>
): Promise<T> {
  try {
    return await primaryOperation();
  } catch (error) {
    this.logger.warn('Primary operation failed, using fallback', error);
    return await fallbackOperation();
  }
}
```

### 2. Recovery State Management

```typescript
// Track recovery state for monitoring
class RecoveryStateManager {
  private recoveryState: RecoveryState = {
    inProgress: false,
    lastRecovery: null,
    recoveryCount: 0,
    consecutiveFailures: 0,
  };

  async startRecovery(): Promise<void> {
    this.recoveryState.inProgress = true;
    this.recoveryState.recoveryCount++;
    
    // Persist state for monitoring
    await this.persistRecoveryState();
  }

  async completeRecovery(success: boolean): Promise<void> {
    this.recoveryState.inProgress = false;
    this.recoveryState.lastRecovery = new Date().toISOString();
    
    if (success) {
      this.recoveryState.consecutiveFailures = 0;
    } else {
      this.recoveryState.consecutiveFailures++;
    }
    
    await this.persistRecoveryState();
  }
}
```

### 3. Recovery Testing

```typescript
// Automated recovery testing
describe('Recovery Scenarios', () => {
  it('should recover from service restart', async () => {
    // Simulate service restart
    await app.close();
    app = await createTestApp();
    
    // Verify recovery completed
    const result = await recoveryService.executeStartupRecovery();
    expect(result.status).toBe(RecoveryStatus.COMPLETED);
  });

  it('should handle overdue phases correctly', async () => {
    // Create overdue phase scenario
    const overduePhases = createOverduePhases();
    
    // Execute recovery
    await recoveryService.processOverduePhases(overduePhases);
    
    // Verify immediate execution
    const executedEvents = await getExecutedEvents();
    expect(executedEvents).toHaveLength(overduePhases.length);
  });
});
```

These recovery scenarios demonstrate the robust capabilities of the Autopilot-v6 service in handling various failure modes while maintaining system reliability and ensuring no phase transitions are lost.