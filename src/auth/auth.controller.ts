import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

interface LoginDto {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
}

interface User {
  id: number;
  username: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    const user = (await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    )) as User | null;

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user);
  }
}
