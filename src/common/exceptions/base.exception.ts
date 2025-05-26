export class BaseException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace(this, new.target);
  }

  toJSON(): {
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  } {
    const safeDetails: Record<string, unknown> | undefined =
      this.details &&
      typeof this.details === 'object' &&
      this.details !== null &&
      !Array.isArray(this.details)
        ? this.details
        : undefined;

    return {
      error: {
        code: this.code,
        message: this.message,
        details: safeDetails,
      },
    };
  }
}
