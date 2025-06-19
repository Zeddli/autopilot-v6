import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Consumer,
  Kafka,
  Producer,
  ProducerRecord,
  Partitioners,
} from 'kafkajs';
import { SchemaUtils } from '../common/utils/schema.utils';
import {
  KafkaConnectionException,
  KafkaProducerException,
  KafkaConsumerException,
  SchemaRegistryException,
} from '../common/exceptions/kafka.exception';
import { LoggerService } from '../common/services/logger.service';
import { CircuitBreaker } from '../common/utils/circuit-breaker';
import { v4 as uuidv4 } from 'uuid';
import { KAFKA_SCHEMAS } from '../common/schemas/kafka.schemas';
import { CONFIG } from '../common/constants/config.constants';
import { ISchemaCacheEntry, IKafkaConfig } from '../common/types/kafka.types';

@Injectable()
export class KafkaService implements OnApplicationShutdown, OnModuleInit {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers: Map<string, Consumer>;
  private schemaUtils: SchemaUtils;
  private readonly logger: LoggerService;
  private readonly circuitBreaker: CircuitBreaker;
  private schemaIds: Map<string, number>;
  private readonly schemaCache: Map<string, ISchemaCacheEntry>;

  /**
   * Flag to track if mock mode was dynamically enabled due to infrastructure unavailability
   * This allows the service to fall back to mock mode when Kafka is not available
   */
  private mockModeEnabled = false;

  constructor(private readonly configService: ConfigService) {
    this.logger = new LoggerService(KafkaService.name);
    this.schemaCache = new Map();

    // Determine mock mode immediately in constructor based on environment
    const kafkaConfig = this.configService.get('kafka') as {
      enabled?: boolean;
      mockMode?: boolean;
    };
    
    const shouldUseMockMode = !kafkaConfig?.enabled || 
                              kafkaConfig?.mockMode || 
                              process.env.NODE_ENV === 'test' ||
                              process.env.KAFKA_MOCK_MODE === 'true';
    
    if (shouldUseMockMode) {
      this.mockModeEnabled = true;
      this.logger.info('KafkaService initialized in mock mode', {
        reason: 'Configuration disabled, test environment, or mock mode explicitly enabled',
        enabled: kafkaConfig?.enabled,
        mockMode: kafkaConfig?.mockMode,
        environment: process.env.NODE_ENV,
      });
    }

    try {
      const brokers = this.configService.get<string | undefined>(
        'kafka.brokers',
      );
      const kafkaBrokers = Array.isArray(brokers)
        ? brokers
        : brokers?.split(',') || CONFIG.KAFKA.DEFAULT_BROKERS;

      const kafkaConfig: IKafkaConfig = {
        clientId:
          this.configService.get('kafka.clientId') ||
          CONFIG.KAFKA.DEFAULT_CLIENT_ID,
        brokers: kafkaBrokers,
        retry: {
          initialRetryTime:
            this.configService.get('kafka.retry.initialRetryTime') ||
            CONFIG.KAFKA.DEFAULT_INITIAL_RETRY_TIME,
          retries:
            this.configService.get('kafka.retry.retries') ||
            CONFIG.KAFKA.DEFAULT_RETRIES,
          maxRetryTime:
            this.configService.get('kafka.retry.maxRetryTime') ||
            CONFIG.KAFKA.DEFAULT_MAX_RETRY_TIME,
        },
      };

      this.kafka = new Kafka(kafkaConfig);

      this.producer = this.kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
        idempotent: true,
        maxInFlightRequests: CONFIG.KAFKA.DEFAULT_MAX_IN_FLIGHT_REQUESTS,
        transactionTimeout: CONFIG.KAFKA.DEFAULT_TRANSACTION_TIMEOUT,
        allowAutoTopicCreation: true,
      });

      this.consumers = new Map();
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: CONFIG.CIRCUIT_BREAKER.DEFAULT_FAILURE_THRESHOLD,
        resetTimeout: CONFIG.CIRCUIT_BREAKER.DEFAULT_RESET_TIMEOUT,
      });

      // Defer SchemaUtils initialization until onModuleInit
      // to avoid constructor failures in development environments
      this.schemaIds = new Map();
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to initialize Kafka service', {
        error: err.stack || err.message,
      });
      throw new KafkaConnectionException({
        error: err.stack || err.message,
      });
    }
  }

  /**
   * Module initialization lifecycle hook
   *
   * Initializes Kafka connections and schemas on module startup.
   * In test environments or when Kafka is disabled, skips real connections
   * and operates in mock mode for testing purposes.
   *
   * Enhanced with connection detection:
   * - Attempts to detect if Kafka infrastructure is available
   * - Falls back gracefully to mock mode if infrastructure is unavailable
   * - Provides clear logging about the connection mode being used
   *
   * @throws {KafkaConnectionException} When connection fails in production mode
   */
  async onModuleInit(): Promise<void> {
    const kafkaConfig = this.configService.get('kafka') as {
      enabled?: boolean;
      mockMode?: boolean;
      schemaRegistry?: { enabled?: boolean };
    };

    // Initialize SchemaUtils here instead of in constructor
    try {
      const schemaRegistryUrl = this.configService.get<string | undefined>(
        'kafka.schemaRegistry.url',
      );
      if (!schemaRegistryUrl) {
        this.logger.warn('Schema registry URL is not configured, some features may be limited');
        // Don't throw error in development mode
        if (process.env.NODE_ENV === 'production') {
          throw new SchemaRegistryException(
            'Schema registry URL is not configured',
          );
        }
      } else {
        this.schemaUtils = new SchemaUtils(schemaRegistryUrl);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.warn('Failed to initialize SchemaUtils', {
        error: err.message,
      });
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }

    // Enhanced logging for debugging
    this.logger.info('KafkaService onModuleInit - Configuration check', {
      enabled: kafkaConfig?.enabled,
      mockMode: kafkaConfig?.mockMode,
      environment: process.env.NODE_ENV || 'undefined',
      isProduction: process.env.NODE_ENV === 'production',
    });

    // Skip Kafka initialization if mock mode is already enabled
    if (this.isInMockMode()) {
      this.logger.info(
        'Kafka service running in mock mode - connections skipped',
        {
          enabled: kafkaConfig?.enabled,
          mockMode: kafkaConfig?.mockMode,
          environment: process.env.NODE_ENV,
          reason: 'Mock mode already enabled in constructor',
        },
      );
      return;
    }

    // In production, we require real Kafka connections
    if (process.env.NODE_ENV === 'production') {
      try {
        await this.initializeSchemas();
        await this.producer.connect();
        this.logger.info(
          'Kafka service initialized successfully in production mode',
        );
        return;
      } catch (error) {
        const err = error as Error;
        this.logger.error('Failed to initialize Kafka service in production', {
          error: err.stack || err.message,
        });
        throw new KafkaConnectionException({
          error: err.stack || err.message,
        });
      }
    }

    // For development/other environments: Attempt connection with fallback to mock mode
    this.logger.info('Attempting to connect to Kafka infrastructure...');
    
    // Use a very short timeout for immediate feedback
    const connectionTimeout = 500; // 500ms
    let connectionSuccessful = false;
    
    try {
      // Test connection with aggressive timeout
      await Promise.race([
        this.testKafkaConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), connectionTimeout)
        ),
      ]);
      
      connectionSuccessful = true;
      this.logger.info('Kafka broker connectivity test successful');
      
    } catch (error) {
      const err = error as Error;
      this.logger.warn('Kafka broker connectivity test failed', {
        error: err.message,
        timeout: connectionTimeout,
      });
      connectionSuccessful = false;
    }

    if (connectionSuccessful) {
      try {
        // If connection test passed, try full initialization
        await this.initializeSchemas();
        await this.producer.connect();
        this.logger.info(
          'Kafka service initialized successfully with real connections',
          {
            brokers: this.configService.get('kafka.brokers'),
            schemaRegistry: this.configService.get('kafka.schemaRegistry.url'),
          },
        );
      } catch (error) {
        const err = error as Error;
        this.logger.warn('Full Kafka initialization failed, falling back to mock mode', {
          error: err.message,
        });
        this.enableMockMode();
      }
    } else {
      // Connection test failed, immediately enable mock mode
      this.logger.warn(
        'Kafka infrastructure not available, falling back to mock mode',
        {
          brokers: this.configService.get('kafka.brokers'),
          schemaRegistry: this.configService.get('kafka.schemaRegistry.url'),
          suggestion: 'Start Kafka infrastructure with: docker-compose up -d',
        },
      );

      this.enableMockMode();

      this.logger.info(
        'Kafka service running in mock mode due to infrastructure unavailability',
        {
          environment: process.env.NODE_ENV,
          reason: 'Infrastructure not available',
          mockMode: true,
        },
      );
    }
  }

  /**
   * Test Kafka connection availability using TCP socket
   *
   * Performs a lightweight TCP socket test to determine if Kafka
   * infrastructure is available before attempting full initialization.
   * This avoids creating Kafka clients that generate retry logs.
   *
   * @throws {Error} When Kafka infrastructure is not available
   */
  private async testKafkaConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const brokers = this.configService.get<string>('kafka.brokers') || 'localhost:9092';
      const brokerList = brokers.split(',');
      const [host, portStr] = brokerList[0].split(':');
      const port = parseInt(portStr, 10);
      
      const socket = new net.Socket();
      const timeout = 1000; // 1 second timeout
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        this.logger.debug('Kafka broker connectivity test successful');
        resolve();
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        this.logger.debug('Kafka broker connectivity test timed out');
        reject(new Error('Kafka broker connection timeout'));
      });
      
      socket.on('error', (error) => {
        socket.destroy();
        this.logger.debug('Kafka broker connectivity test failed', {
          error: error.message,
        });
        reject(new Error(`Kafka broker not available: ${error.message}`));
      });
      
      socket.connect(port, host);
    });
  }

  /**
   * Enable mock mode for this service instance
   *
   * Dynamically enables mock mode when real Kafka infrastructure
   * is not available, allowing the application to continue running
   * in development environments without requiring Kafka setup.
   */
  private enableMockMode(): void {
    // Set a flag to indicate mock mode is enabled for this instance
    this.mockModeEnabled = true;

    this.logger.info('Mock mode enabled - Kafka operations will be simulated', {
      timestamp: new Date().toISOString(),
      service: 'KafkaService',
    });
  }

  /**
   * Check if service is currently running in mock mode (public method)
   *
   * @returns {boolean} True if mock mode is enabled
   */
  public isInMockMode(): boolean {
    try {
      const kafkaConfig = this.configService.get('kafka') as {
        enabled?: boolean;
        mockMode?: boolean;
      };

      // Log debug info for troubleshooting
      this.logger.debug('Checking mock mode status', {
        kafkaConfigExists: !!kafkaConfig,
        enabled: kafkaConfig?.enabled,
        mockMode: kafkaConfig?.mockMode,
        mockModeEnabled: this.mockModeEnabled,
        nodeEnv: process.env.NODE_ENV,
      });

      return (
        !kafkaConfig?.enabled ||
        kafkaConfig?.mockMode ||
        this.mockModeEnabled ||
        process.env.NODE_ENV === 'test'
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error checking mock mode status', {
        error: err.message,
        stack: err.stack,
      });
      // Default to mock mode if there's an error
      return true;
    }
  }

  /**
   * Initialize Kafka schemas for all configured topics
   *
   * Registers schemas with Schema Registry and caches schema IDs
   * for efficient message encoding/decoding operations.
   * Skips initialization in test/mock mode.
   *
   * @throws {SchemaRegistryException} When schema registration fails
   */
  private async initializeSchemas(): Promise<void> {
    const kafkaConfig = this.configService.get('kafka') as {
      schemaRegistry?: { enabled?: boolean };
    };

    // Skip schema initialization if Schema Registry is disabled
    if (!kafkaConfig?.schemaRegistry?.enabled) {
      this.logger.info(
        'Schema Registry disabled - skipping schema initialization',
      );
      return;
    }

    try {
      this.logger.info('Initializing Kafka schemas...');

      // Register all schemas defined in KAFKA_SCHEMAS
      for (const [topic, schema] of Object.entries(KAFKA_SCHEMAS)) {
        try {
          const { id } = await this.schemaUtils.registerSchema(topic, schema);
          this.schemaIds.set(topic, id);
          this.logger.info(`Schema initialized for topic ${topic}`, {
            schemaId: id,
          });
        } catch (error) {
          // If schema already exists, get its ID
          if (
            error instanceof Error &&
            error.message.includes('already exists')
          ) {
            const { id } = await this.schemaUtils.getLatestSchemaId(
              `${topic}-value`,
            );
            this.schemaIds.set(topic, id);
            this.logger.info(`Schema already exists for topic ${topic}`, {
              schemaId: id,
            });
          } else {
            throw error;
          }
        }
      }

      this.logger.info('All Kafka schemas initialized successfully');
    } catch (error) {
      const kafkaError = error as Error;
      this.logger.error('Schema initialization failed:', {
        error: kafkaError.message,
        stack: kafkaError.stack,
      });

      if (
        this.configService.get<boolean>('kafka.schemaRegistry.required') ||
        process.env.NODE_ENV === 'production'
      ) {
        throw kafkaError;
      } else {
        this.logger.warn(
          'Continuing without schema registry (not required for this environment)',
        );
      }
    }
  }

  private async refreshSchemaId(topic: string): Promise<number> {
    try {
      const subject = `${topic}-value`;
      this.logger.info(`Refreshing schema for ${topic}`);

      const { id } = await this.schemaUtils.getLatestSchemaId(subject);
      this.schemaIds.set(topic, id);
      this.logger.info(`Schema refreshed for ${topic}`, { schemaId: id });
      return id;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to refresh schema for ${topic}`, {
        error: err.stack || err.message,
      });
      throw new SchemaRegistryException(
        `Failed to refresh schema for ${topic}: ${err.message}`,
      );
    }
  }

  async sendMessage(topic: string, message: unknown): Promise<void> {
    try {
      const schemaId = this.schemaIds.get(topic);
      if (!schemaId) {
        throw new Error(`No schema ID found for topic ${topic}`);
      }

      const encodedMessage = await this.schemaUtils.encode(message, schemaId);
      await this.producer.send({
        topic,
        messages: [{ value: encodedMessage }],
      });
      this.logger.log(`Message sent to topic ${topic}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send message to topic ${topic}: ${err.message}`,
      );
      throw new KafkaProducerException(
        `Failed to send message to topic ${topic}: ${err.message}`,
      );
    }
  }

  /**
   * Produce a message to the specified Kafka topic
   *
   * In production mode, encodes and sends messages to the actual Kafka broker.
   * In test/mock mode, logs the message instead of sending to allow testing
   * without requiring real Kafka infrastructure.
   *
   * Enhanced with dynamic mock mode detection to handle cases where
   * infrastructure becomes unavailable after service initialization.
   *
   * @param topic - The Kafka topic to send the message to
   * @param message - The message payload to send
   * @throws {KafkaProducerException} When message production fails
   */
  async produce(topic: string, message: unknown): Promise<void> {
    const correlationId = uuidv4();

    // Handle mock mode for testing and when infrastructure is unavailable
    if (this.isInMockMode()) {
      this.logger.info(
        `[KAFKA-PRODUCER-MOCK] Message would be sent to ${topic}`,
        {
          correlationId,
          topic,
          messageType: typeof message,
          timestamp: new Date().toISOString(),
          mockMode: true,
          reason: 'Infrastructure unavailable or mock mode enabled',
        },
      );
      return;
    }

    try {
      await this.circuitBreaker.execute(async () => {
        // Attempt to ensure producer is connected
        try {
          await this.producer.send({
            topic: '__kafka_health_check',
            messages: [{ value: Buffer.from('health_check') }],
          });
        } catch (error) {
          const err = error as Error;
          this.logger.warn(
            'Producer disconnected, attempting to reconnect...',
            { correlationId, error: err.stack || err.message },
          );
          await this.producer.connect();
        }

        let schemaId = this.schemaIds.get(topic);
        if (!schemaId) {
          this.logger.warn(
            `Schema ID not found for topic ${topic}, refreshing...`,
          );
          try {
            schemaId = await this.refreshSchemaId(topic);
          } catch (error) {
            const err = error as Error;
            this.logger.error(
              `Failed to refresh schema ID for topic ${topic}`,
              { error: err.stack || err.message },
            );
            throw new SchemaRegistryException(
              `Failed to get schema ID for topic ${topic}: ${err.message}`,
            );
          }
        }

        const encodedValue = await this.schemaUtils.encode(message, schemaId);
        const record: ProducerRecord = {
          topic,
          messages: [
            {
              value: encodedValue,
              headers: {
                'correlation-id': correlationId,
                timestamp: Date.now().toString(),
              },
            },
          ],
          acks: -1,
          timeout: 30000,
        };

        await this.producer.send(record);

        this.logger.info(`[KAFKA-PRODUCER] Message produced to ${topic}`, {
          correlationId,
          topic,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to produce message to ${topic}`, {
        correlationId,
        error: err.stack || err.message,
      });
      throw new KafkaProducerException(
        `Failed to produce message to ${topic}: ${err.message}`,
      );
    }
  }

  /**
   * Produce a batch of messages to the specified Kafka topic
   *
   * In production mode, encodes and sends multiple messages to the actual Kafka broker.
   * In test/mock mode, logs the batch instead of sending to allow testing
   * without requiring real Kafka infrastructure.
   *
   * @param topic - The Kafka topic to send the messages to
   * @param messages - Array of message payloads to send
   * @throws {KafkaProducerException} When batch production fails
   */
  async produceBatch(topic: string, messages: unknown[]): Promise<void> {
    const correlationId = uuidv4();
    const startTime = Date.now();

    // Handle mock mode for testing and when infrastructure is unavailable
    if (this.isInMockMode()) {
      this.logger.info(
        `[KAFKA-PRODUCER-MOCK] Batch would be sent to ${topic}`,
        {
          correlationId,
          topic,
          messageCount: messages.length,
          timestamp: new Date().toISOString(),
          mockMode: true,
          reason: 'Infrastructure unavailable or mock mode enabled',
        },
      );
      return;
    }

    try {
      await this.circuitBreaker.execute(async () => {
        let schemaId = this.schemaIds.get(topic);
        if (!schemaId) {
          this.logger.warn(
            `Schema ID not found for topic ${topic}, refreshing...`,
          );
          try {
            schemaId = await this.refreshSchemaId(topic);
          } catch (error) {
            const err = error as Error;
            this.logger.error(
              `Failed to refresh schema ID for topic ${topic}`,
              { error: err.stack || err.message },
            );
            throw new SchemaRegistryException(
              `Failed to get schema ID for topic ${topic}: ${err.message}`,
            );
          }
        }

        this.logger.info(`Producing batch to ${topic}`, {
          correlationId,
          count: messages.length,
        });

        const encodedMessages = await Promise.all(
          messages.map(async (message) => ({
            value: await this.schemaUtils.encode(message, schemaId),
            headers: {
              'correlation-id': correlationId,
              timestamp: Date.now().toString(),
            },
          })),
        );

        const record: ProducerRecord = {
          topic,
          messages: encodedMessages,
          acks: -1,
          timeout: 30000,
        };

        await this.producer.send(record);
        this.logger.info(`Batch produced to ${topic}`, {
          correlationId,
          count: messages.length,
          latency: Date.now() - startTime,
        });
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to produce batch to ${topic}`, {
        correlationId,
        error: err.stack || err.message,
        count: messages.length,
      });
      throw new KafkaProducerException(
        `Failed to produce batch to ${topic}: ${err.message}`,
      );
    }
  }

  /**
   * Start consuming messages from specified topics
   *
   * Creates and starts a Kafka consumer for the given consumer group.
   * In test/mock mode, skips actual consumption and logs instead.
   *
   * Enhanced with dynamic mock mode detection to handle cases where
   * infrastructure becomes unavailable after service initialization.
   *
   * @param groupId - The consumer group ID
   * @param topics - Array of topics to consume from
   * @param onMessage - Callback function to handle received messages
   * @throws {KafkaConsumerException} When consumer fails to start
   */
  async consume(
    groupId: string,
    topics: string[],
    onMessage: (message: unknown) => Promise<void>,
  ): Promise<void> {
    const correlationId = uuidv4();

    // Handle mock mode for testing and when infrastructure is unavailable
    if (this.isInMockMode()) {
      this.logger.info(
        `[KAFKA-CONSUMER-MOCK] Consumer would start for group ${groupId}`,
        {
          correlationId,
          groupId,
          topics,
          mockMode: true,
          reason: 'Infrastructure unavailable or mock mode enabled',
        },
      );
      return;
    }

    try {
      // Check if consumer already exists for this group
      if (this.consumers.has(groupId)) {
        this.logger.warn(`Consumer already exists for group ${groupId}`);
        return;
      }

      const consumer = this.kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      // Handle consumer events
      consumer.on('consumer.crash', (event) => {
        this.logger.error(`Consumer crashed for group ${groupId}`, {
          errorMessage:
            event.payload?.error?.stack ||
            event.payload?.error?.message ||
            'Unknown consumer error',
          correlationId,
        });
      });

      consumer.on('consumer.disconnect', () => {
        this.logger.warn(`Consumer disconnected for group ${groupId}`, {
          correlationId,
        });
      });

      await consumer.connect();
      await consumer.subscribe({ topics, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            // Ensure message.value is properly typed and not null
            const messageValue = message.value;
            if (!messageValue) {
              throw new Error('Message value is null or undefined');
            }

            const decodedMessage = (await this.schemaUtils.decode(
              messageValue,
            )) as unknown;

            this.logger.info(
              `[KAFKA-CONSUMER] Message received from ${topic}`,
              {
                correlationId,
                topic,
                partition,
                offset: message.offset,
                timestamp: new Date().toISOString(),
              },
            );

            await onMessage(decodedMessage);
          } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to process message from ${topic}`, {
              correlationId,
              topic,
              partition,
              offset: message.offset,
              error: err.stack || err.message,
            });

            // Send to DLQ if available
            if (message.value) {
              await this.sendToDLQ(topic, message.value);
            }
          }
        },
      });

      this.consumers.set(groupId, consumer);
      this.logger.info(`Consumer started for group ${groupId}`, {
        correlationId,
        topics,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to start consumer for group ${groupId}`, {
        error: err.stack || err.message,
        correlationId,
        topics,
      });
      throw new KafkaConsumerException(
        `Failed to start consumer for group ${groupId}`,
      );
    }
  }

  private async sendToDLQ(
    originalTopic: string,
    message: Buffer,
  ): Promise<void> {
    const dlqTopic = `${originalTopic}.dlq`;
    try {
      await this.produce(dlqTopic, {
        originalTopic,
        originalMessage: message.toString('base64'),
        error: 'Failed to process message',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to send message to DLQ', {
        error: err.stack,
        topic: dlqTopic,
      });
    }
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.info('Starting Kafka graceful shutdown', { signal });
    const shutdownTimeout = 30000; // 30 seconds timeout
    const startTime = Date.now();

    try {
      // Stop accepting new messages
      this.logger.info('Stopping producer...');
      await Promise.race([
        this.producer.disconnect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Producer disconnect timeout')),
            shutdownTimeout,
          ),
        ),
      ]);
      this.logger.info('Producer disconnected successfully');

      // Stop all consumers
      this.logger.info('Stopping consumers...');
      const consumerDisconnectPromises = Array.from(
        this.consumers.entries(),
      ).map(async ([groupId, consumer]) => {
        try {
          await Promise.race([
            consumer.disconnect(),
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(new Error(`Consumer ${groupId} disconnect timeout`)),
                shutdownTimeout,
              ),
            ),
          ]);
          this.logger.info(`Consumer ${groupId} disconnected successfully`);
        } catch (error) {
          const err = error as Error;
          this.logger.error(`Error disconnecting consumer ${groupId}`, {
            error: err.stack,
            groupId,
          });
        }
      });

      await Promise.all(consumerDisconnectPromises);

      const shutdownDuration = Date.now() - startTime;
      this.logger.info('Kafka connections closed successfully', {
        duration: shutdownDuration,
        consumersClosed: this.consumers.size,
      });
    } catch (error) {
      const err = error as Error;
      const shutdownDuration = Date.now() - startTime;
      this.logger.error('Error during Kafka shutdown', {
        error: err.stack,
        duration: shutdownDuration,
        signal,
      });
      throw err;
    } finally {
      // Clear all consumers from the map
      this.consumers.clear();
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const mockMode = this.isInMockMode();
      
      this.logger.info('Checking Kafka connectivity', {
        mockMode,
        timestamp: new Date().toISOString(),
      });
      
      // In mock mode, always return true to indicate service is operational
      if (mockMode) {
        this.logger.info('Kafka service is in mock mode - returning true', {
          timestamp: new Date().toISOString(),
        });
        return true;
      }

      // Ensure kafka client exists before attempting connection
      if (!this.kafka) {
        this.logger.warn('Kafka client not initialized', {
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      this.logger.info('Attempting real Kafka connection test', {
        timestamp: new Date().toISOString(),
      });
      
      // Use lightweight admin client to check connectivity instead of producing messages
      const admin = this.kafka.admin();
      await admin.connect();
      
      // Simple connectivity test - if we can connect and disconnect, Kafka is available
      await admin.disconnect();
      
      this.logger.info('Kafka connectivity test successful', {
        timestamp: new Date().toISOString(),
      });
      
      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.warn('Kafka connectivity check failed', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }
}
