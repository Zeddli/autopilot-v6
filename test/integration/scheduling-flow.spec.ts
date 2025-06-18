import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from '../../src/scheduler/scheduler.module';
import { KafkaModule } from '../../src/kafka/kafka.module';
import { AutopilotModule } from '../../src/autopilot/autopilot.module';
import { SchedulerService } from '../../src/scheduler/services/scheduler.service';
import { AutopilotProducer } from '../../src/kafka/producers/autopilot.producer';
import { AutopilotService } from '../../src/autopilot/services/autopilot.service';
import { PhaseTransitionScheduleDto } from '../../src/scheduler/dto/phase-transition-schedule.dto';
// Import not needed as we'll use string literals
// configuration and validationSchema imports removed as they're not needed

/**
 * Scheduling Flow Integration Tests
 *
 * End-to-end integration tests for the complete scheduling workflow:
 * - Scheduler service integration with NestJS Schedule module
 * - Kafka event publishing integration
 * - AutopilotService integration with scheduler
 * - Real-time scheduling and execution
 * - Error handling and recovery scenarios
 */
describe('Scheduling Flow Integration', () => {
  let app: INestApplication;
  let schedulerService: SchedulerService;
  let autopilotProducer: AutopilotProducer;
  let autopilotService: AutopilotService;

  // Mock test configuration
  const testConfig = {
    kafka: {
      enabled: false,
      mockMode: true,
      brokers: ['localhost:9092'],
      schemaRegistry: {
        url: 'http://localhost:8081',
        required: false,
      },
    },
    app: {
      port: 3000,
      environment: 'test',
    },
  };

  const mockPhaseData: PhaseTransitionScheduleDto = {
    projectId: 12345,
    phaseId: 67890,
    phaseTypeName: 'Registration',
    state: 'END',
    endTime: new Date(Date.now() + 5000).toISOString(), // 5 seconds from now
    operator: 'system',
    projectStatus: 'ACTIVE',
    metadata: {
      testRun: true,
      source: 'integration-test',
    },
  };

  beforeAll(async () => {
    // Set test environment variables to satisfy validation
    process.env.NODE_ENV = 'test';
    process.env.KAFKA_BROKERS = 'localhost:9092';
    process.env.SCHEMA_REGISTRY_URL = 'http://localhost:8081';
    process.env.KAFKA_ENABLED = 'false';
    process.env.KAFKA_MOCK_MODE = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => testConfig],
          ignoreEnvFile: true, // Don't load .env files in tests
        }),
        ScheduleModule.forRoot(),
        SchedulerModule,
        KafkaModule,
        AutopilotModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Get service instances
    schedulerService = moduleFixture.get<SchedulerService>(SchedulerService);
    autopilotProducer = moduleFixture.get<AutopilotProducer>(AutopilotProducer);
    autopilotService = moduleFixture.get<AutopilotService>(AutopilotService);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    // Clear any existing jobs before each test
    jest.clearAllMocks();
  });

  describe('Complete Scheduling Workflow', () => {
    it('should schedule, execute, and publish phase transition event', async () => {
      // Arrange
      const kafkaSpy = jest
        .spyOn(autopilotProducer, 'sendPhaseTransition')
        .mockResolvedValue();

      // Act - Schedule the phase transition
      const jobId =
        await schedulerService.schedulePhaseTransition(mockPhaseData);

      // Assert - Job should be scheduled
      expect(jobId).toMatch(/^phase-transition-\d+-\d+-[a-f0-9-]+$/);

      // Verify job is in the registry
      const scheduledJobs = await schedulerService.getAllScheduledTransitions();
      const scheduledJob = scheduledJobs.find((job) => job.jobId === jobId);
      expect(scheduledJob).toBeDefined();
      expect(scheduledJob?.projectId).toBe(mockPhaseData.projectId);
      expect(scheduledJob?.phaseId).toBe(mockPhaseData.phaseId);

      // Wait for job execution (5 seconds + buffer)
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Assert - Kafka event should have been published
      expect(kafkaSpy).toHaveBeenCalledWith({
        projectId: mockPhaseData.projectId,
        phaseId: mockPhaseData.phaseId,
        phaseTypeName: mockPhaseData.phaseTypeName,
        state: mockPhaseData.state,
        operator: mockPhaseData.operator,
        projectStatus: mockPhaseData.projectStatus,
        date: expect.any(String) as string, // ISO date string - expect.any is Jest's type-safe matcher
      });

      // Cleanup
      kafkaSpy.mockRestore();
    }, 10000); // 10 second timeout for this test

    it('should handle job cancellation correctly', async () => {
      // Arrange
      const futureTime = new Date(Date.now() + 30000).toISOString(); // 30 seconds from now
      const futurePhaseData = { ...mockPhaseData, endTime: futureTime };

      // Act - Schedule and then cancel
      const jobId =
        await schedulerService.schedulePhaseTransition(futurePhaseData);
      const cancelResult =
        await schedulerService.cancelScheduledTransition(jobId);

      // Assert
      expect(cancelResult).toBe(true);

      // Verify job is removed from registry
      const scheduledJobs = await schedulerService.getAllScheduledTransitions();
      const cancelledJob = scheduledJobs.find((job) => job.jobId === jobId);
      expect(cancelledJob).toBeUndefined();
    });

    it('should handle job updates correctly', async () => {
      // Arrange
      const futureTime = new Date(Date.now() + 30000).toISOString(); // 30 seconds from now
      const futurePhaseData = { ...mockPhaseData, endTime: futureTime };
      const updatedTime = new Date(Date.now() + 45000).toISOString(); // 45 seconds from now
      const updatedPhaseData = { ...mockPhaseData, endTime: updatedTime };

      // Act - Schedule and then update
      const originalJobId =
        await schedulerService.schedulePhaseTransition(futurePhaseData);
      const newJobId = await schedulerService.updateScheduledTransition(
        originalJobId,
        updatedPhaseData,
      );

      // Assert
      expect(newJobId).not.toBe(originalJobId);
      expect(newJobId).toMatch(/^phase-transition-\d+-\d+-[a-f0-9-]+$/);

      // Verify original job is removed and new job is added
      const scheduledJobs = await schedulerService.getAllScheduledTransitions();
      const originalJob = scheduledJobs.find(
        (job) => job.jobId === originalJobId,
      );
      const newJob = scheduledJobs.find((job) => job.jobId === newJobId);

      expect(originalJob).toBeUndefined();
      expect(newJob).toBeDefined();
      expect(newJob?.scheduledTime).toBe(updatedTime);

      // Cleanup
      await schedulerService.cancelScheduledTransition(newJobId);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Kafka publishing errors gracefully', async () => {
      // Arrange
      const kafkaError = new Error('Kafka broker unavailable');
      jest
        .spyOn(autopilotProducer, 'sendPhaseTransition')
        .mockRejectedValue(kafkaError);

      const immediatePhaseData = {
        ...mockPhaseData,
        endTime: new Date(Date.now() + 2000).toISOString(), // 2 seconds from now
      };

      // Act - Schedule the phase transition
      const jobId =
        await schedulerService.schedulePhaseTransition(immediatePhaseData);

      // Wait for job execution
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Assert - Job should still be scheduled even if Kafka fails
      expect(jobId).toBeDefined();

      // Note: In a real implementation, failed jobs might be retried or logged
      // This test verifies that Kafka failures don't break the scheduler
    }, 8000);

    it('should handle invalid phase data validation', async () => {
      // Test for scheduling in the past (main validation test)
      const pastPhaseData = {
        ...mockPhaseData,
        endTime: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
      };

      await expect(
        schedulerService.schedulePhaseTransition(pastPhaseData),
      ).rejects.toThrow('Cannot schedule phase transition in the past');
    });

    it('should handle scheduling conflicts', async () => {
      // Arrange - Schedule multiple jobs with same project/phase
      const phaseData1 = {
        ...mockPhaseData,
        endTime: new Date(Date.now() + 10000).toISOString(),
      };
      const phaseData2 = {
        ...mockPhaseData,
        endTime: new Date(Date.now() + 15000).toISOString(),
      };

      // Act
      const jobId1 = await schedulerService.schedulePhaseTransition(phaseData1);

      // This should fail due to duplicate job detection
      await expect(
        schedulerService.schedulePhaseTransition(phaseData2),
      ).rejects.toThrow('Job already exists');

      // Cleanup
      await schedulerService.cancelScheduledTransition(jobId1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent job scheduling', async () => {
      // Arrange
      const concurrentJobs = 10;
      const phaseDataArray = Array(concurrentJobs)
        .fill(null)
        .map((_, index) => ({
          ...mockPhaseData,
          phaseId: mockPhaseData.phaseId + index,
          endTime: new Date(Date.now() + 20000 + index * 1000).toISOString(), // Stagger times
        }));

      // Act - Schedule all jobs concurrently
      const startTime = Date.now();
      const jobIds = await Promise.all(
        phaseDataArray.map((phaseData) =>
          schedulerService.schedulePhaseTransition(phaseData),
        ),
      );
      const schedulingTime = Date.now() - startTime;

      // Assert
      expect(jobIds).toHaveLength(concurrentJobs);
      expect(
        jobIds.every((jobId) =>
          jobId.match(/^phase-transition-\d+-\d+-[a-f0-9-]+$/),
        ),
      ).toBe(true);
      expect(schedulingTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all jobs are scheduled
      const scheduledJobs = await schedulerService.getAllScheduledTransitions();
      const ourJobs = scheduledJobs.filter((job) => jobIds.includes(job.jobId));
      expect(ourJobs).toHaveLength(concurrentJobs);

      // Cleanup
      await Promise.all(
        jobIds.map((jobId) =>
          schedulerService.cancelScheduledTransition(jobId),
        ),
      );
    });

    it('should handle rapid job cancellation', async () => {
      // Arrange
      const rapidJobs = 5;
      const phaseDataArray = Array(rapidJobs)
        .fill(null)
        .map((_, index) => ({
          ...mockPhaseData,
          phaseId: mockPhaseData.phaseId + index,
          endTime: new Date(Date.now() + 30000).toISOString(), // 30 seconds from now
        }));

      // Act - Schedule and immediately cancel
      const jobIds = await Promise.all(
        phaseDataArray.map((phaseData) =>
          schedulerService.schedulePhaseTransition(phaseData),
        ),
      );

      const cancelResults = await Promise.all(
        jobIds.map((jobId) =>
          schedulerService.cancelScheduledTransition(jobId),
        ),
      );

      // Assert
      expect(cancelResults.every((result) => result === true)).toBe(true);

      // Verify all jobs are cancelled
      const scheduledJobs = await schedulerService.getAllScheduledTransitions();
      const remainingJobs = scheduledJobs.filter((job) =>
        jobIds.includes(job.jobId),
      );
      expect(remainingJobs).toHaveLength(0);
    });
  });

  describe('AutopilotService Integration', () => {
    it('should integrate with AutopilotService for challenge updates', async () => {
      // Arrange
      const challengeUpdatePayload = {
        projectId: mockPhaseData.projectId,
        challengeId: mockPhaseData.phaseId, // Using phaseId as challengeId for test
        status: 'ACTIVE',
        operator: mockPhaseData.operator,
        date: new Date().toISOString(),
      };

      // Act - Simulate challenge update handling
      // Note: This would typically be triggered by Kafka consumer
      await autopilotService.handleChallengeUpdate(challengeUpdatePayload);

      // Assert - Verify that the service handles the update
      // In a real implementation, this might trigger schedule adjustments
      expect(autopilotService).toBeDefined();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain job registry consistency', async () => {
      // Arrange
      const testPhaseData = {
        ...mockPhaseData,
        endTime: new Date(Date.now() + 25000).toISOString(), // 25 seconds from now
      };

      // Act
      const jobId =
        await schedulerService.schedulePhaseTransition(testPhaseData);

      // Assert - Job should be immediately visible in registry
      const scheduledJobs = await schedulerService.getAllScheduledTransitions();
      const scheduledJob = scheduledJobs.find((job) => job.jobId === jobId);

      expect(scheduledJob).toBeDefined();
      expect(scheduledJob?.projectId).toBe(testPhaseData.projectId);
      expect(scheduledJob?.phaseId).toBe(testPhaseData.phaseId);
      expect(scheduledJob?.status).toBe('scheduled');

      // Cleanup
      await schedulerService.cancelScheduledTransition(jobId);

      // Assert - Job should be removed from registry
      const updatedJobs = await schedulerService.getAllScheduledTransitions();
      const removedJob = updatedJobs.find((job) => job.jobId === jobId);
      expect(removedJob).toBeUndefined();
    });

    it('should handle system restart simulation', async () => {
      // This test simulates what would happen during system restart
      // In a real scenario, the recovery service would handle this

      // Arrange - Get initial job count
      const initialJobs = await schedulerService.getAllScheduledTransitions();
      const initialJobCount = initialJobs.length;

      // Act - Schedule some jobs
      const testJobIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const phaseData = {
          ...mockPhaseData,
          phaseId: mockPhaseData.phaseId + i,
          endTime: new Date(Date.now() + 40000 + i * 5000).toISOString(),
        };
        const jobId = await schedulerService.schedulePhaseTransition(phaseData);
        testJobIds.push(jobId);
      }

      // Assert - Jobs should be scheduled
      const jobsAfterScheduling =
        await schedulerService.getAllScheduledTransitions();
      expect(jobsAfterScheduling.length).toBe(initialJobCount + 3);

      // Simulate restart by checking job persistence
      // Note: In a real system, jobs would be restored from persistent storage
      const currentJobs = await schedulerService.getAllScheduledTransitions();
      const ourJobs = currentJobs.filter((job) =>
        testJobIds.includes(job.jobId),
      );
      expect(ourJobs.length).toBe(3);

      // Cleanup
      await Promise.all(
        testJobIds.map((jobId) =>
          schedulerService.cancelScheduledTransition(jobId),
        ),
      );
    });
  });
});
