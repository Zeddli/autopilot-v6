import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaService } from './kafka.service';
import { KafkaController } from './controllers/kafka.controller';
import { MessageConsumer } from './consumers/message.consumer';
import { AutopilotProducer } from './producers/autopilot.producer';
import { AutopilotConsumer } from './consumers/autopilot.consumer';
import configuration from '../config/configuration';
import { validationSchema } from '../config/validation';
import { AutopilotModule } from '../autopilot/autopilot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validationSchema,
    }),
    forwardRef(() => AutopilotModule),
  ],
  controllers: [KafkaController],
  providers: [
    KafkaService,
    AutopilotProducer,
    AutopilotConsumer,
    MessageConsumer,
  ],
  exports: [KafkaService, AutopilotProducer],
})
export class KafkaModule {}
