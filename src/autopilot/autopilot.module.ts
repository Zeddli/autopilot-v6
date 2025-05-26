import { Module, forwardRef } from '@nestjs/common';
import { AutopilotService } from './services/autopilot.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [forwardRef(() => KafkaModule)],
  providers: [AutopilotService],
  exports: [AutopilotService],
})
export class AutopilotModule {}
