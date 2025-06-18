import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AutopilotConsumer } from './kafka/consumers/autopilot.consumer';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggerService } from './common/services/logger.service';
import { RecoveryService } from './recovery/services/recovery.service';
import { ConfigService } from '@nestjs/config';

/**
 * Interface for Kafka configuration to ensure type safety
 */
interface KafkaConfig {
  enabled: boolean;
  mockMode: boolean;
  brokers?: string[];
  groupId?: string;
}

/**
 * Bootstrap function for the Autopilot application
 *
 * Initializes the NestJS application with all necessary components:
 * - Global pipes, interceptors, and filters
 * - Recovery service for startup phase scheduling
 * - Kafka consumers for event processing (disabled in test mode)
 * - Graceful shutdown handling
 *
 * Environment-aware startup:
 * - Production: Full Kafka connectivity required
 * - Test: Runs in mock mode without real Kafka connections
 * - Development: Configurable via environment variables
 */
async function bootstrap() {
  const logger = new LoggerService('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new LoggerService('Bootstrap'),
  });

  // Get configuration service for environment checks with proper typing
  const configService = app.get(ConfigService);
  const kafkaConfig = configService.get<KafkaConfig>('kafka');
  const isTestEnvironment = process.env.NODE_ENV === 'test';

  // Validate kafka configuration exists
  if (!kafkaConfig) {
    logger.error('Kafka configuration is missing from environment');
    throw new Error('Invalid configuration: Kafka config not found');
  }

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Execute startup recovery before starting consumers
  // Skip in test environment to avoid external dependencies
  if (!isTestEnvironment) {
    logger.info('Executing startup recovery...');
    try {
      const recoveryService = app.get(RecoveryService);
      await recoveryService.executeStartupRecovery();
      logger.info('Startup recovery completed successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Startup recovery failed:', {
        error: err.stack || err.message,
      });
      // Continue with startup even if recovery fails
      // The system should be able to operate without recovery
      logger.warn(
        'Continuing with application startup despite recovery failure',
      );
    }
  } else {
    logger.info('Skipping startup recovery in test environment');
  }

  // Start Kafka consumers only if not in mock mode and infrastructure is available
  // The KafkaService may have fallen back to mock mode due to infrastructure unavailability
  if (kafkaConfig.enabled && !kafkaConfig.mockMode && !isTestEnvironment) {
    try {
      // Import KafkaService dynamically to get the class
      const { KafkaService } = await import('./kafka/kafka.service');
      const kafkaService = app.get(KafkaService);

      // Check if KafkaService is actually in mock mode (may have fallen back)
      if (kafkaService.isInMockMode()) {
        logger.info(
          'KafkaService is in mock mode - skipping consumer startup',
          {
            reason: 'Infrastructure unavailable or mock mode detected',
          },
        );
      } else {
        const autopilotConsumer = app.get(AutopilotConsumer);
        await autopilotConsumer.startConsumer('autopilot-group');
        logger.info('Kafka consumers started successfully');
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to start Kafka consumers:', {
        error: err.stack || err.message,
      });

      // In production, this should be a fatal error
      if (process.env.NODE_ENV === 'production') {
        throw error;
      } else {
        logger.warn(
          'Continuing without Kafka consumers in development mode - likely in mock mode',
        );
      }
    }
  } else {
    logger.info('Kafka consumers disabled - running in mock mode', {
      enabled: kafkaConfig.enabled,
      mockMode: kafkaConfig.mockMode,
      environment: process.env.NODE_ENV,
    });
  }

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'] as const;
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      void (async () => {
        try {
          await app.close();
          logger.info('Application closed successfully');
          process.exit(0);
        } catch (error) {
          const err = error as Error;
          logger.error('Error during application shutdown', {
            error: err.stack || err.message,
            signal,
          });
          process.exit(1);
        }
      })();
    });
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.info(`Application is running on: http://localhost:${port}`, {
    environment: process.env.NODE_ENV,
    kafkaEnabled: kafkaConfig.enabled,
    mockMode: kafkaConfig.mockMode,
  });
}

bootstrap().catch((error) => {
  const err = error as Error;
  console.error('Failed to start application:', err.stack || err.message);
  process.exit(1);
});
