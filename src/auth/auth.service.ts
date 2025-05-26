import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface User {
  id: number;
  username: string;
}

interface JwtPayload {
  username: string;
  sub: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  validateUser(username: string, password: string): Promise<User | null> {
    // TODO: Implement actual user validation
    // This is a placeholder for demonstration
    return Promise.resolve(
      username === 'admin' && password === 'admin'
        ? { id: 1, username: 'admin' }
        : null,
    );
  }

  login(user: User): Promise<{ access_token: string }> {
    const payload: JwtPayload = { username: user.username, sub: user.id };
    return Promise.resolve({
      access_token: this.jwtService.sign(payload),
    });
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
