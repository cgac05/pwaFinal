/**
 * T021b, T021d: Standardized Error Handling & Logging
 * 
 * All API endpoints and services in TEAM-03 must follow these patterns.
 */

export interface Logger {
  info(data: Record<string, unknown>): void;
  warn(data: Record<string, unknown>): void;
  error(data: Record<string, unknown>): void;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  status: number;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccessResponse<T> {
  data: T;
  status: number;
  timestamp: string;
  version: string;
  requestId?: string;
}

export class Team03Error extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "Team03Error";
  }
}

/**
 * Standard error codes for TEAM-03 APIs
 */
export const ERROR_CODES = {
  INVALID_TICKER: "INVALID_TICKER",
  DATA_FETCH_ERROR: "DATA_FETCH_ERROR",
  VIABILITY_CALCULATION_ERROR: "VIABILITY_CALCULATION_ERROR",
  STRATEGY_RECOMMENDATION_ERROR: "STRATEGY_RECOMMENDATION_ERROR",
  AUDIT_NOT_FOUND: "AUDIT_NOT_FOUND",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  AUTHORIZATION_FAILED: "AUTHORIZATION_FAILED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Format error response following standard structure
 */
export function formatErrorResponse(
  error: unknown,
  requestId?: string
): ApiErrorResponse {
  if (error instanceof Team03Error) {
    return {
      error: error.message,
      code: error.code,
      status: error.status,
      timestamp: new Date().toISOString(),
      requestId,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      status: 500,
      timestamp: new Date().toISOString(),
      requestId
    };
  }

  return {
    error: "Unknown error occurred",
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    status: 500,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Structured logging helper
 */
export function logStructured(
  logger: Logger,
  level: "info" | "warn" | "error",
  action: string,
  metadata: {
    actor?: string;
    result?: "success" | "failure";
    ticker?: string;
    error?: string;
    [key: string]: unknown;
  }
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    action,
    ...metadata
  };

  switch (level) {
    case "info":
      logger.info(logData);
      break;
    case "warn":
      logger.warn(logData);
      break;
    case "error":
      logger.error(logData);
      break;
  }
}
