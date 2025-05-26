import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { AutopilotService } from '../../autopilot/services/autopilot.service';
import { KAFKA_TOPICS, KafkaTopic } from '../constants/topics';
import { KafkaMessage } from '../interfaces/kafka-message.interface';
import { TopicPayloadMap } from '../types/topic-payload-map.type';

@Injectable()
export class AutopilotConsumer {
  private readonly logger = new Logger(AutopilotConsumer.name);

  private readonly topicHandlers: {
    [K in keyof TopicPayloadMap]: (
      message: TopicPayloadMap[K],
    ) => Promise<void>;
  };

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly autopilotService: AutopilotService,
  ) {
    this.topicHandlers = {
      [KAFKA_TOPICS.PHASE_TRANSITION]:
        this.autopilotService.handlePhaseTransition.bind(
          this.autopilotService,
        ) as (
          message: TopicPayloadMap[typeof KAFKA_TOPICS.PHASE_TRANSITION],
        ) => Promise<void>,

      [KAFKA_TOPICS.CHALLENGE_UPDATE]:
        this.autopilotService.handleChallengeUpdate.bind(
          this.autopilotService,
        ) as (
          message: TopicPayloadMap[typeof KAFKA_TOPICS.CHALLENGE_UPDATE],
        ) => Promise<void>,

      [KAFKA_TOPICS.COMMAND]: this.autopilotService.handleCommand.bind(
        this.autopilotService,
      ) as (
        message: TopicPayloadMap[typeof KAFKA_TOPICS.COMMAND],
      ) => Promise<void>,
    };
  }

  async startConsumer(groupId: string): Promise<void> {
    const topics = Object.values(KAFKA_TOPICS);

    await this.kafkaService.consume(
      groupId,
      topics,
      async (message: KafkaMessage<KafkaTopic>) => {
        try {
          switch (message.topic) {
            case KAFKA_TOPICS.PHASE_TRANSITION:
              await this.topicHandlers[KAFKA_TOPICS.PHASE_TRANSITION](
                message.payload as TopicPayloadMap[typeof KAFKA_TOPICS.PHASE_TRANSITION],
              );
              break;
            case KAFKA_TOPICS.CHALLENGE_UPDATE:
              await this.topicHandlers[KAFKA_TOPICS.CHALLENGE_UPDATE](
                message.payload as TopicPayloadMap[typeof KAFKA_TOPICS.CHALLENGE_UPDATE],
              );
              break;
            case KAFKA_TOPICS.COMMAND:
              await this.topicHandlers[KAFKA_TOPICS.COMMAND](
                message.payload as TopicPayloadMap[typeof KAFKA_TOPICS.COMMAND],
              );
              break;
          }
        } catch (error: unknown) {
          const err = error as Error;
          this.logger.error(
            `Error processing message for topic ${message.topic}`,
            {
              error: err.stack,
              message,
            },
          );
        }
      },
    );
  }
}
