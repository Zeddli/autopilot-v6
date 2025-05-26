export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
}

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeout = options.resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      if (this.shouldReset()) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    return this.failures >= this.failureThreshold;
  }

  private shouldReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
  }

  private recordSuccess(): void {
    this.failures = Math.max(0, this.failures - 1);
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}
