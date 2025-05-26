import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IJwtPayload, IValidatedUser } from '../../common/types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }

    const extractJwtFromBearerToken = (request: Request): string | null => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }
      return authHeader.substring(7);
    };

    const options: StrategyOptions = {
      jwtFromRequest: extractJwtFromBearerToken,
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    };

    super(options);
  }

  validate(payload: IJwtPayload): IValidatedUser {
    try {
      if (!payload.sub || !payload.username) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return {
        id: payload.sub,
        username: payload.username,
      };
    } catch (error) {
      const err = error as Error;
      throw new UnauthorizedException(err.message);
    }
  }
}
