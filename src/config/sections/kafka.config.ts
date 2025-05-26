import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  brokers: process.env.KAFKA_BROKERS || 'localhost:29092',
  clientId: process.env.KAFKA_CLIENT_ID || 'autopilot-service',
  schemaRegistry: {
    url: process.env.SCHEMA_REGISTRY_URL || 'http://localhost:8081',
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
}));
