import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthCheckError } from '@nestjs/terminus';
import { KafkaService } from '../kafka/kafka.service';
import { LoggerService } from '../common/services/logger.service';

@Injectable()
export class KafkaHealthIndicator extends HealthIndicator {
  private readonly logger = new LoggerService(KafkaHealthIndicator.name);

  constructor(private readonly kafkaService: KafkaService) {
    super();
  }

  async isHealthy(key: string) {
    try {
      const isConnected = await this.kafkaService.isConnected();

      if (!isConnected) {
        throw new HealthCheckError(
          'KafkaHealthCheck failed',
          this.getStatus(key, false, { error: 'Kafka is not connected' }),
        );
      }

      return this.getStatus(key, true, {
        status: 'up',
        timestamp: new Date().toISOString(),
        details: {
          producer: 'connected',
          consumers: 'active',
        },
      });
    } catch (error: unknown) {
      const err = error as Error;

      this.logger.error('Kafka health check failed', {
        error: err.stack,
        timestamp: new Date().toISOString(),
      });

      throw new HealthCheckError(
        'KafkaHealthCheck failed',
        this.getStatus(key, false, {
          error: err.message,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
}
