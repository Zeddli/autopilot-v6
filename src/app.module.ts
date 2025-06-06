import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { KafkaModule } from './kafka/kafka.module';
import { AutopilotModule } from './autopilot/autopilot.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, KafkaModule, AutopilotModule, HealthModule],
})
export class AppModule {}
