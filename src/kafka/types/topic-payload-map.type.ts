import { KAFKA_TOPICS } from '../constants/topics';
import {
  PhaseTransitionMessageDto,
  ChallengeUpdateMessageDto,
  CommandMessageDto,
} from '../dto/produce-message.dto';

export type TopicPayloadMap = {
  [KAFKA_TOPICS.PHASE_TRANSITION]: PhaseTransitionMessageDto['payload'];
  [KAFKA_TOPICS.CHALLENGE_UPDATE]: ChallengeUpdateMessageDto['payload'];
  [KAFKA_TOPICS.COMMAND]: CommandMessageDto['payload'];
};
