import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from './kafka/kafka.module';
import { AutopilotModule } from './autopilot/autopilot.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule,
    AutopilotModule,
    HealthModule,
  ],
})
export class AppModule {}
