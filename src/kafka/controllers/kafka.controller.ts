import { Controller, Post, Body } from '@nestjs/common';
import { AutopilotProducer } from '../producers/autopilot.producer';
import {
  PhaseTransitionMessageDto,
  ChallengeUpdateMessageDto,
  CommandMessageDto,
} from '../dto/produce-message.dto';

@Controller('kafka')
export class KafkaController {
  constructor(private readonly autopilotProducer: AutopilotProducer) {}

  @Post('phase-transition')
  async producePhaseTransition(@Body() message: PhaseTransitionMessageDto) {
    await this.autopilotProducer.sendPhaseTransition(message.payload);
    return {
      success: true,
      message: 'Phase transition message produced successfully',
      data: {
        timestamp: message.timestamp,
        projectId: message.payload.projectId,
        phaseId: message.payload.phaseId,
        state: message.payload.state,
      },
    };
  }

  @Post('challenge-update')
  async produceChallengeUpdate(@Body() message: ChallengeUpdateMessageDto) {
    await this.autopilotProducer.sendChallengeUpdate(message.payload);
    return {
      success: true,
      message: 'Challenge update message produced successfully',
      data: {
        timestamp: message.timestamp,
        challengeId: message.payload.challengeId,
        status: message.payload.status,
      },
    };
  }

  @Post('command')
  async produceCommand(@Body() message: CommandMessageDto) {
    await this.autopilotProducer.sendCommand(message.payload);
    return {
      success: true,
      message: 'Command message produced successfully',
      data: {
        timestamp: message.timestamp,
        command: message.payload.command,
        projectId: message.payload.projectId,
      },
    };
  }
}
