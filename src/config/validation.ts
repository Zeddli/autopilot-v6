import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // App Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_DIR: Joi.string().default('logs'),

  // Kafka Configuration
  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('autopilot-service'),
  KAFKA_MAX_RETRY_TIME: Joi.number().default(30000),
  KAFKA_INITIAL_RETRY_TIME: Joi.number().default(300),
  KAFKA_RETRIES: Joi.number().default(5),

  // Schema Registry Configuration
  SCHEMA_REGISTRY_URL: Joi.string().required(),
  SCHEMA_REGISTRY_USER: Joi.string().optional(),
  SCHEMA_REGISTRY_PASSWORD: Joi.string().optional(),
});
