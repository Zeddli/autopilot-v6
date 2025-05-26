import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AutopilotConsumer } from './kafka/consumers/autopilot.consumer';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggerService } from './common/services/logger.service';

async function bootstrap() {
  const logger = new LoggerService('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new LoggerService('Bootstrap'),
  });

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

  const autopilotConsumer = app.get(AutopilotConsumer);
  await autopilotConsumer.startConsumer('autopilot-group');

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
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
  logger.info(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch((error) => {
  const err = error as Error;
  console.error('Failed to start application:', err.stack || err.message);
  process.exit(1);
});
