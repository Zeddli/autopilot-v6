import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { KafkaTopic } from '../constants/topics';
import { TopicPayloadMap } from '../types/topic-payload-map.type';

export class KafkaMessage<T extends KafkaTopic> {
  @IsString()
  @IsNotEmpty()
  topic: T;

  @IsString()
  @IsNotEmpty()
  originator: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsNotEmpty()
  'mime-type': string;

  @ValidateNested()
  @Type()
  payload: TopicPayloadMap[T];

  constructor(data: KafkaMessage<T>) {
    Object.assign(this, data);
  }
}
