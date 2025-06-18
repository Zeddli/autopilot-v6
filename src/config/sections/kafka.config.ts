import { registerAs } from '@nestjs/config';

/**
 * Kafka Configuration Factory
 *
 * Provides configuration for Kafka brokers, Schema Registry, and connection settings.
 * Supports different environments including test mode with disabled connections.
 *
 * Environment Variables:
 * - KAFKA_BROKERS: Comma-separated list of Kafka broker addresses
 * - KAFKA_CLIENT_ID: Client identifier for Kafka connections
 * - SCHEMA_REGISTRY_URL: URL for Schema Registry service
 * - KAFKA_ENABLED: Enable/disable Kafka connections (useful for testing)
 * - NODE_ENV: Application environment (test mode disables real connections)
 */
export default registerAs('kafka', () => {
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  const kafkaEnabled = process.env.KAFKA_ENABLED !== 'false';

  return {
    brokers: process.env.KAFKA_BROKERS || 'localhost:29092',
    clientId: process.env.KAFKA_CLIENT_ID || 'autopilot-service',
    enabled: kafkaEnabled && !isTestEnvironment, // Disable in test environment
    mockMode: process.env.KAFKA_MOCK_MODE === 'true' || isTestEnvironment,
    schemaRegistry: {
      url: process.env.SCHEMA_REGISTRY_URL || 'http://localhost:8081',
      enabled: kafkaEnabled && !isTestEnvironment,
      auth: {
        username: process.env.SCHEMA_REGISTRY_USER,
        password: process.env.SCHEMA_REGISTRY_PASSWORD,
      },
    },
    retry: {
      maxRetryTime: parseInt(process.env.KAFKA_MAX_RETRY_TIME ?? '30000', 10),
      initialRetryTime: parseInt(
        process.env.KAFKA_INITIAL_RETRY_TIME ?? '300',
        10,
      ),
      retries: parseInt(process.env.KAFKA_RETRIES ?? '5', 10),
    },
    // Test-specific configurations
    test: {
      skipConnection: isTestEnvironment,
      mockProducers: isTestEnvironment,
      mockConsumers: isTestEnvironment,
    },
  };
});
