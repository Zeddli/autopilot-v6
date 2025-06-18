import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IRecoveryService,
  PhaseData,
  RecoveryOptions,
  RecoveryMetrics,
  RecoveryStatus,
  PhaseFilterCriteria,
} from '../interfaces/recovery.interface';
import { SchedulerService } from '../../scheduler/services/scheduler.service';
import { PhaseTransitionScheduleDto } from '../../scheduler/dto/phase-transition-schedule.dto';
import { PhaseState } from '../../scheduler/types/scheduler.types';

/**
 * RecoveryService
 *
 * Core service responsible for handling startup recovery operations.
 * This service ensures that any missed or interrupted phase transitions
 * are properly scheduled or executed when the application starts up.
 *
 * Key responsibilities:
 * - Execute complete startup recovery process
 * - Scan for active phases that need scheduling
 * - Schedule upcoming phase transitions
 * - Process overdue phases immediately
 * - Handle edge cases and error scenarios
 * - Provide recovery metrics and monitoring
 */
@Injectable()
export class RecoveryService implements IRecoveryService {
  private readonly logger = new Logger(RecoveryService.name);
  private recoveryMetrics: RecoveryMetrics;
  private readonly recoveryOptions: RecoveryOptions;

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly configService: ConfigService,
  ) {
    // Initialize recovery metrics
    this.recoveryMetrics = {
      lastRecoveryTime: new Date(0),
      lastRecoveryDuration: 0,
      lastRecoveryCount: 0,
      totalRecoveryOperations: 0,
      failedRecoveryOperations: 0,
      status: RecoveryStatus.NOT_STARTED,
    };

    // Initialize recovery options from configuration
    this.recoveryOptions = {
      maxConcurrentPhases: this.configService.get<number>(
        'RECOVERY_MAX_CONCURRENT_PHASES',
        10,
      ),
      phaseOperationTimeout: this.configService.get<number>(
        'RECOVERY_PHASE_TIMEOUT',
        30000,
      ),
      processOverduePhases: this.configService.get<boolean>(
        'RECOVERY_PROCESS_OVERDUE',
        true,
      ),
      skipInvalidPhases: this.configService.get<boolean>(
        'RECOVERY_SKIP_INVALID',
        true,
      ),
      maxPhaseAge: this.configService.get<number>(
        'RECOVERY_MAX_PHASE_AGE_HOURS',
        72,
      ),
    };

    this.logger.log(
      `RecoveryService initialized with options:`,
      this.recoveryOptions,
    );
  }

  /**
   * Execute the complete startup recovery process
   * This is the main entry point called on application startup
   *
   * @returns Promise<void>
   */
  async executeStartupRecovery(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('Starting startup recovery process...');

    try {
      // Update recovery status
      this.recoveryMetrics.status = RecoveryStatus.IN_PROGRESS;

      // Step 1: Scan for active phases
      this.logger.log('Step 1: Scanning for active phases...');
      const activePhases = await this.scanActivePhases();

      if (activePhases.length === 0) {
        this.logger.log('No active phases found, recovery completed');
        this.updateRecoveryMetrics(startTime, 0, true);
        return;
      }

      this.logger.log(`Found ${activePhases.length} active phases to process`);

      // Step 2: Separate upcoming and overdue phases
      const currentTime = new Date();
      const upcomingPhases = activePhases.filter(
        (phase) => new Date(phase.endTime) > currentTime,
      );
      const overduePhases = activePhases.filter(
        (phase) => new Date(phase.endTime) <= currentTime,
      );

      this.logger.log(
        `Upcoming phases: ${upcomingPhases.length}, Overdue phases: ${overduePhases.length}`,
      );

      // Step 3: Schedule upcoming transitions
      if (upcomingPhases.length > 0) {
        this.logger.log('Step 2: Scheduling upcoming phase transitions...');
        await this.scheduleUpcomingTransitions(upcomingPhases);
      }

      // Step 4: Process overdue phases
      if (
        overduePhases.length > 0 &&
        this.recoveryOptions.processOverduePhases
      ) {
        this.logger.log('Step 3: Processing overdue phases...');
        await this.processOverduePhases(overduePhases);
      }

      // Update recovery metrics
      this.updateRecoveryMetrics(startTime, activePhases.length, true);

      this.logger.log(
        `Startup recovery completed successfully. Processed ${activePhases.length} phases in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error('Startup recovery failed:', error);
      this.updateRecoveryMetrics(startTime, 0, false);
      this.recoveryMetrics.status = RecoveryStatus.FAILED;
      throw error;
    }
  }

  /**
   * Scan for all active phases that need scheduling
   * Fetches data from challenge service and filters relevant phases
   *
   * @returns Promise<PhaseData[]> - Array of active phases
   */
  async scanActivePhases(): Promise<PhaseData[]> {
    this.logger.log('Scanning for active phases...');

    try {
      // TODO: Replace with actual challenge service API call
      // For now, return mock data for demonstration
      const mockPhases = await this.fetchActivePhasesFromChallengeService();

      // Filter phases based on criteria
      const filteredPhases = this.filterPhases(
        mockPhases,
        this.getDefaultFilterCriteria(),
      );

      this.logger.log(
        `Scanned ${mockPhases.length} phases, ${filteredPhases.length} passed filtering`,
      );
      return filteredPhases;
    } catch (error) {
      this.logger.error('Failed to scan active phases:', error);
      throw error;
    }
  }

  /**
   * Schedule upcoming phase transitions
   * Processes phases with future end times and schedules them
   *
   * @param phases - Array of phase data to schedule
   * @returns Promise<void>
   */
  async scheduleUpcomingTransitions(phases: PhaseData[]): Promise<void> {
    this.logger.log(
      `Scheduling ${phases.length} upcoming phase transitions...`,
    );

    const results = {
      scheduled: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process phases in batches to avoid overwhelming the system
    const batchSize = this.recoveryOptions.maxConcurrentPhases || 10;

    for (let i = 0; i < phases.length; i += batchSize) {
      const batch = phases.slice(i, i + batchSize);
      this.logger.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(phases.length / batchSize)} (${batch.length} phases)`,
      );

      // Process batch in parallel
      const batchPromises = batch.map((phase) =>
        this.schedulePhaseTransition(phase),
      );
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.scheduled++;
          this.logger.log(
            `Successfully scheduled phase ${batch[index].phaseId} (project ${batch[index].projectId})`,
          );
        } else {
          results.failed++;
          const errorMsg = `Failed to schedule phase ${batch[index].phaseId}: ${result.reason}`;
          results.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      });
    }

    this.logger.log(
      `Upcoming transitions scheduled: ${results.scheduled} successful, ${results.failed} failed`,
    );

    if (results.errors.length > 0) {
      this.logger.warn(`Scheduling errors:`, results.errors);
    }
  }

  /**
   * Process phases that are overdue (past their end time)
   * Immediately triggers phase transitions for overdue phases
   *
   * @param phases - Array of overdue phase data
   * @returns Promise<void>
   */
  async processOverduePhases(phases: PhaseData[]): Promise<void> {
    this.logger.log(`Processing ${phases.length} overdue phases...`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process overdue phases in smaller batches to prevent overwhelming the system
    const batchSize = Math.min(
      this.recoveryOptions.maxConcurrentPhases || 10,
      5,
    );

    for (let i = 0; i < phases.length; i += batchSize) {
      const batch = phases.slice(i, i + batchSize);
      this.logger.log(
        `Processing overdue batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(phases.length / batchSize)} (${batch.length} phases)`,
      );

      // Process batch in parallel
      const batchPromises = batch.map((phase) =>
        this.processOverduePhase(phase),
      );
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.processed++;
          this.logger.log(
            `Successfully processed overdue phase ${batch[index].phaseId} (project ${batch[index].projectId})`,
          );
        } else {
          results.failed++;
          const errorMsg = `Failed to process overdue phase ${batch[index].phaseId}: ${result.reason}`;
          results.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      });
    }

    this.logger.log(
      `Overdue phases processed: ${results.processed} successful, ${results.failed} failed`,
    );

    if (results.errors.length > 0) {
      this.logger.warn(`Processing errors:`, results.errors);
    }
  }

  /**
   * Get recovery metrics for monitoring and health checks
   *
   * @returns RecoveryMetrics
   */
  getRecoveryMetrics(): RecoveryMetrics {
    return { ...this.recoveryMetrics };
  }

  /**
   * Private helper method to schedule a single phase transition
   *
   * @param phase - Phase data to schedule
   * @returns Promise<string> - Job ID of scheduled transition
   */
  private async schedulePhaseTransition(phase: PhaseData): Promise<string> {
    try {
      // Validate phase data
      this.validatePhaseData(phase);

      // Create schedule DTO
      const scheduleDto: PhaseTransitionScheduleDto = {
        projectId: phase.projectId,
        phaseId: phase.phaseId,
        phaseTypeName: phase.phaseTypeName,
        state: 'END' as PhaseState, // Recovery always schedules END transitions
        endTime: new Date(phase.endTime).toISOString(),
        projectStatus: phase.projectStatus,
        operator: phase.operator,
        metadata: phase.metadata,
      };

      // Schedule the phase transition
      const jobId =
        await this.schedulerService.schedulePhaseTransition(scheduleDto);

      return jobId;
    } catch (error) {
      this.logger.error(
        `Failed to schedule phase transition for phase ${phase.phaseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Private helper method to process a single overdue phase
   *
   * @param phase - Overdue phase data to process
   * @returns Promise<void>
   */
  private async processOverduePhase(phase: PhaseData): Promise<void> {
    try {
      const endTimeString = new Date(phase.endTime).toISOString();
      this.logger.log(
        `Processing overdue phase ${phase.phaseId} (project ${phase.projectId}) - was due at ${endTimeString}`,
      );

      // For overdue phases, we trigger immediate execution
      // This could be done by directly publishing the phase transition event
      // TODO: Implement immediate phase transition execution
      // For now, we'll log the action

      const overdueMinutes = Math.floor(
        (Date.now() - new Date(phase.endTime).getTime()) / (1000 * 60),
      );
      this.logger.warn(
        `Phase ${String(phase.phaseId)} is ${overdueMinutes} minutes overdue - immediate processing needed`,
      );

      // TODO: Replace with actual immediate phase transition execution
      // This would be an actual async operation in the real implementation
      await Promise.resolve();
    } catch (error) {
      this.logger.error(
        `Failed to process overdue phase ${String(phase.phaseId)}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Private helper method to fetch active phases from challenge service
   *
   * @returns Promise<PhaseData[]>
   */
  private async fetchActivePhasesFromChallengeService(): Promise<PhaseData[]> {
    // TODO: Replace with actual challenge service API call
    // For now, return mock data for demonstration

    this.logger.log(
      'Fetching active phases from challenge service (MOCK DATA)...',
    );

    // Simulate async operation
    await Promise.resolve();

    // Mock implementation - replace with actual API call
    const mockPhases: PhaseData[] = [
      {
        projectId: 123456,
        phaseId: 789012,
        phaseTypeName: 'Submission',
        state: 'START' as PhaseState,
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        projectStatus: 'ACTIVE',
        operator: 'autopilot-recovery',
        metadata: { source: 'recovery' },
      },
      {
        projectId: 123457,
        phaseId: 789013,
        phaseTypeName: 'Review',
        state: 'START' as PhaseState,
        endTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago (overdue)
        projectStatus: 'ACTIVE',
        operator: 'autopilot-recovery',
        metadata: { source: 'recovery' },
      },
    ];

    return mockPhases;
  }

  /**
   * Private helper method to filter phases based on criteria
   *
   * @param phases - Array of phases to filter
   * @param criteria - Filtering criteria
   * @returns PhaseData[]
   */
  private filterPhases(
    phases: PhaseData[],
    criteria: PhaseFilterCriteria,
  ): PhaseData[] {
    return phases.filter((phase) => {
      // Filter by allowed states
      if (
        criteria.allowedStates &&
        !criteria.allowedStates.includes(phase.state)
      ) {
        return false;
      }

      // Filter by allowed project statuses
      if (
        criteria.allowedProjectStatuses &&
        !criteria.allowedProjectStatuses.includes(phase.projectStatus)
      ) {
        return false;
      }

      // Filter by end time range
      const endTime = new Date(phase.endTime);
      if (criteria.minEndTime && endTime < new Date(criteria.minEndTime)) {
        return false;
      }
      if (criteria.maxEndTime && endTime > new Date(criteria.maxEndTime)) {
        return false;
      }

      // Filter by phase age
      if (this.recoveryOptions.maxPhaseAge) {
        const maxAge = this.recoveryOptions.maxPhaseAge * 60 * 60 * 1000; // Convert hours to milliseconds
        const phaseAge = Date.now() - endTime.getTime();
        if (phaseAge > maxAge) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Private helper method to get default filter criteria
   *
   * @returns PhaseFilterCriteria
   */
  private getDefaultFilterCriteria(): PhaseFilterCriteria {
    return {
      allowedStates: ['START', 'END'] as PhaseState[],
      allowedProjectStatuses: ['ACTIVE', 'DRAFT'],
      minEndTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      maxEndTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    };
  }

  /**
   * Private helper method to validate phase data
   *
   * @param phase - Phase data to validate
   * @throws Error if phase data is invalid
   */
  private validatePhaseData(phase: PhaseData): void {
    if (!phase.projectId || phase.projectId <= 0) {
      throw new Error(`Invalid project ID: ${phase.projectId}`);
    }

    if (!phase.phaseId || phase.phaseId <= 0) {
      throw new Error(`Invalid phase ID: ${phase.phaseId}`);
    }

    if (!phase.phaseTypeName || phase.phaseTypeName.trim() === '') {
      throw new Error(`Invalid phase type name: ${phase.phaseTypeName}`);
    }

    if (!phase.endTime) {
      throw new Error(`Invalid end time: ${String(phase.endTime)}`);
    }

    // Validate end time is a valid date
    const endTime = new Date(phase.endTime);
    if (isNaN(endTime.getTime())) {
      throw new Error(`Invalid end time format: ${endTime.toISOString()}`);
    }

    if (!phase.projectStatus || phase.projectStatus.trim() === '') {
      throw new Error(`Invalid project status: ${phase.projectStatus}`);
    }

    if (!phase.operator || phase.operator.trim() === '') {
      throw new Error(`Invalid operator: ${phase.operator}`);
    }
  }

  /**
   * Private helper method to update recovery metrics
   *
   * @param startTime - Start time of recovery operation
   * @param processedCount - Number of phases processed
   * @param success - Whether recovery was successful
   */
  private updateRecoveryMetrics(
    startTime: number,
    processedCount: number,
    success: boolean,
  ): void {
    const duration = Date.now() - startTime;

    this.recoveryMetrics.lastRecoveryTime = new Date();
    this.recoveryMetrics.lastRecoveryDuration = duration;
    this.recoveryMetrics.lastRecoveryCount = processedCount;
    this.recoveryMetrics.totalRecoveryOperations++;

    if (success) {
      this.recoveryMetrics.status = RecoveryStatus.COMPLETED;
    } else {
      this.recoveryMetrics.failedRecoveryOperations++;
      this.recoveryMetrics.status = RecoveryStatus.FAILED;
    }
  }
}
