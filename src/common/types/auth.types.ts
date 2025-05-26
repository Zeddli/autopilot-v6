export interface IJwtPayload {
  sub: number;
  username: string;
  iat?: number;
  exp?: number;
}

export interface IValidatedUser {
  id: number;
  username: string;
}

export interface IJwtConfig {
  secret: string;
  expiresIn?: string;
}
