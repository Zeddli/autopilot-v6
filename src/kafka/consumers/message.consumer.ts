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

  /**
   * Initialize message consumer
   *
   * Attempts to start message consumer with proper error handling for
   * infrastructure unavailability. Uses retry logic to handle race
   * conditions during service startup.
   */
  async onModuleInit(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(
          `Attempting to initialize message consumer (attempt ${attempt}/${maxRetries})`,
        );

        // Add a small delay on first attempt to allow KafkaService to complete its infrastructure detection
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 800)); // 800ms delay
        }

        // Check if KafkaService is in mock mode
        if (this.kafkaService.isInMockMode()) {
          this.logger.info(
            'KafkaService is in mock mode - message consumer will not start',
            {
              reason: 'Infrastructure unavailable or mock mode enabled',
            },
          );
          return;
        }

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

        // If we reach here, consumer started successfully
        this.logger.info('Message consumer initialized successfully');
        return;
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.warn(
          `Message consumer initialization attempt ${attempt} failed`,
          {
            error: err.message,
            attempt,
            maxRetries,
          },
        );

        // If this is the last attempt or we're in production, handle accordingly
        if (attempt === maxRetries) {
          this.logger.error(
            'Failed to initialize message consumer after all retry attempts',
            {
              error: err.message,
              attempts: maxRetries,
            },
          );

          // In development mode, don't fail the entire application startup
          if (process.env.NODE_ENV !== 'production') {
            this.logger.warn(
              'Continuing without message consumer in development mode',
              {
                reason: 'Infrastructure likely unavailable',
              },
            );
            return;
          }

          // In production, this should fail
          throw new Error(
            `Failed to initialize message consumer: ${err.message}`,
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
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
