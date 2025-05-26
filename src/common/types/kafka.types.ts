import { Schema } from '@kafkajs/confluent-schema-registry/dist/@types';

export interface ISchemaCacheEntry {
  schema: Schema;
  timestamp: number;
}

// export interface IKafkaMessageHeaders {
//   'correlation-id': string;
//   timestamp: string;
//   [key: string]: string;
// }

// export interface IKafkaProducerOptions {
//   topic: string;
//   messages: Array<{
//     value: Buffer;
//     headers: IKafkaMessageHeaders;
//   }>;
//   acks: number;
//   timeout: number;
// }

// export interface IKafkaConsumerOptions {
//   groupId: string;
//   topics: string[];
//   fromBeginning: boolean;
// }

export interface IKafkaConfig {
  clientId: string;
  brokers: string[];
  retry: {
    initialRetryTime: number;
    retries: number;
    maxRetryTime: number;
  };
}
