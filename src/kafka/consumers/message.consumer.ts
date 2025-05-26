import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { LoggerService } from '../../common/services/logger.service';

interface KafkaPayload {
  type?: string;
  [key: string]: unknown;
}

interface KafkaMessage {
  topic: string;
  timestamp: string;
  payload: KafkaPayload;
}

@Injectable()
export class MessageConsumer implements OnModuleInit {
  private readonly logger = new LoggerService(MessageConsumer.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaService.consume(
        'message-consumer-group',
        ['autopilot.message'],
        async (message: unknown) => {
          const typedMessage = this.validateKafkaMessage(message);
          this.logger.info('Message received', {
            topic: typedMessage.topic,
            timestamp: typedMessage.timestamp,
            payload: typedMessage.payload,
          });

          await this.processMessage(typedMessage);
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error('Failed to initialize message consumer', {
        error: err.message,
      });
      throw err;
    }
  }

  private processMessage(message: KafkaMessage): Promise<void> {
    try {
      this.logger.info('Processing message', {
        topic: message.topic,
        payload: message.payload,
      });

      switch (message.payload?.type) {
        case 'notification':
          this.handleNotification(message.payload);
          break;
        case 'event':
          this.handleEvent(message.payload);
          break;
        default:
          this.logger.warn('Unknown message type', {
            type: message.payload?.type,
          });
      }
      return Promise.resolve();
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error('Error processing message', {
        error: err.message,
        topic: message.topic,
        payload: message.payload,
      });
      return Promise.reject(err);
    }
  }

  private handleNotification(payload: KafkaPayload): void {
    this.logger.info('Handling notification', { payload });
    // Notification logic goes here
  }

  private handleEvent(payload: KafkaPayload): void {
    this.logger.info('Handling event', { payload });
    // Event logic goes here
  }

  private validateKafkaMessage(message: unknown): KafkaMessage {
    if (
      typeof message === 'object' &&
      message !== null &&
      'topic' in message &&
      'timestamp' in message &&
      'payload' in message
    ) {
      return message as KafkaMessage;
    }
    throw new Error('Invalid Kafka message format');
  }
}
