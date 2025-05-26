// export interface IPhaseTransitionPayload {
//   phaseId: string;
//   status: 'STARTED' | 'COMPLETED' | 'FAILED';
//   metadata?: Record<string, unknown>;
// }

// export interface IChallengeUpdatePayload {
//   challengeId: string;
//   status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
//   score?: number;
//   feedback?: string;
// }

// export interface ICommandPayload {
//   command: string;
//   parameters: Record<string, unknown>;
//   metadata?: Record<string, unknown>;
// }

// export interface IAutopilotState {
//   currentPhase: string;
//   challenges: Array<{
//     id: string;
//     status: string;
//     score?: number;
//   }>;
//   metadata: Record<string, unknown>;
// }

// export interface IAutopilotConfig {
//   maxRetries: number;
//   timeout: number;
//   phases: string[];
// }
