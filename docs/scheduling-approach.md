# Event-Based Scheduling Architecture

## Overview

The Topcoder Autopilot-v6 service implements a sophisticated event-based scheduling mechanism that replaces traditional polling with an efficient, responsive system for managing challenge phase transitions. This document provides a comprehensive overview of the architecture, design decisions, and implementation details.

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Autopilot-v6 Service                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  AutopilotService│  │ SchedulerService│  │RecoveryService│ │
│  │                 │  │                 │  │             │  │
│  │ • Phase handling│  │ • Job management│  │ • Startup   │  │
│  │ • Event routing │  │ • Dynamic sched.│  │   recovery  │  │
│  │ • Validation    │  │ • Job lifecycle │  │ • Resilience│  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ScheduleAdjustment│  │  Health Module  │  │Circuit      │  │
│  │    Service      │  │                 │  │ Breakers    │  │
│  │                 │  │ • Monitoring    │  │             │  │
│  │ • Bulk updates  │  │ • Metrics       │  │ • Resilience│  │
│  │ • Conflict res. │  │ • Health checks │  │ • Fallbacks │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   Kafka Events  │  │ NestJS Schedule │  │Configuration│  │
│  │                 │  │                 │  │             │  │
│  │ • Event pub/sub │  │ • SchedulerReg. │  │ • Env vars  │  │
│  │ • Message queue │  │ • Dynamic jobs  │  │ • Validation│  │
│  │ • Persistence   │  │ • Job registry  │  │ • Sections  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
Challenge Service ──┐
                   │
External Events ───┼──► AutopilotService ──► SchedulerService ──► NestJS Schedule
                   │                    │                      │
Kafka Events ──────┘                    │                      ▼
                                        │                 Job Execution
                                        ▼                      │
                               ScheduleAdjustment              ▼
                                   Service                Kafka Publisher
                                        │                      │
Recovery Service ──────────────────────┘                      ▼
        │                                                Event Topics
        ▼
   Active Phases ──► Schedule Recovery ──► Job Scheduling
```

## Design Decisions

### 1. Event-Driven Architecture

**Decision**: Implement event-based scheduling instead of polling
**Rationale**: 
- **Efficiency**: Eliminates unnecessary database queries
- **Responsiveness**: Immediate reaction to phase changes
- **Scalability**: Better resource utilization
- **Reliability**: Event persistence ensures no missed transitions

**Implementation**:
- NestJS Schedule module for dynamic job management
- Kafka for event publishing and consumption
- SchedulerRegistry for runtime job control

### 2. Dynamic Job Management

**Decision**: Use SchedulerRegistry for runtime job control
**Rationale**:
- **Flexibility**: Add/remove jobs without restart
- **Precision**: Exact timing for phase transitions
- **Control**: Full lifecycle management (create, update, cancel)
- **Monitoring**: Real-time job status tracking

**Implementation**:
```typescript
// Job scheduling with unique ID generation
const jobId = this.generateJobId(phaseData);
this.schedulerRegistry.addTimeout(
  jobId,
  () => this.executePhaseTransition(jobId, phaseData),
  delay
);
```

### 3. Resilient Recovery System

**Decision**: Implement comprehensive startup recovery
**Rationale**:
- **Reliability**: Handle service restarts gracefully
- **Consistency**: Ensure no missed phase transitions
- **Edge Cases**: Process overdue phases immediately
- **Monitoring**: Track recovery metrics and success rates

**Implementation**:
- Startup recovery service execution
- Active phase scanning and filtering
- Batch processing for performance
- Comprehensive error handling

### 4. Circuit Breaker Pattern

**Decision**: Implement advanced circuit breaker with multiple states
**Rationale**:
- **Resilience**: Prevent cascading failures
- **Graceful Degradation**: Fallback mechanisms
- **Self-Healing**: Automatic recovery attempts
- **Monitoring**: Detailed failure metrics

**Implementation**:
- Three-state circuit breaker (CLOSED, OPEN, HALF_OPEN)
- Service-specific configurations
- Custom error filtering
- Fallback mechanisms

## API Documentation

### SchedulerService API

#### `schedulePhaseTransition(phaseData: PhaseTransitionScheduleDto): Promise<string>`

Schedules a phase transition event for future execution.

**Parameters**:
- `phaseData`: Phase transition details including timing and metadata

**Returns**: 
- Job ID for tracking and management

**Example**:
```typescript
const jobId = await schedulerService.schedulePhaseTransition({
  projectId: 12345,
  phaseId: 67890,
  phaseTypeName: 'Registration',
  state: 'END',
  endTime: '2024-01-15T10:00:00.000Z',
  operator: 'system',
  projectStatus: 'ACTIVE',
  metadata: { priority: 'high' }
});
```

#### `cancelScheduledTransition(jobId: string): Promise<boolean>`

Cancels a previously scheduled phase transition.

**Parameters**:
- `jobId`: Unique identifier returned from schedulePhaseTransition

**Returns**: 
- Boolean indicating success/failure

**Example**:
```typescript
const cancelled = await schedulerService.cancelScheduledTransition('job-1234567890123-12345-67890');
```

#### `updateScheduledTransition(jobId: string, phaseData: PhaseTransitionScheduleDto): Promise<string>`

Updates an existing scheduled transition with new timing or data.

**Parameters**:
- `jobId`: Existing job identifier
- `phaseData`: Updated phase transition details

**Returns**: 
- New job ID (old job is cancelled, new one created)

**Example**:
```typescript
const newJobId = await schedulerService.updateScheduledTransition(
  'job-1234567890123-12345-67890',
  { ...originalData, endTime: '2024-01-15T11:00:00.000Z' }
);
```

#### `getAllScheduledTransitions(): Promise<ScheduledTransitionInfo[]>`

Retrieves all currently scheduled transitions.

**Returns**: 
- Array of scheduled transition information

**Example**:
```typescript
const scheduled = await schedulerService.getAllScheduledTransitions();
console.log(`${scheduled.length} jobs currently scheduled`);
```

### RecoveryService API

#### `executeStartupRecovery(): Promise<RecoveryResult>`

Executes the complete startup recovery workflow.

**Returns**: 
- Detailed recovery result with metrics and status

**Example**:
```typescript
const result = await recoveryService.executeStartupRecovery();
console.log(`Processed ${result.totalPhasesProcessed} phases in ${result.executionTime}ms`);
```

#### `scanActivePhases(): Promise<PhaseData[]>`

Scans for active phases requiring scheduling.

**Returns**: 
- Array of active phase data

#### `scheduleUpcomingTransitions(phases: PhaseData[]): Promise<void>`

Schedules transitions for upcoming phases.

**Parameters**:
- `phases`: Array of phase data to schedule

#### `processOverduePhases(phases: PhaseData[]): Promise<void>`

Processes phases that are already overdue.

**Parameters**:
- `phases`: Array of overdue phase data

### AutopilotService API

#### `handlePhaseTransition(payload: PhaseTransitionPayload): Promise<void>`

Handles incoming phase transition events.

**Parameters**:
- `payload`: Phase transition event data

#### `handleChallengeUpdate(payload: ChallengeUpdatePayload): Promise<void>`

Handles challenge update events that may affect scheduling.

**Parameters**:
- `payload`: Challenge update event data

#### `handleCommand(payload: CommandPayload): Promise<void>`

Handles administrative commands.

**Parameters**:
- `payload`: Command event data

## Configuration Guide

### Environment Variables

#### Scheduler Configuration

```bash
# Job execution settings
SCHEDULER_JOB_TIMEOUT=60000                    # Job timeout in milliseconds
SCHEDULER_MAX_RETRIES=3                        # Maximum retry attempts
SCHEDULER_RETRY_DELAY=5000                     # Delay between retries

# Performance tuning
SCHEDULER_MAX_CONCURRENT_JOBS=50               # Maximum concurrent jobs
SCHEDULER_CLEANUP_INTERVAL=300000              # Cleanup interval (5 minutes)
SCHEDULER_MAX_COMPLETED_JOB_AGE=3600000        # Keep completed jobs for 1 hour
SCHEDULER_MAX_FAILED_JOB_AGE=86400000          # Keep failed jobs for 24 hours

# Constraints
SCHEDULER_MIN_SCHEDULE_ADVANCE=1000            # Minimum advance time (1 second)
SCHEDULER_MAX_SCHEDULE_ADVANCE=7776000000      # Maximum advance time (90 days)
SCHEDULER_ALLOW_PAST_SCHEDULING=false          # Allow scheduling in the past

# Development
SCHEDULER_ENABLE_DEBUG_LOGGING=true            # Enable debug logging
SCHEDULER_LOG_JOB_DETAILS=true                 # Log detailed job information
```

#### Recovery Configuration

```bash
# Startup recovery
RECOVERY_ENABLED=true                          # Enable recovery on startup
RECOVERY_STARTUP_TIMEOUT=120000                # Recovery timeout (2 minutes)

# Phase processing
RECOVERY_MAX_CONCURRENT_PHASES=10              # Concurrent phase processing
RECOVERY_PHASE_TIMEOUT=30000                   # Phase operation timeout
RECOVERY_PROCESS_OVERDUE_PHASES=true           # Process overdue phases
RECOVERY_SKIP_INVALID_PHASES=true              # Skip invalid phase data
RECOVERY_MAX_PHASE_AGE_HOURS=72                # Maximum phase age (3 days)

# Batch processing
RECOVERY_MAX_BATCH_SIZE=50                     # Maximum batch size
RECOVERY_BATCH_DELAY=100                       # Delay between batches

# Challenge service
RECOVERY_CHALLENGE_SERVICE_TIMEOUT=15000       # Challenge service timeout
RECOVERY_CHALLENGE_SERVICE_RETRIES=3           # Challenge service retries
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=false     # Use mock data
```

#### Circuit Breaker Configuration

```bash
# Scheduler circuit breaker
CIRCUIT_BREAKER_SCHEDULER_FAILURE_THRESHOLD=5     # Failures before opening
CIRCUIT_BREAKER_SCHEDULER_RESET_TIMEOUT=60000     # Reset timeout (1 minute)
CIRCUIT_BREAKER_SCHEDULER_SUCCESS_THRESHOLD=3     # Successes to close

# Recovery circuit breaker
CIRCUIT_BREAKER_RECOVERY_FAILURE_THRESHOLD=3      # Failures before opening
CIRCUIT_BREAKER_RECOVERY_RESET_TIMEOUT=120000     # Reset timeout (2 minutes)
CIRCUIT_BREAKER_RECOVERY_SUCCESS_THRESHOLD=2      # Successes to close

# Challenge service circuit breaker
CIRCUIT_BREAKER_CHALLENGE_FAILURE_THRESHOLD=5     # Failures before opening
CIRCUIT_BREAKER_CHALLENGE_RESET_TIMEOUT=30000     # Reset timeout (30 seconds)
CIRCUIT_BREAKER_CHALLENGE_SUCCESS_THRESHOLD=2     # Successes to close
```

### Configuration Sections

#### Scheduler Section (`scheduler`)

```typescript
{
  job: {
    timeout: 60000,           // Job execution timeout
    maxRetries: 3,            // Maximum retry attempts
    retryDelay: 5000,         // Delay between retries
  },
  performance: {
    maxConcurrentJobs: 50,    // Concurrent job limit
    cleanupInterval: 300000,  // Cleanup interval
    enableDebugLogging: true, // Debug logging
  },
  constraints: {
    minScheduleAdvance: 1000,        // Minimum advance time
    maxScheduleAdvance: 7776000000,  // Maximum advance time
    allowPastScheduling: false,      // Allow past scheduling
  }
}
```

#### Recovery Section (`recovery`)

```typescript
{
  startup: {
    enabled: true,            // Enable startup recovery
    timeout: 120000,          // Recovery timeout
  },
  phases: {
    maxConcurrentPhases: 10,  // Concurrent processing
    phaseOperationTimeout: 30000, // Operation timeout
    processOverduePhases: true,   // Process overdue phases
    skipInvalidPhases: true,      // Skip invalid data
    maxPhaseAge: 72,             // Maximum phase age (hours)
  },
  challengeService: {
    timeout: 15000,           // Service timeout
    retries: 3,               // Retry attempts
    mockMode: false,          // Use mock data
  }
}
```

## Performance Characteristics

### Scalability Metrics

- **Job Scheduling**: < 100ms per job
- **Batch Processing**: 1000+ phases in < 30 seconds
- **Recovery Time**: Complete recovery in < 2 minutes
- **Memory Usage**: Linear scaling with active jobs
- **CPU Usage**: Minimal overhead for scheduled jobs

### Monitoring and Metrics

#### Health Check Endpoints

- `GET /health` - Overall system health
- `GET /health/scheduler` - Scheduler service health
- `GET /health/recovery` - Recovery service health
- `GET /health/kafka` - Kafka connectivity health

#### Key Metrics

- **Active Jobs Count**: Number of currently scheduled jobs
- **Completed Jobs**: Successfully executed transitions
- **Failed Jobs**: Failed transition attempts
- **Recovery Success Rate**: Startup recovery success percentage
- **Average Execution Time**: Mean job execution duration
- **Circuit Breaker States**: Service resilience status

### Error Handling Strategy

#### Error Categories

1. **Validation Errors**: Invalid input data
2. **Scheduling Errors**: Job management failures
3. **Network Errors**: External service failures
4. **System Errors**: Infrastructure failures

#### Recovery Mechanisms

1. **Automatic Retry**: Configurable retry with exponential backoff
2. **Circuit Breaker**: Service protection and fallback
3. **Graceful Degradation**: Partial functionality maintenance
4. **Manual Recovery**: Administrative override capabilities

## Security Considerations

### Authentication and Authorization

- JWT-based authentication for API endpoints
- Role-based access control for administrative functions
- Secure configuration management

### Data Protection

- Input validation and sanitization
- Secure logging (no sensitive data)
- Encrypted communication channels

### Audit Trail

- Comprehensive logging of all operations
- Schedule change audit logs
- Error tracking and reporting

## Integration Points

### External Services

1. **Challenge Service**: Phase data retrieval
2. **Kafka Cluster**: Event publishing and consumption
3. **Configuration Service**: Dynamic configuration updates
4. **Monitoring Systems**: Metrics and alerting

### Internal Dependencies

1. **NestJS Schedule**: Job management infrastructure
2. **Configuration Module**: Environment-based settings
3. **Logger Service**: Structured logging
4. **Health Module**: System monitoring

## Future Enhancements

### Planned Features

1. **Distributed Scheduling**: Multi-instance coordination
2. **Advanced Metrics**: Performance analytics
3. **Dynamic Configuration**: Runtime configuration updates
4. **Enhanced Monitoring**: Real-time dashboards

### Extensibility Points

1. **Custom Schedulers**: Pluggable scheduling strategies
2. **Event Handlers**: Additional event type support
3. **Recovery Strategies**: Configurable recovery behaviors
4. **Notification Systems**: Alert and notification integration

## Troubleshooting Guide

### Common Issues

#### Jobs Not Executing

**Symptoms**: Scheduled jobs remain in pending state
**Causes**: 
- System clock synchronization issues
- High system load
- Scheduler service errors

**Resolution**:
1. Check system time synchronization
2. Monitor system resources
3. Review scheduler service logs
4. Restart scheduler service if necessary

#### Recovery Failures

**Symptoms**: Startup recovery reports failures
**Causes**:
- Challenge service unavailability
- Network connectivity issues
- Invalid phase data

**Resolution**:
1. Verify challenge service connectivity
2. Check network configuration
3. Review recovery service logs
4. Validate phase data format

#### High Memory Usage

**Symptoms**: Increasing memory consumption over time
**Causes**:
- Job registry not cleaning up completed jobs
- Memory leaks in job callbacks
- Large number of concurrent jobs

**Resolution**:
1. Adjust cleanup intervals
2. Monitor job completion rates
3. Review concurrent job limits
4. Restart service if memory usage is excessive

### Debugging Tools

#### Log Analysis

```bash
# Filter scheduler logs
grep "SchedulerService" logs/application.log

# Monitor job execution
grep "Executed phase transition" logs/application.log

# Check recovery operations
grep "RecoveryService" logs/application.log
```

#### Health Check Monitoring

```bash
# Check overall health
curl http://localhost:3000/health

# Monitor scheduler health
curl http://localhost:3000/health/scheduler

# Check recovery status
curl http://localhost:3000/health/recovery
```

#### Job Status Inspection

```typescript
// Get all scheduled jobs
const jobs = await schedulerService.getAllScheduledTransitions();
console.log('Active jobs:', jobs.length);

// Check specific job
const job = jobs.find(j => j.projectId === 12345);
console.log('Job status:', job?.status);
```

This documentation provides a comprehensive guide to the event-based scheduling architecture, enabling developers and operators to understand, configure, and maintain the system effectively.