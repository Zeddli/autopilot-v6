export const KAFKA_TOPICS = {
  PHASE_TRANSITION: 'autopilot.phase.transition',
  CHALLENGE_UPDATE: 'autopilot.challenge.update',
  COMMAND: 'autopilot.command',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];
