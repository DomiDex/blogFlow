/// <reference lib="deno.ns" />
import { config } from "@config/index.ts";
import { LOG_LEVELS } from "@config/constants.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  environment: string;
  hostname?: string;
}

class Logger {
  private logLevel: number;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = config.NODE_ENV === "development";
    this.logLevel = this.getLogLevelValue(config.LOG_LEVEL as LogLevel);
  }

  private getLogLevelValue(level: LogLevel): number {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] || 1;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLogLevelValue(level) >= this.logLevel;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private maskSensitiveData(data: unknown): unknown {
    if (typeof data !== "object" || data === null) return data;

    const sensitiveKeys = [
      "password",
      "token",
      "api_key",
      "apiKey",
      "secret",
      "authorization",
      "cookie",
      "sessionId",
      "creditCard",
      "ssn",
      "email",
    ];

    const masked = { ...data } as Record<string, unknown>;

    for (const [key, value] of Object.entries(masked)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains sensitive patterns
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        masked[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        // Recursively mask nested objects
        masked[key] = this.maskSensitiveData(value);
      }
    }

    return masked;
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      environment: config.NODE_ENV,
    };

    if (context) {
      entry.context = this.maskSensitiveData(context) as LogContext;
    }

    try {
      entry.hostname = Deno.hostname();
    } catch {
      // Hostname might not be available in some environments
    }

    if (this.isDevelopment) {
      return this.formatDevelopmentLog(entry);
    }

    // Production: JSON format for structured logging
    return JSON.stringify(entry);
  }

  private formatDevelopmentLog(entry: LogEntry): string {
    const levelColors: Record<LogLevel, string> = {
      debug: "\x1b[36m", // Cyan
      info: "\x1b[32m",  // Green
      warn: "\x1b[33m",  // Yellow
      error: "\x1b[31m", // Red
    };

    const reset = "\x1b[0m";
    const color = levelColors[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    
    let log = `${color}[${levelStr}]${reset} ${entry.timestamp} - ${entry.message}`;

    if (entry.context) {
      const { error, ...otherContext } = entry.context;
      
      if (Object.keys(otherContext).length > 0) {
        log += `\n  Context: ${JSON.stringify(otherContext, null, 2)}`;
      }
      
      if (error && error.stack) {
        log += `\n  Stack: ${error.stack}`;
      }
    }

    return log;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const formattedLog = this.formatLogEntry(level, message, context);

    switch (level) {
      case "error":
        console.error(formattedLog);
        break;
      case "warn":
        console.warn(formattedLog);
        break;
      case "debug":
      case "info":
      default:
        console.log(formattedLog);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }

  // Utility method for logging HTTP requests
  http(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 400 ? "error" : statusCode >= 300 ? "warn" : "info";
    const message = `${method} ${path} ${statusCode} ${duration}ms`;
    
    this.log(level, message, {
      method,
      path,
      statusCode,
      duration,
      ...context,
    });
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    const message = `Performance: ${operation} took ${duration}ms`;
    const level = duration > 1000 ? "warn" : "debug";
    
    this.log(level, message, {
      operation,
      duration,
      slow: duration > 1000,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };