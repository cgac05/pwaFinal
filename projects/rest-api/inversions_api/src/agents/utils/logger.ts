/**
 * Structured Logging Utility
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Logger class with structured output
 */
export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * Log message at specified level
   */
  private log(level: LogLevel, message: string, metadata?: any): void {
    // Check if this level should be logged
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = level.padEnd(5);

    const output = {
      timestamp,
      level,
      message,
      ...(metadata && { metadata }),
    };

    const logMessage = `[${timestamp}] ${levelStr} ${message}`;

    if (level === LogLevel.ERROR) {
      console.error(logMessage, metadata ? JSON.stringify(metadata) : '');
    } else if (level === LogLevel.WARN) {
      console.warn(logMessage, metadata ? JSON.stringify(metadata) : '');
    } else if (level === LogLevel.DEBUG) {
      console.debug(logMessage, metadata ? JSON.stringify(metadata) : '');
    } else {
      console.log(logMessage, metadata ? JSON.stringify(metadata) : '');
    }
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.level);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: any): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: any): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: any): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Export singleton instance
export const logger = new Logger(LogLevel.INFO);
