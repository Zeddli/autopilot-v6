/**
 * Circuit Breaker State Enumeration
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker Options Interface
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time to wait before attempting to close the circuit (in milliseconds) */
  resetTimeout: number;
  /** Timeout for individual operations (in milliseconds) */
  operationTimeout?: number;
  /** Number of successful calls required to close a half-open circuit */
  successThreshold?: number;
  /** Enable detailed monitoring and metrics */
  enableMonitoring?: boolean;
  /** Custom error filter function */
  errorFilter?: (error: Error) => boolean;
  /** Fallback function to execute when circuit is open */
  fallback?: () => Promise<any>;
}

/**
 * Circuit Breaker Metrics Interface
 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  stateChangeTime: number;
  failureRate: number;
  successRate: number;
}

/**
 * Enhanced Circuit Breaker Implementation
 *
 * Provides protection against cascading failures with advanced features:
 * - Three-state circuit breaker (CLOSED, OPEN, HALF_OPEN)
 * - Configurable success threshold for half-open state
 * - Operation timeout protection
 * - Detailed metrics and monitoring
 * - Custom error filtering
 * - Fallback mechanism support
 */
export class CircuitBreaker {
  private failures: number = 0;
  private successes: number = 0;
  private totalCalls: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private stateChangeTime: number = Date.now();
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly operationTimeout: number;
  private readonly successThreshold: number;
  private readonly enableMonitoring: boolean;
  private readonly errorFilter?: (error: Error) => boolean;
  private readonly fallback?: () => Promise<any>;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeout = options.resetTimeout;
    this.operationTimeout = options.operationTimeout || 30000; // 30 seconds default
    this.successThreshold = options.successThreshold || 3;
    this.enableMonitoring = options.enableMonitoring || false;
    this.errorFilter = options.errorFilter;
    this.fallback = options.fallback;
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Function to execute
   * @returns Promise with the function result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check circuit state and handle accordingly
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.moveToHalfOpen();
      } else {
        // Circuit is open, use fallback if available
        if (this.fallback) {
          return (await this.fallback()) as T;
        }
        throw new Error(
          `Circuit breaker is OPEN. Last failure: ${this.lastFailureTime}`,
        );
      }
    }

    try {
      // Execute with timeout protection
      const result = await this.executeWithTimeout(fn);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute function with timeout protection
   *
   * @param fn - Function to execute
   * @returns Promise with timeout protection
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Operation timed out after ${this.operationTimeout}ms`),
        );
      }, this.operationTimeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Check if we have enough successes to close the circuit
      if (this.getRecentSuccesses() >= this.successThreshold) {
        this.moveToClosed();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Gradually reduce failure count on success
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  /**
   * Record failed operation
   *
   * @param error - Error that occurred
   */
  private recordFailure(error: Error): void {
    // Apply error filter if configured
    if (this.errorFilter && !this.errorFilter(error)) {
      return; // Don't count this error
    }

    this.failures++;
    this.lastFailureTime = Date.now();

    // Check if we should open the circuit
    if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failures >= this.failureThreshold
    ) {
      this.moveToOpen();
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state moves back to open
      this.moveToOpen();
    }
  }

  /**
   * Move circuit breaker to CLOSED state
   */
  private moveToClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.stateChangeTime = Date.now();
  }

  /**
   * Move circuit breaker to OPEN state
   */
  private moveToOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.stateChangeTime = Date.now();
  }

  /**
   * Move circuit breaker to HALF_OPEN state
   */
  private moveToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successes = 0; // Reset success counter for half-open state
    this.stateChangeTime = Date.now();
  }

  /**
   * Check if circuit should attempt to reset (move to half-open)
   *
   * @returns Boolean indicating if reset should be attempted
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.stateChangeTime >= this.resetTimeout;
  }

  /**
   * Get recent successes count (for half-open state evaluation)
   *
   * @returns Number of recent successes
   */
  private getRecentSuccesses(): number {
    return this.successes;
  }

  /**
   * Get current circuit breaker state
   *
   * @returns Current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get detailed circuit breaker metrics
   *
   * @returns Metrics object with current statistics
   */
  getMetrics(): CircuitBreakerMetrics {
    const failureRate =
      this.totalCalls > 0 ? (this.failures / this.totalCalls) * 100 : 0;
    const successRate =
      this.totalCalls > 0
        ? ((this.totalCalls - this.failures) / this.totalCalls) * 100
        : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangeTime: this.stateChangeTime,
      failureRate: Math.round(failureRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.state = CircuitBreakerState.CLOSED;
    this.stateChangeTime = Date.now();
  }

  /**
   * Check if circuit breaker is healthy
   *
   * @returns Boolean indicating if circuit is healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    return (
      this.state === CircuitBreakerState.CLOSED &&
      metrics.failureRate < 50 && // Less than 50% failure rate
      (this.lastFailureTime === null ||
        Date.now() - this.lastFailureTime > 60000) // No failures in last minute
    );
  }
}

/**
 * Circuit Breaker Factory for creating pre-configured instances
 */
export class CircuitBreakerFactory {
  /**
   * Create circuit breaker for scheduler operations
   *
   * @param customOptions - Custom options to override defaults
   * @returns Configured CircuitBreaker instance
   */
  static createSchedulerCircuitBreaker(
    customOptions?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      operationTimeout: 30000, // 30 seconds
      successThreshold: 3,
      enableMonitoring: true,
      errorFilter: (error: Error) => {
        // Don't count validation errors as circuit breaker failures
        return (
          !error.message.includes('validation') &&
          !error.message.includes('invalid')
        );
      },
    };

    return new CircuitBreaker({ ...defaultOptions, ...customOptions });
  }

  /**
   * Create circuit breaker for recovery operations
   *
   * @param customOptions - Custom options to override defaults
   * @returns Configured CircuitBreaker instance
   */
  static createRecoveryCircuitBreaker(
    customOptions?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 3,
      resetTimeout: 120000, // 2 minutes
      operationTimeout: 60000, // 1 minute
      successThreshold: 2,
      enableMonitoring: true,
      errorFilter: (error: Error) => {
        // Don't count network timeout errors as permanent failures
        return (
          !error.message.includes('timeout') &&
          !error.message.includes('ETIMEDOUT')
        );
      },
    };

    return new CircuitBreaker({ ...defaultOptions, ...customOptions });
  }

  /**
   * Create circuit breaker for challenge service API calls
   *
   * @param customOptions - Custom options to override defaults
   * @returns Configured CircuitBreaker instance
   */
  static createChallengeServiceCircuitBreaker(
    customOptions?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      operationTimeout: 15000, // 15 seconds
      successThreshold: 2,
      enableMonitoring: true,
      fallback: async () => {
        // Return empty array as fallback for challenge service failures
        await Promise.resolve(); // Add await to satisfy linter
        return [];
      },
      errorFilter: (error: Error) => {
        // Count 5xx errors but not 4xx errors (client errors)
        const isServerError =
          error.message.includes('5') || error.message.includes('timeout');
        return isServerError;
      },
    };

    return new CircuitBreaker({ ...defaultOptions, ...customOptions });
  }

  /**
   * Create circuit breaker for Kafka operations
   *
   * @param customOptions - Custom options to override defaults
   * @returns Configured CircuitBreaker instance
   */
  static createKafkaCircuitBreaker(
    customOptions?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 10,
      resetTimeout: 45000, // 45 seconds
      operationTimeout: 10000, // 10 seconds
      successThreshold: 5,
      enableMonitoring: true,
      errorFilter: (error: Error) => {
        // Count connection and broker errors
        return (
          error.message.includes('broker') ||
          error.message.includes('connection')
        );
      },
    };

    return new CircuitBreaker({ ...defaultOptions, ...customOptions });
  }
}
