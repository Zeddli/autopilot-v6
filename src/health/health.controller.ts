import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { KafkaHealthIndicator } from './kafka.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private kafkaHealth: KafkaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.kafkaHealth.isHealthy('kafka')]);
  }

  @Get('kafka')
  @HealthCheck()
  checkKafka() {
    return this.health.check([() => this.kafkaHealth.isHealthy('kafka')]);
  }

  @Get('app')
  @HealthCheck()
  checkApp() {
    return this.health.check([]);
  }
}
