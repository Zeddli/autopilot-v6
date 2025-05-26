import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { Injectable } from '@nestjs/common';
import { SchemaRegistryException } from '../exceptions/kafka.exception';
import { LoggerService } from '../services/logger.service';
import { KAFKA_SCHEMAS } from '../schemas/kafka.schemas';
import { Schema } from '@kafkajs/confluent-schema-registry/dist/@types';

@Injectable()
export class SchemaUtils {
  private readonly registry: SchemaRegistry;
  private readonly logger: LoggerService;

  constructor(private readonly schemaRegistryUrl: string) {
    this.registry = new SchemaRegistry({ host: this.schemaRegistryUrl });
    this.logger = new LoggerService(SchemaUtils.name);
  }

  async encode(message: any, schemaId: number): Promise<Buffer> {
    try {
      return await this.registry.encode(schemaId, message);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to encode message with schema ID ${schemaId}`, {
        error: err.stack,
      });
      throw new SchemaRegistryException(
        `Failed to encode message with schema ID ${schemaId}`,
        {
          error: err.stack || err.message,
        },
      );
    }
  }

  async decode(message: Buffer): Promise<any> {
    try {
      return await this.registry.decode(message);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to decode message', { error: err.stack });
      throw new SchemaRegistryException('Failed to decode message', {
        error: err.stack || err.message,
      });
    }
  }

  async registerSchema(topic: string, schema: any): Promise<{ id: number }> {
    try {
      const subject = `${topic}-value`;
      const id = await this.registry.register(
        {
          type: SchemaType.AVRO,
          schema: JSON.stringify(schema),
        },
        { subject },
      );
      this.logger.info(`Schema registered successfully for topic ${topic}`, {
        schemaId: id,
      });
      return { id: Number(id) };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to register schema for topic ${topic}`, {
        error: err.stack,
      });
      throw new SchemaRegistryException(
        `Failed to register schema for topic ${topic}`,
        {
          error: err.stack || err.message,
        },
      );
    }
  }

  async getLatestSchemaId(subject: string): Promise<{ id: number }> {
    try {
      const id = await this.registry.getLatestSchemaId(subject);
      return { id: Number(id) };
    } catch (error) {
      // Check if this is a first-time schema creation scenario
      const topic = subject.replace('-value', '');
      if (KAFKA_SCHEMAS[topic]) {
        this.logger.warn(
          `Schema not found for ${subject}, creating new schema for first time use`,
        );
        try {
          return await this.registerSchema(topic, KAFKA_SCHEMAS[topic]);
        } catch (registerError) {
          const err = registerError as Error;
          this.logger.error(`Failed to create schema for ${subject}`, {
            error: err.stack,
          });
          throw new SchemaRegistryException(
            `Failed to create schema for ${subject}`,
            {
              error: err.stack || err.message,
            },
          );
        }
      }
      const err = error as Error;
      this.logger.error(
        `Schema not found and no definition available for ${subject}`,
        { error: err.stack },
      );
      throw new SchemaRegistryException(
        `Schema not found and no definition available for ${subject}`,
        {
          error: err.stack || err.message,
        },
      );
    }
  }

  async getSchema(topic: string): Promise<Schema> {
    try {
      const subject = `${topic}-value`;
      const id = await this.registry.getLatestSchemaId(subject);
      const schema = await this.registry.getSchema(id);
      return schema;
    } catch (error) {
      // Check if this is a first-time schema creation scenario
      if (KAFKA_SCHEMAS[topic]) {
        this.logger.warn(
          `Schema not found for ${topic}, creating new schema for first time use`,
        );
        try {
          const { id } = await this.registerSchema(topic, KAFKA_SCHEMAS[topic]);
          return await this.registry.getSchema(id);
        } catch (registerError) {
          const err = registerError as Error;
          this.logger.error(`Failed to create schema for ${topic}`, {
            error: err.stack,
          });
          throw new SchemaRegistryException(
            `Failed to create schema for ${topic}`,
            {
              error: err.stack || err.message,
            },
          );
        }
      }
      const err = error as Error;
      this.logger.error(
        `Schema not found and no definition available for ${topic}`,
        { error: err.stack },
      );
      throw new SchemaRegistryException(
        `Schema not found and no definition available for ${topic}`,
        {
          error: err.stack || err.message,
        },
      );
    }
  }
}
