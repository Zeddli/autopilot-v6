import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { KafkaTopic } from '../constants/topics';

export abstract class KafkaMessageTemplate<T> {
  @IsString()
  @IsNotEmpty()
  readonly topic: KafkaTopic;

  @IsString()
  @IsNotEmpty()
  readonly originator: string;

  @IsString()
  @IsNotEmpty()
  readonly timestamp: string;

  @IsString()
  @IsNotEmpty()
  readonly mimeType: string;

  @ValidateNested()
  @Type()
  readonly payload: T;

  constructor(topic: KafkaTopic, payload: T) {
    this.topic = topic;
    this.originator = 'auto_pilot';
    this.timestamp = new Date().toISOString();
    this.mimeType = 'application/json';
    this.payload = payload;
  }

  toJSON() {
    return {
      topic: this.topic,
      originator: this.originator,
      timestamp: this.timestamp,
      mimeType: this.mimeType,
      payload: this.payload,
    };
  }
}
