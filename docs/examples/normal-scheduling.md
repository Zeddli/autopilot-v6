# Normal Scheduling Scenario

## Overview

This document demonstrates the normal scheduling workflow in the Autopilot-v6 service, showing how phase transitions are scheduled and executed in typical operational scenarios.

## Scenario Description

**Context**: A new challenge is created with multiple phases that need automatic transitions at specific end times.

**Challenge Details**:
- Challenge ID: 12345
- Challenge Name: "Algorithm Optimization Challenge"
- Status: ACTIVE
- Phases:
  1. Registration Phase (ID: 67890) - Ends at 2024-01-15T10:00:00Z
  2. Submission Phase (ID: 67891) - Ends at 2024-01-20T18:00:00Z
  3. Review Phase (ID: 67892) - Ends at 2024-01-25T12:00:00Z

## Workflow Steps

### Step 1: Challenge Creation Event

When a new challenge is created, the system receives a challenge update event:

```json
{
  "eventType": "CHALLENGE_UPDATE",
  "timestamp": "2024-01-10T09:00:00.000Z",
  "payload": {
    "projectId": 12345,
    "challengeId": 12345,
    "status": "ACTIVE",
    "operator": "admin@topcoder.com",
    "date": "2024-01-10T09:00:00.000Z",
    "phases": [
      {
        "phaseId": 67890,
        "phaseTypeName": "Registration",
        "state": "START",
        "endTime": "2024-01-15T10:00:00.000Z"
      },
      {
        "phaseId": 67891,
        "phaseTypeName": "Submission",
        "state": "SCHEDULED",
        "endTime": "2024-01-20T18:00:00.000Z"
      },
      {
        "phaseId": 67892,
        "phaseTypeName": "Review",
        "state": "SCHEDULED",
        "endTime": "2024-01-25T12:00:00.000Z"
      }
    ]
  }
}
```

### Step 2: AutopilotService Processing

The AutopilotService receives and processes the challenge update:

```typescript
// AutopilotService.handleChallengeUpdate()
async handleChallengeUpdate(payload: ChallengeUpdatePayload): Promise<void> {
  this.logger.log(`Handling challenge update for project: ${payload.projectId}`, 'AutopilotService');
  
  // Extract phases that need scheduling
  const phasesToSchedule = payload.phases?.filter(phase => 
    phase.endTime && 
    new Date(phase.endTime) > new Date() &&
    ['SCHEDULED', 'START'].includes(phase.state)
  ) || [];

  // Schedule each phase
  for (const phase of phasesToSchedule) {
    await this.schedulePhaseTransition(phase);
  }

  this.logger.log(`Scheduled ${phasesToSchedule.length} phase transitions`, 'AutopilotService');
}
```

### Step 3: Phase Scheduling

For each phase, the SchedulerService creates a scheduled job:

```typescript
// SchedulerService.schedulePhaseTransition()
async schedulePhaseTransition(phaseData: PhaseTransitionScheduleDto): Promise<string> {
  const jobId = this.generateJobId(phaseData);
  const scheduledTime = new Date(phaseData.scheduledTime);
  const delay = scheduledTime.getTime() - Date.now();

  this.logger.debug(`Scheduling phase transition: ${phaseData.projectId}/${phaseData.phaseId}`, 'SchedulerService');

  // Create the scheduled job
  const job = this.schedulerRegistry.addTimeout(
    jobId,
    () => this.executePhaseTransition(jobId, phaseData),
    delay
  );

  // Track the job
  this.activeJobs.set(jobId, {
    jobId,
    projectId: phaseData.projectId,
    phaseId: phaseData.phaseId,
    scheduledTime: phaseData.scheduledTime,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  });

  this.logger.log(`Phase transition scheduled: ${jobId} at ${phaseData.scheduledTime}`, 'SchedulerService');
  return jobId;
}
```

### Step 4: Job Execution Timeline

The system now has three scheduled jobs:

```
Current Time: 2024-01-10T09:00:00Z

Scheduled Jobs:
┌─────────────────────────────────────────────────────────────────┐
│ Job ID: job-1705140000000-12345-67890                          │
│ Phase: Registration (67890)                                     │
│ Execution: 2024-01-15T10:00:00Z (in 5 days, 1 hour)          │
│ Status: scheduled                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Job ID: job-1705776000000-12345-67891                          │
│ Phase: Submission (67891)                                       │
│ Execution: 2024-01-20T18:00:00Z (in 10 days, 9 hours)        │
│ Status: scheduled                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Job ID: job-1706184000000-12345-67892                          │
│ Phase: Review (67892)                                           │
│ Execution: 2024-01-25T12:00:00Z (in 15 days, 3 hours)        │
│ Status: scheduled                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Step 5: First Phase Transition Execution

At 2024-01-15T10:00:00Z, the Registration phase transition executes:

```typescript
// SchedulerService.executePhaseTransition()
private async executePhaseTransition(jobId: string, phaseData: PhaseTransitionScheduleDto): Promise<void> {
  this.logger.log(`Executing phase transition: ${jobId}`, 'SchedulerService');

  try {
    // Update job status
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'executing';
      job.executedAt = new Date().toISOString();
    }

    // Create phase transition event
    const transitionPayload: PhaseTransitionPayload = {
      projectId: phaseData.projectId,
      phaseId: phaseData.phaseId,
      phaseTypeName: phaseData.phaseTypeName,
      state: 'END',
      operator: 'autopilot-system',
      projectStatus: phaseData.projectStatus,
      date: new Date().toISOString(),
    };

    // Publish to Kafka
    await this.autopilotProducer.sendPhaseTransition(transitionPayload);

    // Update job status
    if (job) {
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
    }

    this.logger.log(`Phase transition executed successfully: ${jobId}`, 'SchedulerService');
  } catch (error) {
    this.handleJobError(jobId, error);
  }
}
```

### Step 6: Kafka Event Publication

The phase transition event is published to the Kafka topic:

```json
{
  "topic": "autopilot.phase.transition",
  "key": "12345-67890",
  "value": {
    "projectId": 12345,
    "phaseId": 67890,
    "phaseTypeName": "Registration",
    "state": "END",
    "operator": "autopilot-system",
    "projectStatus": "ACTIVE",
    "date": "2024-01-15T10:00:00.000Z"
  },
  "headers": {
    "eventType": "PHASE_TRANSITION",
    "source": "autopilot-v6",
    "version": "1.0.0"
  }
}
```

### Step 7: Event Processing

The published event is consumed and processed by downstream services:

```typescript
// External service consuming the event
export class ChallengePhaseHandler {
  @EventPattern('autopilot.phase.transition')
  async handlePhaseTransition(data: PhaseTransitionPayload) {
    console.log(`Processing phase transition: ${data.projectId}/${data.phaseId}`);
    
    // Update challenge phase status
    await this.challengeService.updatePhaseStatus(
      data.projectId,
      data.phaseId,
      data.state
    );

    // Trigger next phase if applicable
    if (data.state === 'END') {
      await this.challengeService.startNextPhase(data.projectId);
    }

    console.log(`Phase transition processed successfully`);
  }
}
```

### Step 8: Continued Execution

The process continues for the remaining phases:

**2024-01-20T18:00:00Z - Submission Phase Ends**:
```json
{
  "topic": "autopilot.phase.transition",
  "key": "12345-67891",
  "value": {
    "projectId": 12345,
    "phaseId": 67891,
    "phaseTypeName": "Submission",
    "state": "END",
    "operator": "autopilot-system",
    "projectStatus": "ACTIVE",
    "date": "2024-01-20T18:00:00.000Z"
  }
}
```

**2024-01-25T12:00:00Z - Review Phase Ends**:
```json
{
  "topic": "autopilot.phase.transition",
  "key": "12345-67892",
  "value": {
    "projectId": 12345,
    "phaseId": 67892,
    "phaseTypeName": "Review",
    "state": "END",
    "operator": "autopilot-system",
    "projectStatus": "ACTIVE",
    "date": "2024-01-25T12:00:00.000Z"
  }
}
```

## Monitoring and Verification

### Health Check During Execution

```bash
# Check scheduler health
curl http://localhost:3000/health/scheduler

# Response
{
  "status": "ok",
  "info": {
    "scheduler": {
      "status": "up",
      "activeJobs": 2,
      "scheduledJobs": 2,
      "completedJobs": 1,
      "failedJobs": 0,
      "lastJobExecution": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

### Job Status Tracking

```typescript
// Get all scheduled transitions
const scheduledJobs = await schedulerService.getAllScheduledTransitions();

console.log('Current scheduled jobs:', scheduledJobs);
/*
Output:
[
  {
    jobId: "job-1705776000000-12345-67891",
    projectId: 12345,
    phaseId: 67891,
    status: "scheduled",
    scheduledTime: "2024-01-20T18:00:00.000Z"
  },
  {
    jobId: "job-1706184000000-12345-67892",
    projectId: 12345,
    phaseId: 67892,
    status: "scheduled",
    scheduledTime: "2024-01-25T12:00:00.000Z"
  }
]
*/
```

### Logging Output

```
2024-01-10T09:00:00.000Z [LOG] AutopilotService - Handling challenge update for project: 12345
2024-01-10T09:00:00.001Z [DEBUG] SchedulerService - Scheduling phase transition: 12345/67890
2024-01-10T09:00:00.002Z [LOG] SchedulerService - Phase transition scheduled: job-1705140000000-12345-67890 at 2024-01-15T10:00:00.000Z
2024-01-10T09:00:00.003Z [DEBUG] SchedulerService - Scheduling phase transition: 12345/67891
2024-01-10T09:00:00.004Z [LOG] SchedulerService - Phase transition scheduled: job-1705776000000-12345-67891 at 2024-01-20T18:00:00.000Z
2024-01-10T09:00:00.005Z [DEBUG] SchedulerService - Scheduling phase transition: 12345/67892
2024-01-10T09:00:00.006Z [LOG] SchedulerService - Phase transition scheduled: job-1706184000000-12345-67892 at 2024-01-25T12:00:00.000Z
2024-01-10T09:00:00.007Z [LOG] AutopilotService - Scheduled 3 phase transitions

...

2024-01-15T10:00:00.000Z [LOG] SchedulerService - Executing phase transition: job-1705140000000-12345-67890
2024-01-15T10:00:00.050Z [DEBUG] AutopilotProducer - Publishing phase transition event for 12345/67890
2024-01-15T10:00:00.100Z [LOG] SchedulerService - Phase transition executed successfully: job-1705140000000-12345-67890
```

## Success Criteria

The normal scheduling scenario is successful when:

1. ✅ **All phases are scheduled correctly** - Jobs created for each future phase
2. ✅ **Jobs execute at precise times** - Phase transitions occur exactly at scheduled times
3. ✅ **Events are published successfully** - Kafka events sent to correct topics
4. ✅ **No errors or failures** - All operations complete without exceptions
5. ✅ **Proper cleanup** - Completed jobs are cleaned up according to configuration
6. ✅ **Monitoring data is accurate** - Health checks and metrics reflect actual state

## Performance Characteristics

In this normal scenario:

- **Scheduling Latency**: < 10ms per phase
- **Execution Precision**: ± 1 second of scheduled time
- **Memory Usage**: ~50KB per scheduled job
- **CPU Usage**: Minimal until job execution
- **Network Usage**: One Kafka message per phase transition

## Error Handling

Even in normal scenarios, the system handles potential issues:

```typescript
// Automatic retry for transient failures
try {
  await this.autopilotProducer.sendPhaseTransition(transitionPayload);
} catch (error) {
  if (this.isTransientError(error)) {
    await this.retryWithBackoff(() => 
      this.autopilotProducer.sendPhaseTransition(transitionPayload)
    );
  } else {
    throw error;
  }
}
```

## Integration Points

The normal scheduling scenario demonstrates integration with:

1. **Kafka Infrastructure** - Event publishing and consumption
2. **Challenge Service** - Phase data retrieval and updates
3. **NestJS Schedule** - Job management and execution
4. **Configuration System** - Environment-based behavior
5. **Monitoring System** - Health checks and metrics
6. **Logging System** - Structured logging and audit trails

This normal scheduling scenario provides the foundation for understanding how the Autopilot-v6 service handles typical challenge phase transitions in production environments. 