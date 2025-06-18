# Rescheduling and Schedule Adjustment Scenario

## Overview

This document demonstrates how the Autopilot-v6 service handles schedule adjustments when challenge phases need to be rescheduled due to changes in requirements, extensions, or other operational needs.

## Scenario Description

**Context**: An active challenge with scheduled phases receives an update that changes the end times of multiple phases, requiring automatic rescheduling of existing jobs.

**Initial Challenge State**:
- Challenge ID: 12345
- Challenge Name: "Data Science Competition"
- Status: ACTIVE
- Current scheduled phases:
  1. Registration Phase (ID: 67890) - Originally ends at 2024-01-15T10:00:00Z
  2. Submission Phase (ID: 67891) - Originally ends at 2024-01-20T18:00:00Z
  3. Review Phase (ID: 67892) - Originally ends at 2024-01-25T12:00:00Z

**Schedule Change**: Due to low registration numbers, the challenge phases are extended by 3 days each.

## Workflow Steps

### Step 1: Initial Schedule State

The system has existing scheduled jobs:

```typescript
// Current scheduled jobs before the change
const currentJobs = [
  {
    jobId: "job-1705140000000-12345-67890",
    projectId: 12345,
    phaseId: 67890,
    scheduledTime: "2024-01-15T10:00:00.000Z",
    status: "scheduled"
  },
  {
    jobId: "job-1705776000000-12345-67891",
    projectId: 12345,
    phaseId: 67891,
    scheduledTime: "2024-01-20T18:00:00.000Z",
    status: "scheduled"
  },
  {
    jobId: "job-1706184000000-12345-67892",
    projectId: 12345,
    phaseId: 67892,
    scheduledTime: "2024-01-25T12:00:00.000Z",
    status: "scheduled"
  }
];
```

### Step 2: Schedule Update Event

An administrator updates the challenge with new phase end times:

```json
{
  "eventType": "CHALLENGE_UPDATE",
  "timestamp": "2024-01-12T14:30:00.000Z",
  "payload": {
    "projectId": 12345,
    "challengeId": 12345,
    "status": "ACTIVE",
    "operator": "admin@topcoder.com",
    "date": "2024-01-12T14:30:00.000Z",
    "updateType": "PHASE_SCHEDULE_CHANGE",
    "phases": [
      {
        "phaseId": 67890,
        "phaseTypeName": "Registration",
        "state": "START",
        "endTime": "2024-01-18T10:00:00.000Z",
        "previousEndTime": "2024-01-15T10:00:00.000Z"
      },
      {
        "phaseId": 67891,
        "phaseTypeName": "Submission",
        "state": "SCHEDULED",
        "endTime": "2024-01-23T18:00:00.000Z",
        "previousEndTime": "2024-01-20T18:00:00.000Z"
      },
      {
        "phaseId": 67892,
        "phaseTypeName": "Review",
        "state": "SCHEDULED",
        "endTime": "2024-01-28T12:00:00.000Z",
        "previousEndTime": "2024-01-25T12:00:00.000Z"
      }
    ]
  }
}
```

### Step 3: Schedule Adjustment Processing

The ScheduleAdjustmentService processes the update:

```typescript
// ScheduleAdjustmentService.handleChallengeUpdate()
async handleChallengeUpdate(payload: ChallengeUpdatePayload): Promise<ScheduleAdjustmentResult> {
  this.logger.log(`Processing schedule adjustment for project: ${payload.projectId}`, 'ScheduleAdjustmentService');

  const result: ScheduleAdjustmentResult = {
    adjustmentsProcessed: 0,
    phasesAffected: [],
    schedulingChanges: [],
    errors: [],
  };

  try {
    // Identify phases with schedule changes
    const changedPhases = payload.phases?.filter(phase => 
      phase.endTime !== phase.previousEndTime
    ) || [];

    this.logger.debug(`Found ${changedPhases.length} phases with schedule changes`, 'ScheduleAdjustmentService');

    // Process each changed phase
    for (const phase of changedPhases) {
      await this.processPhaseScheduleChange(phase, result);
    }

    // Validate and resolve conflicts
    await this.validateScheduleChanges(result);

    this.logger.log(`Schedule adjustment completed: ${result.adjustmentsProcessed} adjustments processed`, 'ScheduleAdjustmentService');
    return result;

  } catch (error) {
    this.logger.error('Failed to process schedule adjustment', error, 'ScheduleAdjustmentService');
    result.errors.push(error.message);
    throw error;
  }
}
```

### Step 4: Individual Phase Rescheduling

For each phase with a schedule change:

```typescript
// ScheduleAdjustmentService.processPhaseScheduleChange()
private async processPhaseScheduleChange(
  phase: PhaseUpdateData, 
  result: ScheduleAdjustmentResult
): Promise<void> {
  this.logger.debug(`Processing schedule change for phase: ${phase.phaseId}`, 'ScheduleAdjustmentService');

  try {
    // Find existing scheduled job
    const existingJobs = await this.schedulerService.getAllScheduledTransitions();
    const existingJob = existingJobs.find(job => 
      job.projectId === phase.projectId && job.phaseId === phase.phaseId
    );

    if (existingJob) {
      // Cancel existing job
      const cancelled = await this.schedulerService.cancelScheduledTransition(existingJob.jobId);
      
      if (cancelled) {
        this.logger.debug(`Cancelled existing job: ${existingJob.jobId}`, 'ScheduleAdjustmentService');
        result.schedulingChanges.push(`cancelled:${existingJob.jobId}`);

        // Schedule new job with updated time
        const newScheduleData: PhaseTransitionScheduleDto = {
          projectId: phase.projectId,
          phaseId: phase.phaseId,
          phaseTypeName: phase.phaseTypeName,
          state: phase.state,
          scheduledTime: phase.endTime,
          operator: 'schedule-adjustment',
          projectStatus: 'ACTIVE',
          metadata: {
            source: 'schedule-adjustment',
            originalEndTime: phase.previousEndTime,
            adjustmentReason: 'admin-initiated',
            adjustmentTimestamp: new Date().toISOString(),
          },
        };

        const newJobId = await this.schedulerService.schedulePhaseTransition(newScheduleData);
        
        this.logger.log(`Rescheduled phase ${phase.phaseId}: ${phase.previousEndTime} → ${phase.endTime}`, 'ScheduleAdjustmentService');
        result.schedulingChanges.push(`scheduled:${newJobId}`);
        result.phasesAffected.push(phase.phaseId);
        result.adjustmentsProcessed++;

      } else {
        throw new Error(`Failed to cancel existing job: ${existingJob.jobId}`);
      }
    } else {
      // No existing job found - schedule new one
      const scheduleData: PhaseTransitionScheduleDto = {
        projectId: phase.projectId,
        phaseId: phase.phaseId,
        phaseTypeName: phase.phaseTypeName,
        state: phase.state,
        scheduledTime: phase.endTime,
        operator: 'schedule-adjustment',
        projectStatus: 'ACTIVE',
        metadata: {
          source: 'schedule-adjustment',
          adjustmentReason: 'new-schedule',
          adjustmentTimestamp: new Date().toISOString(),
        },
      };

      const jobId = await this.schedulerService.schedulePhaseTransition(scheduleData);
      
      this.logger.log(`Scheduled new phase transition: ${phase.phaseId} at ${phase.endTime}`, 'ScheduleAdjustmentService');
      result.schedulingChanges.push(`scheduled:${jobId}`);
      result.phasesAffected.push(phase.phaseId);
      result.adjustmentsProcessed++;
    }

  } catch (error) {
    this.logger.error(`Failed to process schedule change for phase: ${phase.phaseId}`, error, 'ScheduleAdjustmentService');
    result.errors.push(`Phase ${phase.phaseId}: ${error.message}`);
    throw error;
  }
}
```

### Step 5: Conflict Detection and Resolution

The system validates the new schedule for conflicts:

```typescript
// ScheduleAdjustmentService.validateScheduleChanges()
private async validateScheduleChanges(result: ScheduleAdjustmentResult): Promise<void> {
  this.logger.debug('Validating schedule changes for conflicts', 'ScheduleAdjustmentService');

  // Get all scheduled jobs for the project
  const allJobs = await this.schedulerService.getAllScheduledTransitions();
  const projectJobs = allJobs.filter(job => 
    result.phasesAffected.includes(job.phaseId)
  );

  // Check for timing conflicts
  const conflicts = this.detectScheduleConflicts(projectJobs);
  
  if (conflicts.length > 0) {
    this.logger.warn(`Detected ${conflicts.length} schedule conflicts`, 'ScheduleAdjustmentService');
    
    // Resolve conflicts
    for (const conflict of conflicts) {
      await this.resolveScheduleConflict(conflict);
    }
  }

  // Validate business rules
  await this.validateBusinessRules(projectJobs);
  
  this.logger.debug('Schedule validation completed successfully', 'ScheduleAdjustmentService');
}

private detectScheduleConflicts(jobs: ScheduledTransitionInfo[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  
  // Sort jobs by scheduled time
  const sortedJobs = jobs.sort((a, b) => 
    new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
  );

  // Check for overlapping phases
  for (let i = 0; i < sortedJobs.length - 1; i++) {
    const currentJob = sortedJobs[i];
    const nextJob = sortedJobs[i + 1];
    
    const currentEndTime = new Date(currentJob.scheduledTime);
    const nextStartTime = new Date(nextJob.scheduledTime);
    
    // Phases should have at least 1 hour gap
    const minGapMs = 60 * 60 * 1000; // 1 hour
    
    if (nextStartTime.getTime() - currentEndTime.getTime() < minGapMs) {
      conflicts.push({
        type: 'INSUFFICIENT_GAP',
        job1: currentJob,
        job2: nextJob,
        requiredGap: minGapMs,
        actualGap: nextStartTime.getTime() - currentEndTime.getTime(),
      });
    }
  }

  return conflicts;
}
```

### Step 6: Bulk Schedule Update Execution

The system processes all changes atomically:

```typescript
// ScheduleAdjustmentService.executeBulkScheduleUpdate()
async executeBulkScheduleUpdate(updates: PhaseScheduleUpdate[]): Promise<BulkUpdateResult> {
  this.logger.log(`Executing bulk schedule update for ${updates.length} phases`, 'ScheduleAdjustmentService');

  const result: BulkUpdateResult = {
    totalUpdates: updates.length,
    successfulUpdates: 0,
    failedUpdates: 0,
    errors: [],
    rollbackRequired: false,
  };

  // Transaction-like processing
  const completedOperations: string[] = [];

  try {
    // Process updates in dependency order
    const orderedUpdates = this.orderUpdatesByDependency(updates);

    for (const update of orderedUpdates) {
      try {
        await this.processScheduleUpdate(update);
        completedOperations.push(update.operationId);
        result.successfulUpdates++;
        
        this.logger.debug(`Successfully processed update: ${update.operationId}`, 'ScheduleAdjustmentService');
        
      } catch (error) {
        this.logger.error(`Failed to process update: ${update.operationId}`, error, 'ScheduleAdjustmentService');
        result.errors.push(`${update.operationId}: ${error.message}`);
        result.failedUpdates++;
        
        // If critical update fails, mark for rollback
        if (update.critical) {
          result.rollbackRequired = true;
          break;
        }
      }
    }

    // If rollback is required, undo completed operations
    if (result.rollbackRequired) {
      await this.rollbackOperations(completedOperations);
      this.logger.warn('Bulk update rolled back due to critical failure', 'ScheduleAdjustmentService');
    }

    this.logger.log(`Bulk update completed: ${result.successfulUpdates}/${result.totalUpdates} successful`, 'ScheduleAdjustmentService');
    return result;

  } catch (error) {
    this.logger.error('Bulk schedule update failed', error, 'ScheduleAdjustmentService');
    result.rollbackRequired = true;
    await this.rollbackOperations(completedOperations);
    throw error;
  }
}
```

### Step 7: Updated Schedule State

After successful rescheduling, the system has new scheduled jobs:

```typescript
// New scheduled jobs after rescheduling
const updatedJobs = [
  {
    jobId: "job-1705399200000-12345-67890", // New job ID
    projectId: 12345,
    phaseId: 67890,
    scheduledTime: "2024-01-18T10:00:00.000Z", // Extended by 3 days
    status: "scheduled",
    metadata: {
      source: "schedule-adjustment",
      originalEndTime: "2024-01-15T10:00:00.000Z",
      adjustmentReason: "admin-initiated"
    }
  },
  {
    jobId: "job-1706035200000-12345-67891", // New job ID
    projectId: 12345,
    phaseId: 67891,
    scheduledTime: "2024-01-23T18:00:00.000Z", // Extended by 3 days
    status: "scheduled",
    metadata: {
      source: "schedule-adjustment",
      originalEndTime: "2024-01-20T18:00:00.000Z",
      adjustmentReason: "admin-initiated"
    }
  },
  {
    jobId: "job-1706443200000-12345-67892", // New job ID
    projectId: 12345,
    phaseId: 67892,
    scheduledTime: "2024-01-28T12:00:00.000Z", // Extended by 3 days
    status: "scheduled",
    metadata: {
      source: "schedule-adjustment",
      originalEndTime: "2024-01-25T12:00:00.000Z",
      adjustmentReason: "admin-initiated"
    }
  }
];
```

### Step 8: Audit Logging and Notification

The system logs all schedule changes for audit purposes:

```typescript
// ScheduleAdjustmentService.logScheduleChange()
private async logScheduleChange(change: ScheduleChange): Promise<void> {
  const auditLog = {
    timestamp: new Date().toISOString(),
    eventType: 'SCHEDULE_ADJUSTMENT',
    projectId: change.projectId,
    phaseId: change.phaseId,
    operator: change.operator,
    changes: {
      previousEndTime: change.previousEndTime,
      newEndTime: change.newEndTime,
      reason: change.reason,
    },
    jobIds: {
      cancelled: change.cancelledJobId,
      created: change.newJobId,
    },
    metadata: change.metadata,
  };

  // Log to structured logging system
  this.logger.log(`Schedule change: ${JSON.stringify(auditLog)}`, 'ScheduleAdjustmentService');

  // Send to audit service if available
  if (this.auditService) {
    await this.auditService.recordScheduleChange(auditLog);
  }

  // Notify stakeholders if configured
  if (this.notificationService && change.notifyStakeholders) {
    await this.notificationService.sendScheduleChangeNotification({
      projectId: change.projectId,
      phaseId: change.phaseId,
      previousEndTime: change.previousEndTime,
      newEndTime: change.newEndTime,
      reason: change.reason,
    });
  }
}
```

## Advanced Rescheduling Scenarios

### Scenario A: Cascading Dependencies

When one phase is extended, dependent phases may need adjustment:

```typescript
// Handle cascading schedule changes
async handleCascadingScheduleChanges(primaryChange: PhaseScheduleChange): Promise<void> {
  const dependentPhases = await this.getDependentPhases(primaryChange.phaseId);
  
  for (const dependentPhase of dependentPhases) {
    // Calculate new start time based on primary phase end time
    const newStartTime = new Date(primaryChange.newEndTime);
    newStartTime.setHours(newStartTime.getHours() + dependentPhase.gapHours);
    
    // Calculate new end time maintaining original duration
    const originalDuration = dependentPhase.originalEndTime.getTime() - dependentPhase.originalStartTime.getTime();
    const newEndTime = new Date(newStartTime.getTime() + originalDuration);
    
    // Create cascading update
    const cascadingUpdate: PhaseScheduleChange = {
      phaseId: dependentPhase.phaseId,
      previousEndTime: dependentPhase.originalEndTime.toISOString(),
      newEndTime: newEndTime.toISOString(),
      reason: `Cascading from phase ${primaryChange.phaseId}`,
      cascading: true,
    };
    
    await this.processPhaseScheduleChange(cascadingUpdate);
  }
}
```

### Scenario B: Emergency Rescheduling

Handle urgent schedule changes with priority processing:

```typescript
// Emergency rescheduling with priority handling
async handleEmergencyReschedule(emergencyUpdate: EmergencyScheduleUpdate): Promise<void> {
  this.logger.warn(`Processing emergency reschedule for project: ${emergencyUpdate.projectId}`, 'ScheduleAdjustmentService');

  // Bypass normal validation for emergency changes
  const urgentProcessing = true;
  
  // Process with higher priority
  await this.processScheduleUpdate(emergencyUpdate, { 
    priority: 'HIGH',
    bypassValidation: urgentProcessing,
    immediateExecution: true 
  });

  // Send immediate notifications
  await this.notificationService.sendEmergencyNotification({
    type: 'EMERGENCY_RESCHEDULE',
    projectId: emergencyUpdate.projectId,
    changes: emergencyUpdate.changes,
    reason: emergencyUpdate.reason,
  });
}
```

### Scenario C: Bulk Phase Updates

Handle multiple challenges with schedule changes:

```typescript
// Bulk rescheduling across multiple challenges
async handleBulkReschedule(bulkUpdate: BulkScheduleUpdate): Promise<BulkRescheduleResult> {
  const result: BulkRescheduleResult = {
    totalChallenges: bulkUpdate.challenges.length,
    processedChallenges: 0,
    failedChallenges: 0,
    errors: [],
  };

  // Process challenges in batches to avoid overwhelming the system
  const batchSize = this.configService.get<number>('scheduleAdjustment.batchSize', 10);
  
  for (let i = 0; i < bulkUpdate.challenges.length; i += batchSize) {
    const batch = bulkUpdate.challenges.slice(i, i + batchSize);
    
    // Process batch concurrently
    const batchPromises = batch.map(challenge => 
      this.processChallengeReschedule(challenge)
        .then(() => {
          result.processedChallenges++;
          this.logger.debug(`Successfully rescheduled challenge: ${challenge.projectId}`, 'ScheduleAdjustmentService');
        })
        .catch(error => {
          result.failedChallenges++;
          result.errors.push(`Challenge ${challenge.projectId}: ${error.message}`);
          this.logger.error(`Failed to reschedule challenge: ${challenge.projectId}`, error, 'ScheduleAdjustmentService');
        })
    );

    await Promise.all(batchPromises);
    
    // Add delay between batches to prevent system overload
    if (i + batchSize < bulkUpdate.challenges.length) {
      await this.delay(1000); // 1 second delay
    }
  }

  this.logger.log(`Bulk reschedule completed: ${result.processedChallenges}/${result.totalChallenges} successful`, 'ScheduleAdjustmentService');
  return result;
}
```

## Monitoring and Verification

### Schedule Change Metrics

```typescript
// Metrics tracking for schedule adjustments
class ScheduleAdjustmentMetrics {
  recordScheduleChange(change: ScheduleChangeMetric): void {
    // Track adjustment frequency
    this.metricsService.incrementCounter('schedule_adjustments_total', {
      reason: change.reason,
      phaseType: change.phaseType,
    });

    // Track adjustment magnitude
    const adjustmentHours = Math.abs(change.newEndTime.getTime() - change.originalEndTime.getTime()) / (1000 * 60 * 60);
    this.metricsService.recordHistogram('schedule_adjustment_hours', adjustmentHours, {
      direction: change.newEndTime > change.originalEndTime ? 'extension' : 'reduction',
    });

    // Track processing time
    this.metricsService.recordHistogram('schedule_adjustment_processing_time_ms', change.processingTimeMs);
  }
}
```

### Health Monitoring During Rescheduling

```bash
# Monitor schedule adjustment health
curl http://localhost:3000/health/scheduler

# Response showing rescheduling activity
{
  "status": "ok",
  "info": {
    "scheduler": {
      "status": "up",
      "activeJobs": 3,
      "scheduledJobs": 3,
      "recentAdjustments": 3,
      "lastAdjustment": "2024-01-12T14:30:00.000Z"
    }
  }
}
```

## Error Handling and Recovery

### Rollback Mechanism

```typescript
// Rollback failed schedule changes
async rollbackScheduleChanges(operationId: string): Promise<void> {
  this.logger.warn(`Rolling back schedule changes for operation: ${operationId}`, 'ScheduleAdjustmentService');

  const operation = await this.getScheduleOperation(operationId);
  
  for (const change of operation.changes.reverse()) {
    try {
      // Cancel new job if it was created
      if (change.newJobId) {
        await this.schedulerService.cancelScheduledTransition(change.newJobId);
      }

      // Recreate original job if it was cancelled
      if (change.originalJobId && change.originalScheduleData) {
        await this.schedulerService.schedulePhaseTransition(change.originalScheduleData);
      }

      this.logger.debug(`Rolled back change for phase: ${change.phaseId}`, 'ScheduleAdjustmentService');
      
    } catch (error) {
      this.logger.error(`Failed to rollback change for phase: ${change.phaseId}`, error, 'ScheduleAdjustmentService');
      // Continue with other rollbacks
    }
  }

  // Mark operation as rolled back
  await this.markOperationRolledBack(operationId);
  
  this.logger.log(`Schedule changes rolled back for operation: ${operationId}`, 'ScheduleAdjustmentService');
}
```

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Group related schedule changes
2. **Dependency Ordering**: Process changes in correct sequence
3. **Conflict Prevention**: Validate changes before execution
4. **Atomic Operations**: Ensure consistency during updates
5. **Monitoring**: Track adjustment frequency and impact

### Resource Management

```typescript
// Resource-aware rescheduling
class ResourceAwareScheduler {
  async scheduleWithResourceCheck(updates: ScheduleUpdate[]): Promise<void> {
    // Check system resources before processing
    const systemLoad = await this.getSystemLoad();
    
    if (systemLoad.cpu > 80 || systemLoad.memory > 90) {
      // Defer non-critical updates
      const criticalUpdates = updates.filter(u => u.critical);
      const deferredUpdates = updates.filter(u => !u.critical);
      
      await this.processCriticalUpdates(criticalUpdates);
      await this.deferUpdates(deferredUpdates);
    } else {
      await this.processAllUpdates(updates);
    }
  }
}
```

This rescheduling scenario demonstrates the sophisticated capabilities of the Autopilot-v6 service in handling complex schedule adjustments while maintaining system reliability and data consistency.